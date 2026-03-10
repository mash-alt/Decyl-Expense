import { useMemo } from 'react'
import { CATEGORY_TONES } from '../constants.ts'
import { computeCategoryBreakdown, formatAmount, formatAmountShort, formatShortDate } from '../utils.ts'
import type { ExpenseRow } from '../types.ts'
import type { DailySuggestionResult } from '../services/aiService.ts'
import Metric from '../components/Metric.tsx'

type DashboardMetrics = {
  monthlyBudget:   number
  totalSpent:      number
  remaining:       number
  percentUsed:     number
  todaySpent:      number
  todayCount:      number
  todayBreakdown:  { category: string; amount: number }[]
}

export default function DashboardPage({
  rows,
  metrics,
  aiInsight,
  dailySuggestion,
}: {
  rows:              ExpenseRow[]
  metrics:           DashboardMetrics
  aiInsight?:        string
  dailySuggestion?:  DailySuggestionResult | null
}) {
  const { monthlyBudget, totalSpent, remaining, percentUsed, todaySpent, todayCount, todayBreakdown } = metrics

  const { latestExpenses, categoryData } = useMemo(() => {
    const latest = [...rows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4)

    const now = new Date()
    const y   = now.getFullYear()
    const m   = now.getMonth() + 1
    const monthRows = rows.filter(row => {
      const [ry, rm] = row.date.split('-').map(Number)
      return ry === y && rm === m
    })

    return {
      latestExpenses: latest,
      categoryData:   computeCategoryBreakdown(monthRows, CATEGORY_TONES),
    }
  }, [rows])

  return (
    <>
      <section className="dashboard-grid">
        <article className="hero-card glass-panel span-two">
          <div className="budget-card-header">
            <div>
              <p className="section-kicker">Monthly budget</p>
              <h3>{formatAmount(monthlyBudget)} total budget</h3>
              <p className="muted-copy">
                {formatAmount(totalSpent)} spent so far
                {remaining >= 0
                  ? ', leaving enough room to finish the month comfortably.'
                  : ' — you have exceeded your monthly budget.'}
              </p>
            </div>
            <span className="badge-pill">{percentUsed}% used</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${percentUsed}%` }} />
          </div>
          <div className="hero-meta budget-meta-grid">
            <Metric label="Total monthly budget" value={formatAmount(monthlyBudget)} />
            <Metric label="Amount spent"         value={formatAmount(totalSpent)} />
            <Metric label="Remaining balance"    value={formatAmount(remaining)} />
          </div>
        </article>

        <article className="metric-card subtle-panel">
          <p className="section-kicker">Today's spending</p>
          <strong className="big-metric">{formatAmount(todaySpent)}</strong>
          <p className="muted-copy">
            {todayCount === 0
              ? 'No expenses logged today yet.'
              : `${todayCount} expense${todayCount === 1 ? '' : 's'} logged today.`}
          </p>
          <div className="micro-stat-row">
            {todayBreakdown.map(item => (
              <span key={item.category} className="mini-chip">
                {item.category} {formatAmount(item.amount)}
              </span>
            ))}
          </div>
        </article>

        <article className="metric-card subtle-panel ai-suggestion-card">
          <p className="section-kicker">AI suggestion</p>
          {dailySuggestion ? (
            <>
              <strong>
                {dailySuggestion.remainingBudget > 0
                  ? `₱${dailySuggestion.remainingBudget.toLocaleString()} left — ${Math.round(100 - dailySuggestion.percentOfBudgetUsed)}% of budget remaining.`
                  : 'Budget limit reached for the month.'}
              </strong>
              <p className="muted-copy">{dailySuggestion.suggestion}</p>
            </>
          ) : aiInsight ? (
            <>
              <strong>{aiInsight.split('.')[0]}.</strong>
              <p className="muted-copy">{aiInsight.split('.').slice(1).join('.').trim()}</p>
            </>
          ) : (
            <>
              <strong>Set a budget to get AI spending guidance.</strong>
              <p className="muted-copy">Once your budget and expenses are in, the AI will surface personalised daily suggestions here.</p>
            </>
          )}
        </article>
      </section>

      <section className="panel-grid">
        <article className="subtle-panel chart-card">
          <div className="card-header">
            <div>
              <p className="section-kicker">Category mix</p>
              <h3>Spending categories</h3>
            </div>
            <span className="badge-pill">This month</span>
          </div>

          <div className="category-ring" aria-hidden="true">
            <div className="ring-center">
              <strong>{formatAmountShort(totalSpent)}</strong>
              <span>spent</span>
            </div>
          </div>

          <div className="legend-list">
            {categoryData.length > 0 ? categoryData.map((item) => (
              <div key={item.label} className="legend-row">
                <span className={`legend-dot ${item.tone}`} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            )) : (
              <p className="muted-copy" style={{ padding: '0.5rem 0' }}>No spending this month yet.</p>
            )}
          </div>
        </article>

        <article className="subtle-panel recent-card">
          <div className="card-header">
            <div>
              <p className="section-kicker">Recent activity</p>
              <h3>Latest expenses</h3>
            </div>
            <button type="button" className="text-button">
              View all
            </button>
          </div>

          <div className="expense-list">
            {latestExpenses.length > 0 ? latestExpenses.map((expense) => (
              <div className="expense-row" key={`${expense.date}-${expense.description}-${expense.id}`}>
                <div>
                  <strong>{expense.description}</strong>
                  <p>
                    {expense.category} · {formatShortDate(expense.date)}
                  </p>
                </div>
                <strong>-{formatAmount(expense.amount)}</strong>
              </div>
            )) : (
              <p className="muted-copy" style={{ padding: '1rem 0' }}>No expenses yet.</p>
            )}
          </div>
        </article>
      </section>
    </>
  )
}
