import {
  collection,
  serverTimestamp,
  Timestamp,
  type CollectionReference,
} from 'firebase/firestore'
import { db } from './firebaseConfig.ts'
import type {
  ExpenseDocument,
  ExpenseWritePayload,
  BudgetDocument,
  BudgetWritePayload,
} from './firestoreTypes.ts'

// ─── Collection References ────────────────────────────────────────────────────

/**
 * Typed reference to the `expenses` Firestore collection.
 * Pass directly to `addDoc`, `getDocs`, `onSnapshot`, `query`, etc.
 *
 * @example
 * const snap = await getDocs(expensesCollection)
 */
export const expensesCollection = collection(
  db,
  'expenses',
) as CollectionReference<ExpenseDocument>

/**
 * Typed reference to the `budgets` Firestore collection.
 * Pass directly to `addDoc`, `getDocs`, `onSnapshot`, `query`, etc.
 *
 * @example
 * const snap = await getDocs(budgetsCollection)
 */
export const budgetsCollection = collection(
  db,
  'budgets',
) as CollectionReference<BudgetDocument>

// ─── Timestamp Utilities ──────────────────────────────────────────────────────

/**
 * Returns a Firestore server-side timestamp sentinel.
 *
 * Always use `now()` for `createdAt` on write — it relies on the Firestore
 * server clock rather than the potentially-skewed client clock.
 *
 * @example
 * createdAt: now()
 */
export const now = () => serverTimestamp()

/**
 * Converts a JavaScript `Date` to a Firestore `Timestamp`.
 * Use for user-supplied date fields such as the expense's `date`.
 *
 * @example
 * date: toTimestamp(new Date('2026-03-10'))
 */
export const toTimestamp = (date: Date): Timestamp => Timestamp.fromDate(date)

/**
 * Converts a Firestore `Timestamp` back to a JavaScript `Date`.
 * Use when reading timestamp fields from Firestore documents.
 *
 * @example
 * const jsDate = toDate(expenseDoc.date)
 */
export const toDate = (ts: Timestamp): Date => ts.toDate()

// ─── Document Payload Builders ────────────────────────────────────────────────

/**
 * Builds a write payload for the `expenses` collection.
 *
 * - Accepts a plain JS `Date` for the `date` field and converts it to a
 *   Firestore `Timestamp`.
 * - Automatically appends `serverTimestamp()` for `createdAt`.
 *
 * @example
 * const payload = buildExpensePayload({
 *   description: 'Grocery run',
 *   category:    'Food',
 *   amount:      42.50,
 *   date:        new Date('2026-03-10'),
 * })
 * await addDoc(expensesCollection, payload)
 */
export function buildExpensePayload(data: {
  description: string
  category:    string
  amount:      number
  date:        Date
}): ExpenseWritePayload {
  return {
    description: data.description,
    category:    data.category,
    amount:      data.amount,
    date:        Timestamp.fromDate(data.date),
    createdAt:   serverTimestamp(),
  }
}

/**
 * Builds a write payload for the `budgets` collection.
 *
 * - Automatically appends `serverTimestamp()` for `createdAt`.
 *
 * @example
 * const payload = buildBudgetPayload({ monthlyBudget: 1500 })
 * await addDoc(budgetsCollection, payload)
 */
export function buildBudgetPayload(data: {
  monthlyBudget:    number
  savingsGoal:      number
  categoryLimits:   Record<string, number>
  customCategories: string[]
}): BudgetWritePayload {
  return {
    monthlyBudget:    data.monthlyBudget,
    savingsGoal:      data.savingsGoal,
    categoryLimits:   data.categoryLimits,
    customCategories: data.customCategories,
    createdAt:        serverTimestamp(),
  }
}
