import { useMemo, useState } from 'react'
import { createExpenseDraft, formatAmount, formatShortDate } from '../utils.ts'
import type { ExpenseDraft, ExpenseField, ExpenseRow } from '../types.ts'

export default function ExpensesPage({
  rows,
  isLoading,
  onAdd,
  onUpdate,
  onDelete,
  categories,
}: {
  rows:       ExpenseRow[]
  isLoading:  boolean
  onAdd:      (draft: ExpenseDraft) => Promise<string>
  onUpdate:   (id: string, field: ExpenseField, rawValue: string) => Promise<void>
  onDelete:   (id: string) => Promise<void>
  categories: string[]
}) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest' | 'amount-high' | 'amount-low'>('latest')
  const [editingCell, setEditingCell] = useState<{ id: string; field: ExpenseField } | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [quickAdd, setQuickAdd] = useState<ExpenseDraft>(createExpenseDraft)

  const visibleRows = useMemo(() => {
    const filteredRows =
      activeFilter === 'All' ? rows : rows.filter((row) => row.category.toLowerCase() === activeFilter.toLowerCase())

    return [...filteredRows].sort((first, second) => {
      switch (sortOrder) {
        case 'oldest':
          return new Date(first.date).getTime() - new Date(second.date).getTime()
        case 'amount-high':
          return second.amount - first.amount
        case 'amount-low':
          return first.amount - second.amount
        case 'latest':
        default:
          return new Date(second.date).getTime() - new Date(first.date).getTime()
      }
    })
  }, [activeFilter, rows, sortOrder])

  const startEditing = (row: ExpenseRow, field: ExpenseField) => {
    setEditingCell({ id: row.id, field })
    setDraftValue(field === 'amount' ? String(row.amount) : row[field].toString())
  }

  const commitEdit = () => {
    if (!editingCell) return

    const { id, field } = editingCell
    const value = draftValue

    setEditingCell(null)
    setDraftValue('')

    if (field !== 'amount' && !value.trim()) return
    void onUpdate(id, field, value)
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setDraftValue('')
  }

  const handleQuickAdd = () => {
    if (!quickAdd.description.trim()) return
    onAdd(quickAdd)
      .then(() => setQuickAdd(createExpenseDraft()))
      .catch(error => console.error('[Expenses] Quick-add failed:', error))
  }

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === 'Enter') commitEdit()
    if (event.key === 'Escape') cancelEdit()
  }

  const renderCell = (row: ExpenseRow, field: ExpenseField) => {
    const isEditing = editingCell?.id === row.id && editingCell.field === field

    if (isEditing) {
      if (field === 'category') {
        return (
          <select
            className="cell-editor"
            autoFocus
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleCellKeyDown}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        )
      }

      return (
        <input
          className={`cell-editor ${field === 'amount' ? 'amount' : ''}`}
          autoFocus
          type={field === 'date' ? 'date' : 'text'}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleCellKeyDown}
        />
      )
    }

    const value =
      field === 'amount' ? formatAmount(row.amount) : field === 'date' ? formatShortDate(row.date) : row[field]

    return (
      <button
        type="button"
        className={`cell-button ${field === 'amount' ? 'amount' : ''}`}
        onClick={() => startEditing(row, field)}
      >
        {value}
      </button>
    )
  }

  return (
    <section className="subtle-panel table-card full-width">
      <div className="card-header with-wrap">
        <div>
          <p className="section-kicker">Expense tracker</p>
          <h3>Ledger view</h3>
        </div>
        <div className="table-toolbar">
          <div className="toolbar-row">
            {['All', ...categories].map((category) => (
              <button
                key={category}
                type="button"
                className={`filter-chip ${activeFilter === category ? 'active' : ''}`}
                onClick={() => setActiveFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="table-actions">
            <label className="table-select">
              <span>Sort</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
                <option value="amount-high">Amount high</option>
                <option value="amount-low">Amount low</option>
              </select>
            </label>
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => {
                onAdd(createExpenseDraft())
                  .then(newId => {
                    setEditingCell({ id: newId, field: 'description' })
                    setDraftValue('')
                  })
                  .catch(error => console.error('[Expenses] Add row failed:', error))
              }}
            >
              Add new row
            </button>
          </div>
        </div>
      </div>

      <div className="quick-add-row">
        <span className="quick-add-label">Quick add</span>
        <div className="quick-add-inputs">
          <input
            type="date"
            value={quickAdd.date}
            onChange={(event) => setQuickAdd((current) => ({ ...current, date: event.target.value }))}
          />
          <input
            type="text"
            placeholder="Description"
            value={quickAdd.description}
            onChange={(event) => setQuickAdd((current) => ({ ...current, description: event.target.value }))}
          />
          <select
            value={quickAdd.category}
            onChange={(event) => setQuickAdd((current) => ({ ...current, category: event.target.value }))}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Amount"
            value={quickAdd.amount}
            onChange={(event) => setQuickAdd((current) => ({ ...current, amount: event.target.value }))}
          />
          <button type="button" className="primary-button compact" onClick={handleQuickAdd}>
            Add expense
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5}>
                  <div className="table-loading">Loading expenses…</div>
                </td>
              </tr>
            ) : visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{renderCell(row, 'date')}</td>
                  <td>{renderCell(row, 'description')}</td>
                  <td>{renderCell(row, 'category')}</td>
                  <td>{renderCell(row, 'amount')}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="delete-btn"
                        onClick={() => void onDelete(row.id)}
                        aria-label={`Delete ${row.description}`}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty-table-state">No expenses match this filter yet.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
