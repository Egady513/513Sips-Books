import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCreateRecurringTemplate, useUpdateRecurringTemplate } from '../../hooks/useRecurringExpenses'
import { getScheduleCLine } from '../../utils/taxCalc'
import Modal from './Modal'
import Button from './Button'
import { EXPENSE_CATEGORIES, RECURRING_FREQUENCIES } from '../../lib/constants'
import type { RecurringExpenseTemplate } from '../../lib/types'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  editTemplate?: RecurringExpenseTemplate | null
}

export default function RecurringExpenseModal({ open, onClose, editTemplate }: Props) {
  const [logInitialNow, setLogInitialNow] = useState(false)
  const [limitOccurrences, setLimitOccurrences] = useState(false)
  const createTemplate = useCreateRecurringTemplate()
  const updateTemplate = useUpdateRecurringTemplate()
  const isEditing = !!editTemplate

  function handleClose() {
    setLogInitialNow(false)
    setLimitOccurrences(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const category = fd.get('category') as string
    const isTaxDeductible = fd.get('is_tax_deductible') === 'on'
    const frequency = fd.get('frequency') as RecurringExpenseTemplate['frequency']
    const occurrencesRemaining = limitOccurrences && fd.get('occurrences_remaining')
      ? parseInt(fd.get('occurrences_remaining') as string, 10)
      : undefined

    const payload = {
      description: fd.get('description') as string,
      category,
      amount: parseFloat(fd.get('amount') as string),
      frequency,
      vendor: (fd.get('vendor') as string) || undefined,
      is_tax_deductible: isTaxDeductible,
      next_due_date: fd.get('next_due_date') as string,
      is_active: true,
      occurrences_remaining: occurrencesRemaining,
      notes: (fd.get('notes') as string) || undefined,
    }

    try {
      if (isEditing) {
        await updateTemplate.mutateAsync({ id: editTemplate.id, ...payload })
        toast.success('Recurring template updated')
      } else {
        await createTemplate.mutateAsync(payload)

        if (logInitialNow) {
          const initialAmount = parseFloat(fd.get('initial_amount') as string || String(payload.amount))
          const initialDate = (fd.get('initial_date') as string) || new Date().toISOString().split('T')[0]
          const { error } = await supabase.from('expenses').insert([{
            description: payload.description,
            category: payload.category,
            amount: initialAmount,
            expense_date: initialDate,
            vendor: payload.vendor,
            is_tax_deductible: payload.is_tax_deductible,
            schedule_c_line: payload.is_tax_deductible ? getScheduleCLine(payload.category) : undefined,
            notes: 'Initial payment for recurring template',
          }])
          if (error) throw error
        }
        toast.success('Recurring template created' + (logInitialNow ? ' — initial payment logged' : ''))
      }
      handleClose()
    } catch {
      toast.error('Something went wrong')
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventBackdropClose
      title={isEditing ? 'Edit Recurring Expense' : 'New Recurring Expense'}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Description *</label>
            <input name="description" required
              defaultValue={editTemplate?.description || ''}
              placeholder="e.g. Liquor liability insurance"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Recurring Amount ($) *</label>
            <input name="amount" type="number" step="0.01" required
              defaultValue={editTemplate ? String(editTemplate.amount) : ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Category *</label>
            <select name="category" required
              defaultValue={editTemplate?.category || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
              <option value="" disabled>Select…</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} (Line {c.scheduleCLine})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Frequency *</label>
            <select name="frequency" required
              defaultValue={editTemplate?.frequency || 'monthly'}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
              {RECURRING_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Vendor</label>
            <input name="vendor"
              defaultValue={editTemplate?.vendor || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">
              {logInitialNow ? 'Next Due Date (after initial payment) *' : 'Next Due Date *'}
            </label>
            <input name="next_due_date" type="date" required
              defaultValue={editTemplate?.next_due_date || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-cream/50 mb-1">Notes</label>
          <textarea name="notes" rows={2} defaultValue={editTemplate?.notes || ''}
            className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
        </div>

        <label className="flex items-center gap-3 text-sm text-cream/70 cursor-pointer p-3 bg-navy-lighter rounded-lg border border-gold-dim hover:border-gold/40 transition-colors">
          <input type="checkbox" name="is_tax_deductible"
            defaultChecked={editTemplate ? editTemplate.is_tax_deductible : true}
            className="w-4 h-4 rounded accent-gold" />
          <div>
            <span className="font-medium text-cream">Tax write-off</span>
            <p className="text-xs text-cream/40 mt-0.5">Every expense logged from this template inherits this setting</p>
          </div>
        </label>

        <label className="flex items-center gap-3 text-sm text-cream/70 cursor-pointer p-3 bg-navy-lighter rounded-lg border border-gold-dim hover:border-gold/40 transition-colors">
          <input type="checkbox" checked={limitOccurrences}
            onChange={e => setLimitOccurrences(e.target.checked)}
            className="w-4 h-4 rounded accent-gold" />
          <div>
            <span className="font-medium text-cream">Stops after a set number of payments</span>
            <p className="text-xs text-cream/40 mt-0.5">e.g. an annual plan billed in 10 remaining monthly installments. Template auto-deactivates when it hits zero.</p>
          </div>
        </label>
        {limitOccurrences && (
          <div className="p-3 bg-navy-lighter rounded-lg border border-gold/30">
            <label className="block text-xs text-cream/50 mb-1">Remaining payments (not counting an initial payment below)</label>
            <input name="occurrences_remaining" type="number" min="1" step="1" required={limitOccurrences}
              defaultValue={editTemplate?.occurrences_remaining ? String(editTemplate.occurrences_remaining) : ''}
              className="w-full sm:w-40 bg-navy border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
        )}

        {!isEditing && (
          <>
            <label className="flex items-center gap-3 text-sm text-cream/70 cursor-pointer p-3 bg-navy-lighter rounded-lg border border-gold-dim hover:border-gold/40 transition-colors">
              <input type="checkbox" checked={logInitialNow}
                onChange={e => setLogInitialNow(e.target.checked)}
                className="w-4 h-4 rounded accent-gold" />
              <div>
                <span className="font-medium text-cream">Log an initial payment right now</span>
                <p className="text-xs text-cream/40 mt-0.5">For plans where the first bill differs from the recurring amount (e.g. first + last month prepaid together)</p>
              </div>
            </label>
            {logInitialNow && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-navy-lighter rounded-lg border border-gold/30">
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Initial Payment Amount ($)</label>
                  <input name="initial_amount" type="number" step="0.01"
                    placeholder="Defaults to recurring amount"
                    className="w-full bg-navy border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Initial Payment Date</label>
                  <input name="initial_date" type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-navy border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">{isEditing ? 'Save Changes' : 'Create Template'}</Button>
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
