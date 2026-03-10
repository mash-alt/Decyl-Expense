import { useEffect, useMemo, useState } from 'react'
import { navigation, expenseCategories } from './constants.ts'
import { createExpenseDraft, formatAmount, parseAmount } from './utils.ts'
import type { View, ExpenseRow, ExpenseDraft, ExpenseField, BudgetSettings } from './types.ts'
import { addExpense, updateExpense, deleteExpense, subscribeToExpenses } from './services/expenseService.ts'
import { saveBudgetSettings, subscribeToMonthlyBudget } from './services/budgetService.ts'
import { getAiInsight, getDailySuggestion, type DailySuggestionResult } from './services/aiService.ts'
import { useAuth } from './contexts/AuthContext.tsx'
import AuthPage from './pages/AuthPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ExpensesPage from './pages/ExpensesPage.tsx'
import InsightsPage from './pages/InsightsPage.tsx'
import BudgetPage from './pages/BudgetPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import AssistantPanel from './components/AssistantPanel.tsx'

import type { User } from 'firebase/auth'

function AppShell({ user }: { user: User }) {
  const { signOut } = useAuth()
  const uid = user.uid
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true)
  const [monthlyBudget, setMonthlyBudget] = useState(0)
  const [savingsGoal, setSavingsGoal] = useState(0)
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({})
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [quickAddForm, setQuickAddForm] = useState<ExpenseDraft>(createExpenseDraft)

  useEffect(() => {
    setIsLoadingExpenses(true)

    const unsubscribe = subscribeToExpenses(
      uid,
      items => {
        setRows(items.map(item => ({
          id:          item.id,
          description: item.description,
          category:    item.category,
          amount:      item.amount,
          date:        item.date.toISOString().slice(0, 10),
        })))
        setIsLoadingExpenses(false)
      },
      error => console.error('[Expenses] Listener error:', error),
    )

    // Returning the unsubscribe directly ensures the listener is detached
    // exactly once when the component unmounts — no duplicate listeners.
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToMonthlyBudget(
      uid,
      data => {
        setMonthlyBudget(data?.monthlyBudget    ?? 0)
        setSavingsGoal(  data?.savingsGoal      ?? 0)
        setCategoryLimits(data?.categoryLimits  ?? {})
        setCustomCategories(data?.customCategories ?? [])
      },
      error => console.error('[Budget] Listener error:', error),
    )
    return unsubscribe
  }, [])

  const handleSaveBudget = async (settings: BudgetSettings): Promise<void> => {
    // Optimistic update so Dashboard/Insights reflect changes immediately
    setMonthlyBudget(settings.monthlyBudget)
    setSavingsGoal(settings.savingsGoal)
    setCategoryLimits(settings.categoryLimits)
    setCustomCategories(settings.customCategories)
    await saveBudgetSettings(uid, settings)
  }

  const handleAddExpense = async (draft: ExpenseDraft): Promise<string> => {
    const data = await addExpense(uid, {
      description: draft.description.trim() || 'New expense',
      category:    draft.category,
      amount:      parseAmount(draft.amount),
      date:        new Date(draft.date),
    })
    const newRow: ExpenseRow = {
      id:          data.id,
      description: data.description,
      category:    data.category,
      amount:      data.amount,
      date:        data.date.toISOString().slice(0, 10),
    }
    setRows(current => [newRow, ...current])
    return data.id
  }

  const handleUpdateExpense = async (
    id:       string,
    field:    ExpenseField,
    rawValue: string,
  ): Promise<void> => {
    // Optimistic update — reflected immediately in the table
    setRows(current =>
      current.map(row => {
        if (row.id !== id) return row
        switch (field) {
          case 'amount':      return { ...row, amount:      parseAmount(rawValue) }
          case 'date':        return { ...row, date:        rawValue }
          case 'description': return { ...row, description: rawValue }
          case 'category':    return { ...row, category:    rawValue }
          default:            return row
        }
      }),
    )
    try {
      if      (field === 'amount')      await updateExpense(uid, id, { amount:      parseAmount(rawValue) })
      else if (field === 'date')        await updateExpense(uid, id, { date:        new Date(rawValue)    })
      else if (field === 'description') await updateExpense(uid, id, { description: rawValue             })
      else if (field === 'category')    await updateExpense(uid, id, { category:    rawValue             })
    } catch (error) {
      console.error('[Expenses] Failed to update:', error)
    }
  }

  const handleDeleteExpense = async (id: string): Promise<void> => {
    setRows(current => current.filter(row => row.id !== id)) // optimistic
    try {
      await deleteExpense(uid, id)
    } catch (error) {
      console.error('[Expenses] Failed to delete:', error)
    }
  }

  const dashboardMetrics = useMemo(() => {
    const now          = new Date()
    const currentYear  = now.getFullYear()
    const currentMonth = now.getMonth() + 1 // 1-indexed, matches ISO "YYYY-MM-DD"
    const todayISO     = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const monthRows  = rows.filter(row => {
      const [y, m] = row.date.split('-').map(Number)
      return y === currentYear && m === currentMonth
    })

    const totalSpent  = monthRows.reduce((sum, row) => sum + row.amount, 0)
    const remaining   = monthlyBudget - totalSpent
    const percentUsed = monthlyBudget > 0
      ? Math.min(100, Math.round((totalSpent / monthlyBudget) * 100))
      : 0

    const todayRows  = rows.filter(row => row.date === todayISO)
    const todaySpent = todayRows.reduce((sum, row) => sum + row.amount, 0)
    const todayCount = todayRows.length

    const categoryMap = new Map<string, number>()
    for (const row of todayRows) {
      categoryMap.set(row.category, (categoryMap.get(row.category) ?? 0) + row.amount)
    }
    const todayBreakdown = [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, amount]) => ({ category, amount }))

    return { monthlyBudget, totalSpent, remaining, percentUsed, todaySpent, todayCount, todayBreakdown }
  }, [rows, monthlyBudget])

  const aiContext = useMemo(() => ({
    totalSpent:    dashboardMetrics.totalSpent,
    monthlyBudget: dashboardMetrics.monthlyBudget,
    remaining:     dashboardMetrics.remaining,
    todaySpent:    dashboardMetrics.todaySpent,
  }), [dashboardMetrics])

  // All categories: built-ins + user-added custom ones
  const allCategories = useMemo(
    () => [...expenseCategories.filter(c => c !== 'All'), ...customCategories],
    [customCategories],
  )

  // Fetch a real AI insight whenever rows or budget change, debounced 2 s
  const [aiInsight, setAiInsight] = useState('')
  useEffect(() => {
    if (rows.length === 0 || monthlyBudget === 0) return
    const timer = setTimeout(() => {
      getAiInsight(
        rows.map(r => ({ description: r.description, category: r.category, amount: r.amount, date: r.date })),
        monthlyBudget,
      ).then(result => { if (result) setAiInsight(result.insight) })
    }, 2000)
    return () => clearTimeout(timer)
  }, [rows, monthlyBudget])

  // Fetch a daily spending suggestion whenever the budget changes, debounced 1 s
  const [dailySuggestion, setDailySuggestion] = useState<DailySuggestionResult | null>(null)
  useEffect(() => {
    if (monthlyBudget === 0) return
    const timer = setTimeout(() => {
      getDailySuggestion(monthlyBudget).then(result => setDailySuggestion(result))
    }, 1000)
    return () => clearTimeout(timer)
  }, [monthlyBudget])

  const pageMeta = useMemo(
    () => ({
      dashboard: {
        eyebrow: 'Today overview',
        title: 'Calm money management, with AI keeping watch.',
        description:
          'A lightweight dashboard that surfaces progress, recent spending, and small nudges without overwhelming the screen.',
      },
      expenses: {
        eyebrow: 'Ledger view',
        title: 'An editable expense database inspired by modern productivity tools.',
        description:
          'Fast scanning, inline-friendly cells, and quick filters make logging and reviewing transactions feel frictionless.',
      },
      insights: {
        eyebrow: 'Patterns and pacing',
        title: 'Simple analytics that explain where your budget goes.',
        description:
          'Clean charts and AI summaries highlight category trends, weekly rhythm, and budget drift at a glance.',
      },
      budget: {
        eyebrow: 'Goals and controls',
        title: 'Budget settings built for focus, not form fatigue.',
        description:
          'Soft cards and tidy spacing keep budget targets, currencies, and categories organized across desktop and mobile.',
      },
      settings: {
        eyebrow: 'Workspace preferences',
        title: 'Simple controls for notifications, AI behavior, and layout comfort.',
        description:
          'Keep the app calm and productive with a lightweight settings surface that stays easy to scan on any screen.',
      },
    }),
    [],
  )

  const renderView = () => {
    switch (activeView) {
      case 'expenses':
        return (
          <ExpensesPage
            rows={rows}
            isLoading={isLoadingExpenses}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            onDelete={handleDeleteExpense}
            categories={allCategories}
          />
        )
      case 'insights':
        return <InsightsPage rows={rows} monthlyBudget={monthlyBudget} aiInsight={aiInsight} />
      case 'budget':
        return (
          <BudgetPage
            monthlyBudget={monthlyBudget}
            savingsGoal={savingsGoal}
            categoryLimits={categoryLimits}
            customCategories={customCategories}
            onSaveBudget={handleSaveBudget}
          />
        )
      case 'settings':
        return <SettingsPage />
      case 'dashboard':
      default:
        return <DashboardPage rows={rows} metrics={dashboardMetrics} aiInsight={aiInsight} dailySuggestion={dailySuggestion} />
    }
  }

  const currentPage = pageMeta[activeView]
  const isQuickAddValid = quickAddForm.description.trim().length > 0 && parseAmount(quickAddForm.amount) > 0

  const handleModalQuickAdd = () => {
    if (!isQuickAddValid) return
    handleAddExpense(quickAddForm)
      .then(() => {
        setQuickAddForm(createExpenseDraft())
        setIsQuickAddOpen(false)
      })
      .catch(error => console.error('[Expenses] Quick-add failed:', error))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar glass-panel">
        <div>
          <div className="brand-mark">
            <img src="/decyl-logo.png" alt="Decyl Expense" />
          </div>
          <div className="brand-copy">
            <p className="eyebrow">Decyl Expense</p>
            <h1>AI Budget Companion</h1>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card subtle-panel">
          <p className="section-kicker">Daily suggestion</p>
          {dailySuggestion ? (
            <>
              <strong>
                {dailySuggestion.remainingBudget > 0
                  ? `₱${dailySuggestion.remainingBudget.toLocaleString()} remaining this month.`
                  : 'Budget limit reached.'}
              </strong>
              <p>{dailySuggestion.suggestion}</p>
            </>
          ) : (
            <>
              <strong>Set a budget to get daily guidance.</strong>
              <p>Your personalised daily spending suggestion will appear here.</p>
            </>
          )}
        </div>
        <div className="sidebar-footer">
          <p className="sidebar-user-email">{user.email ?? 'Signed in'}</p>
          <button
            type="button"
            className="secondary-button compact signout-button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-column">
        <header className="topbar glass-panel">
          <div>
            <p className="eyebrow">{currentPage.eyebrow}</p>
            <h2>{currentPage.title}</h2>
            <p className="topbar-copy">{currentPage.description}</p>
          </div>

          <div className="topbar-actions">
            <button type="button" className="secondary-button" onClick={() => setIsChatOpen(true)}>
              Ask AI
            </button>
            <button type="button" className="primary-button" onClick={() => setIsQuickAddOpen(true)}>
              + Quick add
            </button>
          </div>
        </header>

        <section className="content-grid">{renderView()}</section>
      </main>

      <button
        type="button"
        className="floating-chat"
        onClick={() => setIsChatOpen(true)}
        aria-label="Open AI assistant"
      >
        ✦
      </button>

      <button type="button" className="floating-action" onClick={() => setIsQuickAddOpen(true)}>
        +
      </button>

      <nav className="mobile-nav glass-panel mobile-only" aria-label="Bottom navigation">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {isChatOpen ? (
        <div className="chat-float-window glass-panel">
          <AssistantPanel onClose={() => setIsChatOpen(false)} onAddExpense={handleAddExpense} context={aiContext} />
        </div>
      ) : null}

      {isQuickAddOpen ? (
        <div className="overlay overlay-soft" onClick={() => setIsQuickAddOpen(false)}>
          <div className="modal-panel glass-panel quick-add-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">Quick add expense</p>
                <h3>Log a new expense in seconds</h3>
                <p className="modal-copy">Fast capture for the moment you spend, with just four calm fields.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setIsQuickAddOpen(false)}>
                ×
              </button>
            </div>

            <div className="form-grid">
              <label>
                <span>Description</span>
                <input
                  type="text"
                  placeholder="Dinner with friends"
                  value={quickAddForm.description}
                  onChange={(event) => setQuickAddForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <label>
                <span>Amount</span>
                <input
                  type="text"
                  placeholder="₱420"
                  value={quickAddForm.amount}
                  onChange={(event) => setQuickAddForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={quickAddForm.category}
                  onChange={(event) => setQuickAddForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {allCategories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={quickAddForm.date}
                  onChange={(event) => setQuickAddForm((current) => ({ ...current, date: event.target.value }))}
                />
              </label>
            </div>

            <div className="quick-add-summary">
              <span>Ready to log</span>
              <strong>
                {quickAddForm.description.trim() || 'New expense'} · {quickAddForm.amount ? formatAmount(parseAmount(quickAddForm.amount)) : '₱0'}
              </strong>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setQuickAddForm(createExpenseDraft())
                  setIsQuickAddOpen(false)
                }}
              >
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleModalQuickAdd} disabled={!isQuickAddValid}>
                Save expense
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const { user, isAuthLoading } = useAuth()

  if (isAuthLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <span>Loading…</span>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return <AppShell user={user} />
}

export default App
