import {
  setDoc,
  getDoc,
  onSnapshot,
  doc,
  Timestamp,
} from 'firebase/firestore'
import {
  buildBudgetPayload,
  getUserBudgetsCollection,
} from '../firebase/firestore.ts'

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Clean budget object returned by all read/write operations. */
export type BudgetData = {
  id:               string
  monthlyBudget:    number
  savingsGoal:      number
  categoryLimits:   Record<string, number>
  customCategories: string[]
  /** Server-authoritative write time. */
  createdAt:        Date
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Fixed document ID used for the single monthly-budget document.
 * The app maintains exactly one active budget at a time; using a predictable
 * ID avoids a collection scan on every read and makes updates idempotent.
 */
const BUDGET_DOC_ID = 'current'

// ─── Service Functions ────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reads the optional extended fields from a Firestore budget document safely. */
function parseBudgetData(id: string, data: Record<string, unknown>): BudgetData {
  return {
    id,
    monthlyBudget:    typeof data.monthlyBudget    === 'number' ? data.monthlyBudget    : 0,
    savingsGoal:      typeof data.savingsGoal      === 'number' ? data.savingsGoal      : 0,
    categoryLimits:   (data.categoryLimits   != null && typeof data.categoryLimits   === 'object' && !Array.isArray(data.categoryLimits))
                        ? (data.categoryLimits as Record<string, number>)
                        : {},
    customCategories: Array.isArray(data.customCategories)
                        ? (data.customCategories as string[])
                        : [],
    createdAt:        data.createdAt instanceof Timestamp
                        ? data.createdAt.toDate()
                        : new Date(),
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Creates or replaces the full budget-settings document.
 *
 * @param settings  Full budget settings to persist.
 */
export async function saveBudgetSettings(uid: string, settings: {
  monthlyBudget:    number
  savingsGoal:      number
  categoryLimits:   Record<string, number>
  customCategories: string[]
}): Promise<BudgetData> {
  try {
    const col     = getUserBudgetsCollection(uid)
    const docRef  = doc(col, BUDGET_DOC_ID)
    const payload = buildBudgetPayload(settings)
    await setDoc(docRef, payload)

    return {
      id:               BUDGET_DOC_ID,
      monthlyBudget:    settings.monthlyBudget,
      savingsGoal:      settings.savingsGoal,
      categoryLimits:   settings.categoryLimits,
      customCategories: settings.customCategories,
      createdAt:        new Date(),
    }
  } catch (error) {
    throw new Error(`saveBudgetSettings failed: ${(error as Error).message}`)
  }
}

/**
 * Fetches the current budget-settings document once.
 *
 * @returns `BudgetData` if a budget has been set, or `null` if none exists yet.
 */
export async function getMonthlyBudget(uid: string): Promise<BudgetData | null> {
  try {
    const col    = getUserBudgetsCollection(uid)
    const docRef = doc(col, BUDGET_DOC_ID)
    const snap   = await getDoc(docRef)
    if (!snap.exists()) return null
    return parseBudgetData(snap.id, snap.data() as unknown as Record<string, unknown>)
  } catch (error) {
    throw new Error(`getMonthlyBudget failed: ${(error as Error).message}`)
  }
}

/**
 * Opens a real-time Firestore listener on the single `budgets/current` document.
 *
 * The callback fires immediately with the current budget and again whenever
 * `setMonthlyBudget` writes a new value, so the dashboard and budget page
 * stay in sync without manual re-fetching.
 *
 * @param onData   Receives the latest `BudgetData`, or `null` if none exists.
 * @param onError  Optional error handler; defaults to `console.error`.
 * @returns        Unsubscribe function — call it to detach the listener.
 */
export function subscribeToMonthlyBudget(
  uid:      string,
  onData:   (budget: BudgetData | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const col    = getUserBudgetsCollection(uid)
  const docRef = doc(col, BUDGET_DOC_ID)

  return onSnapshot(
    docRef,
    snap => {
      if (!snap.exists()) {
        onData(null)
        return
      }
      onData(parseBudgetData(snap.id, snap.data() as unknown as Record<string, unknown>))
    },
    error => {
      if (onError) onError(error)
      else console.error('[subscribeToMonthlyBudget] Listener error:', error)
    },
  )
}
