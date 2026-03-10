import type { ExpenseDraft, ExpenseRow } from './types.ts'

export function formatAmount(amount: number) {
  return `₱${amount.toLocaleString()}`
}

export function formatAmountShort(amount: number): string {
  if (amount >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}m`
  if (amount >= 1_000)     return `₱${(amount / 1_000).toFixed(1)}k`
  return `₱${amount.toLocaleString()}`
}

export function parseAmount(value: string) {
  const normalized = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(normalized) ? normalized : 0
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
  }).format(new Date(date))
}

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function createExpenseDraft(): ExpenseDraft {
  return {
    date: getTodayIsoDate(),
    description: '',
    category: 'Food',
    amount: '',
  }
}

export function createExpenseRow(draft: ExpenseDraft): ExpenseRow {
  return {
    id: crypto.randomUUID(),
    date: draft.date,
    description: draft.description.trim() || 'New expense',
    category: draft.category,
    amount: parseAmount(draft.amount),
  }
}

/**
 * Computes real category breakdown percentages from a list of expense rows.
 * Returns entries sorted by amount descending.
 */
export function computeCategoryBreakdown(
  rows:  ExpenseRow[],
  tones: Record<string, string>,
): { label: string; value: string; tone: string }[] {
  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  if (total === 0) return []
  const byCategory = new Map<string, number>()
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount)
  }
  return [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({
      label,
      value: `${Math.round((amount / total) * 100)}%`,
      tone:  tones[label] ?? 'stone',
    }))
}

/**
 * Returns daily spending bars for the last 7 days (oldest → newest).
 * Heights are scaled relative to the highest-spend day (min 6% for visibility).
 */
export function computeWeeklyBars(
  rows: ExpenseRow[],
): { height: number; label: string; total: number }[] {
  const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const today = new Date()

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { iso, label: DAY_LABELS[d.getDay()] }
  })

  const totals = days.map(({ iso, label }) => ({
    total: rows.filter(r => r.date === iso).reduce((sum, r) => sum + r.amount, 0),
    label,
  }))

  const max = Math.max(...totals.map(d => d.total), 1)
  return totals.map(d => ({
    height: d.total > 0 ? Math.max(6, Math.round((d.total / max) * 100)) : 6,
    label:  d.label,
    total:  d.total,
  }))
}
