import type { Timestamp, FieldValue } from 'firebase/firestore'

// ─── expenses/{expenseId} ────────────────────────────────────────────────────
//
//  description  string     Human-readable label, e.g. "Grocery run"
//  category     string     Matches one of the app's category constants
//  amount       number     Positive decimal, e.g. 42.50
//  date         Timestamp  User-selected date of the expense
//  createdAt    Timestamp  Server-generated write time

/** Shape of an expense document as returned by Firestore on read. */
export interface ExpenseDocument {
  description: string
  category:    string
  amount:      number
  date:        Timestamp
  createdAt:   Timestamp
}

/**
 * Shape used when writing a new expense document.
 * `createdAt` must be a `serverTimestamp()` FieldValue sentinel so the server
 * sets the authoritative write time — never supply a client `Date` here.
 */
export type ExpenseWritePayload = Omit<ExpenseDocument, 'createdAt'> & {
  createdAt: FieldValue
}

// ─── budgets/{budgetId} ──────────────────────────────────────────────────────
//
//  monthlyBudget  number     Total monthly spending limit
//  createdAt      Timestamp  Server-generated write time

/** Shape of a budget document as returned by Firestore on read. */
export interface BudgetDocument {
  monthlyBudget:    number
  savingsGoal:      number
  categoryLimits:   Record<string, number>
  customCategories: string[]
  createdAt:        Timestamp
}

/**
 * Shape used when writing a new budget document.
 * `createdAt` must be a `serverTimestamp()` FieldValue sentinel.
 */
export type BudgetWritePayload = Omit<BudgetDocument, 'createdAt'> & {
  createdAt: FieldValue
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Attaches a Firestore document ID to any document type.
 * Use this when mapping `QueryDocumentSnapshot` results to typed objects.
 *
 * @example
 * const expense: WithId<ExpenseDocument> = { id: snap.id, ...snap.data() }
 */
export type WithId<T> = T & { id: string }
