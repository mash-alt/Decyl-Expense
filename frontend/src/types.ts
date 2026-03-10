export type View = 'dashboard' | 'expenses' | 'insights' | 'budget' | 'settings'
export type ExpenseField = 'date' | 'description' | 'category' | 'amount'

export type ExpenseRow = {
  id: string
  date: string
  description: string
  category: string
  amount: number
}

export type ExpenseDraft = {
  date: string
  description: string
  category: string
  amount: string
}

export type BudgetSettings = {
  monthlyBudget:    number
  savingsGoal:      number
  categoryLimits:   Record<string, number>
  customCategories: string[]
}
