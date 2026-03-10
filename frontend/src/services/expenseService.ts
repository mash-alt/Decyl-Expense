import {
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import {
  expensesCollection,
  buildExpensePayload,
} from '../firebase/firestore.ts'

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Clean expense object returned by all read/write operations. */
export type ExpenseData = {
  id:          string
  description: string
  category:    string
  amount:      number
  /** User-selected date of the expense. */
  date:        Date
  /** Server-authoritative write time. */
  createdAt:   Date
}

/** Input accepted by addExpense. */
export type AddExpenseInput = {
  description: string
  category:    string
  amount:      number
  date:        Date
}

/**
 * Partial input accepted by updateExpense.
 * Only the fields provided will be written; omitted fields are untouched.
 */
export type UpdateExpenseInput = Partial<AddExpenseInput>

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Converts a raw Firestore document snapshot to a clean `ExpenseData` object.
 * Guards against non-Timestamp values on both `date` and `createdAt` —
 * this can happen right after a serverTimestamp() write before the server
 * resolves the sentinel, or when a document was written with a plain string/Date.
 */
function toExpenseData(
  id:   string,
  data: Record<string, unknown>,
): ExpenseData {
  const resolveDate = (value: unknown, fallback: Date): Date => {
    if (value instanceof Timestamp) return value.toDate()
    if (value instanceof Date)      return value
    if (typeof value === 'string' && value.length > 0) {
      const d = new Date(value)
      return isNaN(d.getTime()) ? fallback : d
    }
    if (typeof value === 'number') return new Date(value)
    return fallback
  }

  return {
    id,
    description: typeof data.description === 'string' ? data.description : '',
    category:    typeof data.category    === 'string' ? data.category    : '',
    amount:      typeof data.amount      === 'number' ? data.amount      : 0,
    date:        resolveDate(data.date,      new Date()),
    createdAt:   resolveDate(data.createdAt, new Date()),
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Adds a new expense document to the `expenses` collection.
 *
 * @returns The newly created expense with its Firestore-generated `id`.
 *          `createdAt` is a client-side approximation; the server timestamp
 *          is authoritative and will be returned on the next `getExpenses()`.
 * @throws  Re-throws Firestore errors with a descriptive message.
 */
export async function addExpense(expense: AddExpenseInput): Promise<ExpenseData> {
  try {
    const payload = buildExpensePayload(expense)
    const docRef  = await addDoc(expensesCollection, payload)

    return {
      id:          docRef.id,
      description: expense.description,
      category:    expense.category,
      amount:      expense.amount,
      date:        expense.date,
      createdAt:   new Date(), // server timestamp resolves on next read
    }
  } catch (error) {
    throw new Error(`addExpense failed: ${(error as Error).message}`)
  }
}

/**
 * Fetches all expenses sorted by `date` descending (most recent first).
 *
 * @returns Array of `ExpenseData` objects. Returns an empty array if the
 *          collection is empty.
 * @throws  Re-throws Firestore errors with a descriptive message.
 */
export async function getExpenses(): Promise<ExpenseData[]> {
  try {
    const q    = query(expensesCollection, orderBy('date', 'desc'))
    const snap = await getDocs(q)

    return snap.docs.map(docSnap =>
      toExpenseData(docSnap.id, docSnap.data() as unknown as Record<string, unknown>),
    )
  } catch (error) {
    throw new Error(`getExpenses failed: ${(error as Error).message}`)
  }
}

/**
 * Opens a real-time Firestore listener on the `expenses` collection,
 * sorted by `date` descending.
 *
 * The callback fires immediately with the current collection state and again
 * on every add, update, or delete — no manual re-fetching required.
 *
 * @param onData   Receives the latest expense array on every snapshot.
 * @param onError  Optional error handler; defaults to `console.error`.
 * @returns        Unsubscribe function — call it to detach the listener.
 *
 * @example
 * const unsubscribe = subscribeToExpenses(
 *   items => setRows(items),
 *   err   => console.error(err),
 * )
 * // later
 * unsubscribe()
 */
export function subscribeToExpenses(
  onData:   (expenses: ExpenseData[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(expensesCollection, orderBy('date', 'desc'))

  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(docSnap =>
        toExpenseData(docSnap.id, docSnap.data() as unknown as Record<string, unknown>),
      )
      onData(items)
    },
    error => {
      if (onError) onError(error)
      else console.error('[subscribeToExpenses] Listener error:', error)
    },
  )
}

/**
 * Only fields present in `updatedData` are written; all others remain unchanged.
 * If a `date` is provided it is converted to a Firestore `Timestamp` automatically.
 *
 * @param id          Firestore document ID of the expense to update.
 * @param updatedData Fields to overwrite (at least one must be provided).
 * @throws Re-throws Firestore errors with a descriptive message.
 */
export async function updateExpense(
  id:          string,
  updatedData: UpdateExpenseInput,
): Promise<void> {
  try {
    if (Object.keys(updatedData).length === 0) return

    const docRef = doc(expensesCollection, id)

    // Build a typed patch — only include keys that were actually supplied
    const patch: {
      description?: string
      category?:    string
      amount?:      number
      date?:        Timestamp
    } = {}

    if (updatedData.description !== undefined) patch.description = updatedData.description
    if (updatedData.category    !== undefined) patch.category    = updatedData.category
    if (updatedData.amount      !== undefined) patch.amount      = updatedData.amount
    if (updatedData.date        !== undefined) patch.date        = Timestamp.fromDate(updatedData.date)

    await updateDoc(docRef, patch)
  } catch (error) {
    throw new Error(`updateExpense failed: ${(error as Error).message}`)
  }
}

/**
 * Permanently deletes an expense document.
 *
 * @param id Firestore document ID of the expense to delete.
 * @throws   Re-throws Firestore errors with a descriptive message.
 */
export async function deleteExpense(id: string): Promise<void> {
  try {
    await deleteDoc(doc(expensesCollection, id))
  } catch (error) {
    throw new Error(`deleteExpense failed: ${(error as Error).message}`)
  }
}
