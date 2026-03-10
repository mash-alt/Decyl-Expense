import { useEffect, useRef, useState } from 'react'
import { checkHealth, sendChatMessage, parseExpenseFromText } from '../services/aiService.ts'
import type { AiChatContext, ParsedExpense } from '../services/aiService.ts'
import type { ExpenseDraft } from '../types.ts'
import { formatAmount, getTodayIsoDate } from '../utils.ts'

// ─── Category normalisation ─────────────────────────────────────────────────
// The AI server returns lowercase categories ("food", "transport") that must
// be mapped to the app's canonical names before saving to Firestore.
const AI_CATEGORY_MAP: Record<string, string> = {
  food:       'Food',
  transport:  'Transit',
  transit:    'Transit',
  shopping:   'Shopping',
  bills:      'Bills',
  health:     'Health',
}
const normalizeCategory = (raw: string): string =>
  AI_CATEGORY_MAP[raw.toLowerCase()] ?? (raw.charAt(0).toUpperCase() + raw.slice(1))

// ─── Message types ────────────────────────────────────────────────────────────

type RegularMessage = { id: string; role: 'user' | 'ai' | 'error'; text: string }
type TypingMessage  = { id: string; role: 'typing' }
type ConfirmMessage = { id: string; role: 'confirm'; expense: ParsedExpense; status: 'pending' | 'added' | 'dismissed' }
type Message = RegularMessage | TypingMessage | ConfirmMessage

// ─── Helpers ──────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2)

const mkUser    = (text: string): RegularMessage => ({ id: genId(), role: 'user',    text })
const mkAi      = (text: string): RegularMessage => ({ id: genId(), role: 'ai',      text })
const mkError   = (text: string): RegularMessage => ({ id: genId(), role: 'error',   text })
const mkTyping  = ():              TypingMessage  => ({ id: genId(), role: 'typing'        })
const mkConfirm = (expense: ParsedExpense): ConfirmMessage =>
  ({ id: genId(), role: 'confirm', expense, status: 'pending' })

const WELCOME = mkAi(
  "Hi! I'm your budget co-pilot. Tell me what you spent, ask about your budget, or pick a suggestion below.",
)

