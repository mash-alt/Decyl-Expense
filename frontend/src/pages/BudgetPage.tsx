import { useEffect, useRef, useState } from 'react'
import { expenseCategories } from '../constants.ts'
import { formatAmount, parseAmount } from '../utils.ts'
import type { BudgetSettings } from '../types.ts'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function BudgetPage({
  monthlyBudget,
  savingsGoal,
  categoryLimits,
  customCategories,
  onSaveBudget,
}: {
  monthlyBudget:    number
  savingsGoal:      number
  categoryLimits:   Record<string, number>
  customCategories: string[]
  onSaveBudget:     (settings: BudgetSettings) => Promise<void>
}) {
  // ── Controlled field state ─────────────────────────────────────────────────
  const [inputBudget,  setInputBudget]  = useState('')
  const [inputSavings, setInputSavings] = useState('')
  const [saveState,    setSaveState]    = useState<SaveState>('idle')

  // Per-category limit editing: null means not editing, string = current input
  const [editingLimit, setEditingLimit]  = useState<Record<string, string>>({})

  // Add-category UI
  const [isAddingCat, setIsAddingCat]   = useState(false)
  const [newCatInput, setNewCatInput]   = useState('')
  const newCatRef                        = useRef<HTMLInputElement>(null)

  // Local copy of custom categories (so additions show before saving)
  const [localCustom, setLocalCustom]   = useState<string[]>(customCategories)

  // Sync from Firestore / App state whenever a fresh subscription value arrives
  useEffect(() => {
    if (saveState !== 'saving') {
      setInputBudget(monthlyBudget  > 0 ? String(monthlyBudget)  : '')
      setInputSavings(savingsGoal   > 0 ? String(savingsGoal)    : '')
    }
  }, [monthlyBudget, savingsGoal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLocalCustom(customCategories)
  }, [customCategories])

  // Focus the new-category input when it appears
  useEffect(() => {
    if (isAddingCat) newCatRef.current?.focus()
  }, [isAddingCat])

  // ── Derived ────────────────────────────────────────────────────────────────
  const parsedBudget  = parseAmount(inputBudget)
  const parsedSavings = parseAmount(inputSavings)
  const isBudgetValid = parsedBudget > 0
  const allCategories = [...expenseCategories.filter(c => c !== 'All'), ...localCustom]

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!isBudgetValid) return
    setSaveState('saving')

    // Merge edited limits with existing ones
    const mergedLimits: Record<string, number> = { ...categoryLimits }
    for (const [cat, raw] of Object.entries(editingLimit)) {
      const v = parseAmount(raw)
      if (v > 0)  mergedLimits[cat] = v
      else        delete mergedLimits[cat]
    }

    const settings: BudgetSettings = {
      monthlyBudget:    parsedBudget,
      savingsGoal:      parsedSavings,
      categoryLimits:   mergedLimits,
      customCategories: localCustom,
    }

    onSaveBudget(settings)
      .then(() => {
        setSaveState('saved')
        setEditingLimit({})
        setTimeout(() => setSaveState('idle'), 2500)
      })
      .catch(() => {
        setSaveState('error')
        setTimeout(() => setSaveState('idle'), 3000)
      })
  }

  const commitNewCategory = () => {
    const name = newCatInput.trim()
    if (name && !allCategories.includes(name)) {
      setLocalCustom(prev => [...prev, name])
    }
    setNewCatInput('')
    setIsAddingCat(false)
  }

  const removeCustomCategory = (cat: string) => {
    setLocalCustom(prev => prev.filter(c => c !== cat))
    setEditingLimit(prev => { const n = { ...prev }; delete n[cat]; return n })
  }

  const startEditLimit = (cat: string) => {
    const existing = categoryLimits[cat] ?? editingLimit[cat] ?? ''
    setEditingLimit(prev => ({
      ...prev,
      [cat]: existing > 0 ? String(existing) : '',
    }))
  }

  const saveLabel =
    saveState === 'saving' ? 'Saving…' :
    saveState === 'saved'  ? '✓ Saved' :
    saveState === 'error'  ? 'Error — retry' :
    'Save settings'

  return (
    <section className="budget-page full-width">

      {/* ── Financial goals ── */}
      <article className="subtle-panel budget-form-card">
        <div className="budget-section-head">
          <div>
            <p className="section-kicker">Budget settings</p>
            <h3>Financial goals</h3>
            <p className="budget-section-copy">Set your monthly plan and savings target below.</p>
          </div>
          <span className="badge-pill">Simple setup</span>
        </div>

        <div className="budget-field-grid">
          <label>
            <span>Monthly budget amount</span>
            <input
              type="text"
              placeholder="e.g. 35000"
              value={inputBudget}
              onChange={e => { setInputBudget(e.target.value); setSaveState('idle') }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </label>
          <label>
            <span>Savings goal</span>
            <input
              type="text"
              placeholder="e.g. 8000"
              value={inputSavings}
              onChange={e => { setInputSavings(e.target.value); setSaveState('idle') }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </label>
          <label>
            <span>Default currency</span>
            <select defaultValue="PHP">
              <option>PHP</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
        </div>

        <div className="budget-note-row">
          <div className="budget-note-card">
            <span>Current plan</span>
            <strong>{monthlyBudget > 0 ? `${formatAmount(monthlyBudget)} monthly cap` : 'No budget set yet'}</strong>
          </div>
          <div className="budget-note-card">
            <span>Savings target</span>
            <strong>{savingsGoal > 0 ? `${formatAmount(savingsGoal)} this month` : 'No target set yet'}</strong>
          </div>
        </div>

        <div className="budget-save-row">
          <button
            type="button"
            className={`primary-button budget-save-btn ${saveState}`}
            onClick={handleSave}
            disabled={!isBudgetValid || saveState === 'saving'}
          >
            {saveLabel}
          </button>
          {saveState === 'idle' && isBudgetValid && (
            <span className="budget-save-hint">
              Budget: {formatAmount(parsedBudget)}{parsedSavings > 0 ? ` · Savings: ${formatAmount(parsedSavings)}` : ''}
            </span>
          )}
        </div>
      </article>

      {/* ── Category limits ── */}
      <article className="subtle-panel budget-form-card category-settings-card">
        <div className="budget-section-head">
          <div>
            <p className="section-kicker">Spending categories</p>
            <h3>Category limits</h3>
            <p className="budget-section-copy">Set a monthly spend cap per category, then hit Save settings above.</p>
          </div>
          <button
            type="button"
            className="secondary-button compact"
            onClick={() => setIsAddingCat(true)}
          >
            Add category
          </button>
        </div>

        {/* Add-category inline row */}
        {isAddingCat && (
          <div className="add-category-row">
            <input
              ref={newCatRef}
              type="text"
              className="add-category-input"
              placeholder="Category name…"
              value={newCatInput}
              onChange={e => setNewCatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitNewCategory()
                if (e.key === 'Escape') { setIsAddingCat(false); setNewCatInput('') }
              }}
            />
            <button type="button" className="primary-button compact"  onClick={commitNewCategory}>Add</button>
            <button type="button" className="secondary-button compact" onClick={() => { setIsAddingCat(false); setNewCatInput('') }}>Cancel</button>
          </div>
        )}

        <div className="category-settings-list">
          {allCategories.map(category => {
            const isEditing  = category in editingLimit
            const savedLimit = categoryLimits[category] ?? 0
            const isCustom   = localCustom.includes(category)

            return (
              <div key={category} className={`category-setting-item ${isEditing ? 'limit-editing' : ''}`}>
                <div>
                  <strong>{category}{isCustom ? ' ✦' : ''}</strong>
                  {isEditing ? (
                    <input
                      type="text"
                      className="category-limit-input"
                      placeholder="Limit amount…"
                      value={editingLimit[category]}
                      onChange={e => setEditingLimit(prev => ({ ...prev, [category]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                      autoFocus
                    />
                  ) : (
                    <p>{savedLimit > 0 ? `Limit: ${formatAmount(savedLimit)}` : 'No limit set'}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {isEditing ? (
                    <button
                      type="button"
                      className="secondary-button compact"
                      onClick={() => setEditingLimit(prev => { const n = { ...prev }; delete n[category]; return n })}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button compact"
                      onClick={() => startEditLimit(category)}
                    >
                      {savedLimit > 0 ? 'Edit limit' : 'Set limit'}
                    </button>
                  )}
                  {isCustom && (
                    <button
                      type="button"
                      className="secondary-button compact danger"
                      onClick={() => removeCustomCategory(category)}
                      title="Remove this custom category"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {Object.keys(editingLimit).length > 0 && (
          <p className="budget-save-hint" style={{ marginTop: '0.5rem' }}>
            Unsaved limit changes — hit <strong>Save settings</strong> above to persist them.
          </p>
        )}
      </article>

    </section>
  )
}
