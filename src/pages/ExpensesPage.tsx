import { useState, useRef } from 'react'
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense, useUploadReceipt, useMileage, useCreateMileage, useDeleteMileage } from '../hooks/useExpenses'
import { useEvents } from '../hooks/useEvents'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate, getCurrentYear } from '../utils/formatters'
import { EXPENSE_CATEGORIES, MILEAGE_RATES } from '../lib/constants'
import { getScheduleCLine } from '../utils/taxCalc'
import { Plus, Receipt, Car, Trash2, Paperclip, ExternalLink, Edit2 } from 'lucide-react'
import type { Expense } from '../lib/types'
import toast from 'react-hot-toast'

export default function ExpensesPage() {
  const [year] = useState(getCurrentYear())
  const [tab, setTab] = useState<'expenses' | 'mileage'>('expenses')
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'event' | 'general'>('all')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [showMileageForm, setShowMileageForm] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const { data: expenses, isLoading: loadingExpenses } = useExpenses(year)
  const { data: mileage, isLoading: loadingMileage } = useMileage(year)
  const { data: events } = useEvents()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const uploadReceipt = useUploadReceipt()
  const createMileage = useCreateMileage()
  const deleteMileage = useDeleteMileage()

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
  const totalMiles = (mileage || []).reduce((s, m) => s + Number(m.miles), 0)
  const totalMileageDeduction = (mileage || []).reduce((s, m) => s + Number(m.deduction_amount), 0)

  // Sprint 5: filter expenses
  const filteredExpenses = (expenses || []).filter(exp => {
    if (expenseFilter === 'event') return !!exp.event_id
    if (expenseFilter === 'general') return !exp.event_id
    return true
  })

  async function handleReceiptUpload(expenseId: string, file: File) {
    try {
      await uploadReceipt.mutateAsync({ file, expenseId })
    } catch {
      // toast handled by mutation or silently fail
    }
  }

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const category = fd.get('category') as string
    const isTaxDeductible = fd.get('is_tax_deductible') === 'on'
    const payload = {
      event_id: (fd.get('event_id') as string) || undefined,
      description: fd.get('description') as string,
      category,
      amount: parseFloat(fd.get('amount') as string),
      expense_date: fd.get('expense_date') as string,
      vendor: (fd.get('vendor') as string) || undefined,
      is_tax_deductible: isTaxDeductible,
      schedule_c_line: isTaxDeductible ? getScheduleCLine(category) : undefined,
      notes: (fd.get('notes') as string) || undefined,
    }
    try {
      if (editExpense) {
        await updateExpense.mutateAsync({ id: editExpense.id, ...payload })
        toast.success('Expense updated')
        setEditExpense(null)
      } else {
        await createExpense.mutateAsync(payload)
        toast.success('Expense logged')
        setShowExpenseForm(false)
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const handleCreateMileage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const miles = parseFloat(fd.get('miles') as string)
    const rate = MILEAGE_RATES[year] || 0.70
    await createMileage.mutateAsync({
      event_id: fd.get('event_id') as string || undefined,
      trip_date: fd.get('trip_date') as string,
      from_location: fd.get('from_location') as string,
      to_location: fd.get('to_location') as string,
      miles,
      purpose: fd.get('purpose') as string,
      rate_per_mile: rate,
    })
    setShowMileageForm(false)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gold">Expenses & Write-offs</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowMileageForm(true)}>
            <Car size={16} /> Log Mileage
          </Button>
          <Button onClick={() => setShowExpenseForm(true)}>
            <Plus size={16} /> New Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} color="text-danger" />
        <StatCard label="Expense Count" value={String(expenses?.length || 0)} color="text-gold" />
        <StatCard label="Total Miles" value={`${totalMiles.toFixed(1)} mi`} color="text-info" />
        <StatCard label="Mileage Deduction" value={formatCurrency(totalMileageDeduction)} color="text-success" />
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab('expenses')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'expenses' ? 'bg-gold text-navy' : 'bg-navy-lighter text-cream/60'}`}>
          <Receipt size={14} className="inline mr-1" /> Expenses
        </button>
        <button onClick={() => setTab('mileage')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'mileage' ? 'bg-gold text-navy' : 'bg-navy-lighter text-cream/60'}`}>
          <Car size={14} className="inline mr-1" /> Mileage
        </button>
      </div>

      {/* Sprint 5: Expense type filter (only shown on expenses tab) */}
      {tab === 'expenses' && (
        <div className="flex gap-2">
          {(['all', 'event', 'general'] as const).map(f => (
            <button
              key={f}
              onClick={() => setExpenseFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                expenseFilter === f
                  ? 'bg-gold/20 text-gold border border-gold/30'
                  : 'bg-white/5 text-cream/50 hover:text-cream border border-transparent'
              }`}
            >
              {f === 'all' ? 'All' : f === 'event' ? 'Event Expenses' : 'General Expenses'}
            </button>
          ))}
        </div>
      )}

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        loadingExpenses ? (
          <div className="text-cream/50 text-center py-12">Loading...</div>
        ) : !filteredExpenses.length ? (
          <Card className="text-center py-12 text-cream/50">No expenses logged yet</Card>
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map(exp => (
              <Card key={exp.id} className="hover:border-gold/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-cream">{exp.description}</span>
                      {exp.is_tax_deductible ? (
                        <span className="text-xs px-2 py-0.5 bg-success/20 text-success rounded">✓ Write-off</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-cream/10 text-cream/40 rounded">Not deductible</span>
                      )}
                      {exp.event_id && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">Event</span>
                      )}
                    </div>
                    <div className="text-sm text-cream/50">
                      {formatDate(exp.expense_date)}
                      {exp.vendor && <span> • {exp.vendor}</span>}
                      {exp.category && <span> • {EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}</span>}
                      {exp.schedule_c_line && <span className="text-cream/30"> (Line {exp.schedule_c_line})</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-danger">{formatCurrency(exp.amount)}</span>
                    {/* Sprint 5: Receipt upload */}
                    {exp.receipt_url ? (
                      <a
                        href={exp.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold/60 hover:text-gold transition-colors p-1"
                        title="View receipt"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          ref={el => { fileInputRefs.current[exp.id] = el }}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleReceiptUpload(exp.id, file)
                          }}
                        />
                        <button
                          onClick={() => fileInputRefs.current[exp.id]?.click()}
                          className="text-cream/30 hover:text-gold transition-colors p-1"
                          title="Upload receipt"
                        >
                          <Paperclip size={14} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setEditExpense(exp)}
                      className="text-cream/30 hover:text-gold transition-colors p-1.5 rounded"
                      title="Edit expense"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this expense?')) deleteExpense.mutate(exp.id) }}
                      className="text-cream/30 hover:text-red-400 transition-colors p-1.5 rounded"
                      title="Delete expense"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Mileage Tab */}
      {tab === 'mileage' && (
        loadingMileage ? (
          <div className="text-cream/50 text-center py-12">Loading...</div>
        ) : !mileage?.length ? (
          <Card className="text-center py-12 text-cream/50">No mileage logged yet</Card>
        ) : (
          <div className="space-y-3">
            {mileage.map(m => (
              <Card key={m.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-cream">
                      {m.from_location || '?'} → {m.to_location || '?'}
                    </div>
                    <div className="text-sm text-cream/50">
                      {formatDate(m.trip_date)} • {m.miles} miles @ ${m.rate_per_mile}/mi
                      {m.purpose && <span> • {m.purpose}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-success">{formatCurrency(m.deduction_amount)}</span>
                    <button
                      onClick={() => { if (confirm('Delete this mileage entry?')) deleteMileage.mutate(m.id) }}
                      className="text-cream/30 hover:text-red-400 transition-colors p-1.5 rounded"
                      title="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* New / Edit Expense Modal — shares the same form */}
      {(showExpenseForm || !!editExpense) && (
        <Modal
          open={showExpenseForm || !!editExpense}
          onClose={() => { setShowExpenseForm(false); setEditExpense(null) }}
          title={editExpense ? 'Edit Expense' : 'New Expense'}
          wide
        >
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-cream/50 mb-1">Description *</label>
                <input name="description" required defaultValue={editExpense?.description || ''}
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Amount ($) *</label>
                <input name="amount" type="number" step="0.01" required defaultValue={editExpense ? String(editExpense.amount) : ''}
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Date *</label>
                <input name="expense_date" type="date" required defaultValue={editExpense?.expense_date || new Date().toISOString().split('T')[0]}
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Category *</label>
                <select name="category" required defaultValue={editExpense?.category || ''}
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} (Line {c.scheduleCLine})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Vendor / Store</label>
                <input name="vendor" defaultValue={editExpense?.vendor || ''}
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Link to Event</label>
                <select name="event_id" defaultValue={editExpense?.event_id || ''}
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                  <option value="">None</option>
                  {events?.map(ev => <option key={ev.id} value={ev.id}>{ev.client_name} - {formatDate(ev.event_date)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Notes</label>
              <textarea name="notes" rows={2} defaultValue={editExpense?.notes || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <label className="flex items-center gap-3 text-sm text-cream/70 cursor-pointer p-3 bg-navy-lighter rounded-lg border border-gold-dim hover:border-gold/40 transition-colors">
              <input
                type="checkbox"
                name="is_tax_deductible"
                defaultChecked={editExpense ? editExpense.is_tax_deductible : true}
                className="w-4 h-4 rounded accent-gold"
              />
              <div>
                <span className="font-medium text-cream">Tax write-off</span>
                <p className="text-xs text-cream/40 mt-0.5">Check if this is a deductible business expense (appears on Schedule C)</p>
              </div>
            </label>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">{editExpense ? 'Save Changes' : 'Add Expense'}</Button>
              <Button type="button" variant="secondary" onClick={() => { setShowExpenseForm(false); setEditExpense(null) }}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Mileage Modal */}
      <Modal open={showMileageForm} onClose={() => setShowMileageForm(false)} title="Log Mileage">
        <form onSubmit={handleCreateMileage} className="space-y-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Trip Date *</label>
            <input name="trip_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">From</label>
            <input name="from_location" placeholder="e.g., Home"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">To</label>
            <input name="to_location" placeholder="e.g., Venue"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Miles *</label>
            <input name="miles" type="number" step="0.1" required
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Purpose</label>
            <input name="purpose" placeholder="e.g., Supply run for event"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Link to Event</label>
            <select name="event_id"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
              <option value="">None</option>
              {events?.map(ev => <option key={ev.id} value={ev.id}>{ev.client_name} - {formatDate(ev.event_date)}</option>)}
            </select>
          </div>
          <p className="text-xs text-cream/40">Rate: ${MILEAGE_RATES[year] || 0.70}/mile ({year} IRS standard rate)</p>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Log Mileage</Button>
            <Button type="button" variant="secondary" onClick={() => setShowMileageForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
