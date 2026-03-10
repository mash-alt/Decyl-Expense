const API_BASE = 'https://decyl-expense.onrender.com/api'

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Expense object returned by POST /api/expenses/parse (parse only, no save). */
export type ParsedExpense = {
  description: string
  amount:      number
  category:    string
}

/**
 * Financial context forwarded to POST /api/ai/chat so Gemini can give
 * personalised answers without needing access to Firestore directly.
 */
export type AiChatContext = {
  totalSpent:    number
  monthlyBudget: number
  remaining:     number
  todaySpent:    number
}

/** Result from POST /api/ai/insight */
export type AiInsightResult = {
  insight:       string
  totalSpent:    number
  percentUsed:   number
  monthlyBudget: number
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) throw new Error(`[AI API] ${path} → ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Pings GET /api/health.
 * @returns true if the server responds with any 2xx, false otherwise.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await apiFetch<unknown>('/health')
    return true
  } catch {
    return false
  }
}

/**
 * Sends a user message to POST /api/ai/chat with the current financial context.
 *
 * @throws Re-throws network / non-2xx errors so callers can show an error bubble.
 */
export async function sendChatMessage(
  message: string,
  context: AiChatContext,
): Promise<string> {
  const data = await apiFetch<{ reply?: string; message?: string; response?: string }>(
    '/ai/chat',
    { method: 'POST', body: JSON.stringify({ message, context }) },
  )
  return data.reply ?? data.message ?? data.response ?? '(no response)'
}

/**
 * Sends text to POST /api/expenses/parse to extract structured expenses.
 * Uses the parse-only endpoint — does NOT save to Firestore.
 * Always returns an array (empty if nothing detected or on any error).
 */
export async function parseExpenseFromText(text: string): Promise<ParsedExpense[]> {
  try {
    const data = await apiFetch<{ expenses?: ParsedExpense[] }>(
      '/expenses/parse',
      { method: 'POST', body: JSON.stringify({ message: text }) },
    )
    const list = data.expenses ?? []
    return list.filter(e => typeof e.amount === 'number' && e.amount > 0)
  } catch {
    return []
  }
}

/**
 * Requests a plain-language budget insight from POST /api/ai/insight.
 * Returns null silently on any error so callers can fall back to static text.
 *
 * @param expenses      Current expense rows to analyse.
 * @param monthlyBudget The user's monthly budget cap.
 */
export async function getAiInsight(
  expenses: { description: string; category: string; amount: number; date: string }[],
  monthlyBudget: number,
): Promise<AiInsightResult | null> {
  try {
    const data = await apiFetch<AiInsightResult>(
      '/ai/insight',
      { method: 'POST', body: JSON.stringify({ expenses, monthlyBudget }) },
    )
    if (!data.insight) return null
    return data
  } catch {
    return null
  }
}

export type DailySuggestionResult = {
  suggestion:          string
  todayTotal:          number
  monthlyTotal:        number
  monthlyBudget:       number
  remainingBudget:     number
  percentOfBudgetUsed: number
}

/**
 * Fetches a personalised daily spending suggestion from GET /api/ai/daily-suggestion.
 * Returns null silently on any error (server offline, no budget set, etc.).
 *
 * @param monthlyBudget The user's monthly budget cap.
 */
export async function getDailySuggestion(
  monthlyBudget: number,
): Promise<DailySuggestionResult | null> {
  try {
    const data = await apiFetch<DailySuggestionResult>(
      `/ai/daily-suggestion?monthlyBudget=${monthlyBudget}`,
    )
    if (!data.suggestion) return null
    return data
  } catch {
    return null
  }
}
