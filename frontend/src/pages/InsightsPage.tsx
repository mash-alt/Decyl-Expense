import { useMemo } from 'react'
import { CATEGORY_TONES } from '../constants.ts'
import { computeCategoryBreakdown, computeWeeklyBars, formatAmount, formatAmountShort } from '../utils.ts'
import type { ExpenseRow } from '../types.ts'

export default function InsightsPage({
  rows,
  monthlyBudget,
  aiInsight,
}: {
  rows:          ExpenseRow[]
  monthlyBudget: number
  aiInsight?:    string
}) {
  const { categoryData, weeklyBars, totalSpent, peakBar, topCategory } = useMemo(() => {
    const now = new Date()
    const y   = now.getFullYear()
    const m   = now.getMonth() + 1
    const monthRows = rows.filter(row => {
      const [ry, rm] = row.date.split('-').map(Number)
      return ry === y && rm === m
    })
    const total   = monthRows.reduce((sum, r) => sum + r.amount, 0)
    const catData = computeCategoryBreakdown(monthRows, CATEGORY_TONES)
    const bars    = computeWeeklyBars(rows)
    const peak    = bars.reduce(
      (max, b) => b.total > max.total ? b : max,
      { label: '—', total: 0, height: 0 },
    )
    return { categoryData: catData, weeklyBars: bars, totalSpent: total, peakBar: peak, topCategory: catData[0] ?? null }
  }, [rows])

  // Budget-vs-actual footnote — expected pace for current day of month
  const today        = new Date()
  const daysInMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth   = today.getDate()
  const expectedPace = monthlyBudget > 0
    ? Math.round((monthlyBudget * dayOfMonth) / daysInMonth)
    : 0
  const paceNote = monthlyBudget === 0
    ? 'Set a monthly budget on the Budget page to track spending pace.'
    : totalSpent <= expectedPace
      ? `On pace — ${formatAmount(expectedPace - totalSpent)} under the expected spend for today.`
      : `${formatAmount(totalSpent - expectedPace)} over the expected pace for today.`

  return (
    <section className="insights-grid full-width">
      <article className="subtle-panel chart-card">
        <div className="card-header">
          <div>
            <p className="section-kicker">Category spending</p>
            <h3>Distribution by category</h3>
          </div>
          <span className="badge-pill">This month</span>
        </div>

        <div className="category-ring insights-ring" aria-hidden="true">
          <div className="ring-center">
            <strong>{formatAmountShort(totalSpent)}</strong>
            <span>total spend</span>
          </div>
        </div>

        <div className="legend-list compact-legend">
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

      <article className="subtle-panel chart-card">
        <div className="card-header">
          <div>
            <p className="section-kicker">Weekly spend</p>
            <h3>Daily spending — last 7 days</h3>
          </div>
          <span className="badge-pill">7 days</span>
        </div>
        <div className="bar-chart" aria-hidden="true">
          {weeklyBars.map((bar, index) => (
            <div key={index} className="bar-column">
              <div className="bar-fill" style={{ height: `${bar.height}%` }} />
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
        <p className="chart-footnote">
          {peakBar.total > 0
            ? `Highest day this week: ${formatAmount(peakBar.total)}.`
            : 'No spending recorded in the last 7 days.'}
        </p>
      </article>

      <article className="subtle-panel chart-card budget-graph-card">
        <div className="card-header">
          <div>
            <p className="section-kicker">Budget vs actual</p>
            <h3>Budget vs actual spending</h3>
          </div>
        </div>
        <div className="line-legend">
          <span><i className="legend-line ideal" /> Budget pace</span>
          <span><i className="legend-line actual" /> Actual spend</span>
        </div>
        <div className="line-chart" aria-hidden="true">
          <div className="line ideal" />
          <div className="line actual" />
        </div>
        <p className="chart-footnote">{paceNote}</p>
      </article>

      <article className="subtle-panel insight-panel ai-insight-card">
        <p className="section-kicker">Spending summary</p>
        <h3>
          {topCategory
            ? `${topCategory.label} is your top category this month.`
            : 'No spending recorded this month yet.'}
        </h3>
        {aiInsight ? (
          <p className="muted-copy">{aiInsight}</p>
        ) : (
          <p className="muted-copy">
            {topCategory
              ? `${topCategory.label} accounts for ${topCategory.value} of this month’s total spend.`
              : 'Add expenses to see a breakdown of your spending patterns.'}
          </p>
        )}
        <div className="insight-points">
          <div className="insight-point">
            <strong>Top category</strong>
            <span>
              {topCategory
                ? `${topCategory.label} — ${topCategory.value} of total (${formatAmount(totalSpent)} spent)`
                : 'No data yet'}
            </span>
          </div>
          <div className="insight-point">
            <strong>Budget pace</strong>
            <span>{paceNote}</span>
          </div>
          <div className="insight-point">
            <strong>Monthly progress</strong>
            <span>
              {monthlyBudget > 0
                ? `${formatAmount(totalSpent)} of ${formatAmount(monthlyBudget)} budget used (${Math.min(100, Math.round((totalSpent / monthlyBudget) * 100))}%)`
                : 'Set a budget to track monthly progress.'}
            </span>
          </div>
        </div>
      </article>
    </section>
  )
}
