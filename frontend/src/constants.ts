import type { View } from './types.ts'

export const navigation: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◫' },
  { id: 'expenses',  label: 'Expenses',  icon: '⟡' },
  { id: 'insights',  label: 'Insights',  icon: '◌' },
  { id: 'budget',    label: 'Budget',    icon: '◈' },
  { id: 'settings',  label: 'Settings',  icon: '◎' },
]

export const expenseCategories = ['All', 'Food', 'Transit', 'Shopping', 'Bills', 'Health']

/**
 * Maps each expense category name to a CSS legend-dot tone class.
 * Used by computeCategoryBreakdown to colour chart legends consistently.
 */
export const CATEGORY_TONES: Record<string, string> = {
  Food:     'teal',
  Transit:  'blue',
  Shopping: 'lavender',
  Bills:    'stone',
  Health:   'teal',
}