const PROMPT_CHIPS = [
  'What did I spend today?',
  'Am I on track this month?',
  'Summarise my week',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssistantPanel({
  onClose,
  onAddExpense,
  context,
}: {
  onClose?:        () => void
  onAddExpense?:   (draft: ExpenseDraft) => Promise<string>
  context?:        AiChatContext
}) {
  const [messages,  setMessages]  = useState<Message[]>([WELCOME])
  const [input,     setInput]     = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isOnline,  setIsOnline]  = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Health check once on mount
  useEffect(() => {
    checkHealth().then(online => setIsOnline(online))
  }, [])

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── State helpers ──────────────────────────────────────────────────────────

  const appendMessages = (...msgs: Message[]) =>
    setMessages(prev => [...prev, ...msgs])

  const replaceTyping = (typingId: string, ...replacements: Message[]) =>
    setMessages(prev => [...prev.filter(m => m.id !== typingId), ...replacements])

  const setConfirmStatus = (id: string, status: ConfirmMessage['status']) =>
    setMessages(prev => prev.map(m =>
      m.id === id && m.role === 'confirm' ? { ...m, status } : m,
    ))

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isSending || isOnline === false) return

    setInput('')
    setIsSending(true)

    const typingMsg = mkTyping()
    appendMessages(mkUser(text), typingMsg)

    const aiContext: AiChatContext = context ?? {
      totalSpent: 0, monthlyBudget: 0, remaining: 0, todaySpent: 0,
    }

    try {
      // Fire chat and expense-parse in parallel; expense parse never throws
      const [reply, parsed] = await Promise.all([
        sendChatMessage(text, aiContext),
        parseExpenseFromText(text),
      ])

      const newMsgs: Message[] = [mkAi(reply)]
      // Append one confirm card per detected expense (server may return multiple)
      for (const expense of parsed) {
        newMsgs.push(mkConfirm({ ...expense, category: normalizeCategory(expense.category) }))
      }
      replaceTyping(typingMsg.id, ...newMsgs)
    } catch {
      replaceTyping(
        typingMsg.id,
        mkError('Could not reach the AI server. Make sure it is running on port 3000.'),
      )
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Expense confirm actions ────────────────────────────────────────────────

  const handleConfirmExpense = async (msgId: string, expense: ParsedExpense) => {
    if (!onAddExpense) return
    setConfirmStatus(msgId, 'added')
    const draft: ExpenseDraft = {
      description: expense.description,
      category:    normalizeCategory(expense.category),
      amount:      String(expense.amount),
      date:        getTodayIsoDate(),
    }
    try {
      await onAddExpense(draft)
    } catch {
      setConfirmStatus(msgId, 'pending') // revert on failure
    }
  }

  // ── Status pill ────────────────────────────────────────────────────────────

  const pill =
    isOnline === null ? { text: 'Connecting…', cls: 'checking-pill' } :
    isOnline          ? { text: 'Live',         cls: ''              } :
                        { text: 'Offline',       cls: 'offline-pill'  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="assistant-inner">

      {/* Compact messenger-style header */}
      <div className="chat-window-header">
        <div className="chat-window-title">
          <span className="chat-window-icon">✦</span>
          <span>Budget co-pilot</span>
          <span className={`status-pill ${pill.cls}`}>{pill.text}</span>
        </div>
        {onClose ? (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        ) : null}
      </div>

      {/* Chat history */}
      <div className="chat-stack">
        {messages.map(msg => {

          if (msg.role === 'typing') {
            return (
              <div key={msg.id} className="chat-bubble ai">
                <span className="chat-label">AI</span>
                <div className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )
          }

          if (msg.role === 'confirm') {
            return (
              <div key={msg.id} className={`expense-confirm-card ${msg.status}`}>
                <div className="expense-confirm-header">
                  <span className="expense-confirm-kicker">Detected expense</span>
                  {msg.status === 'added'     && <span className="expense-confirm-badge added">✓ Added</span>}
                  {msg.status === 'dismissed' && <span className="expense-confirm-badge dismissed">Dismissed</span>}
                </div>
                <div className="expense-confirm-details">
                  <strong>{msg.expense.description}</strong>
                  <span>{msg.expense.category} · {formatAmount(msg.expense.amount)}</span>
                </div>
                {msg.status === 'pending' && (
                  <div className="expense-confirm-actions">
                    {onAddExpense ? (
                      <button
                        type="button"
                        className="primary-button compact"
                        onClick={() => void handleConfirmExpense(msg.id, msg.expense)}
                      >
                        Add to expenses
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button compact"
                      onClick={() => setConfirmStatus(msg.id, 'dismissed')}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )
          }

          // Regular message (user | ai | error)
          const label = msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : 'AI'
          return (
            <div key={msg.id} className={`chat-bubble ${msg.role}`}>
              <span className="chat-label">{label}</span>
              {msg.text}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Prompt chips */}
      <div className="prompt-row" aria-label="Suggested prompts">
        {PROMPT_CHIPS.map(prompt => (
          <button
            key={prompt}
            type="button"
            className="prompt-chip"
            disabled={isSending || isOnline === false}
            onClick={() => void handleSend(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="assistant-input">
        <input
          ref={inputRef}
          type="text"
          placeholder={
            isOnline === false
              ? 'AI server offline — start the server on port 3000'
              : 'Tell me what you spent or ask about your budget…'
          }
          value={input}
          disabled={isOnline === false}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSend() }}
        />
        <button
          type="button"
          className="primary-button compact"
          disabled={!input.trim() || isSending || isOnline === false}
          onClick={() => void handleSend()}
        >
          {isSending ? '…' : 'Send →'}
        </button>
      </div>

    </div>
  )
}
