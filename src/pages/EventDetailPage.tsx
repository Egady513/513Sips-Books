import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useEvent, useUpdateEvent, useUploadContract } from '../hooks/useEvents'
import { useRecordPayment } from '../hooks/useInvoices'
import { useEventExpenses, useEventMileage, useUpdateExpense, useDeleteExpense, useCreateExpense, useDeleteMileage, useCreateMileage } from '../hooks/useExpenses'
import { useEventBills } from '../hooks/useBills'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate } from '../utils/formatters'
import { EVENT_STATUSES, PAYMENT_METHODS, EXPENSE_CATEGORIES } from '../lib/constants'
import {
  ArrowLeft, FileText, Upload, DollarSign, Car, Receipt,
  CheckCircle2, Clock, Phone, Mail, Pencil, Trash2, Plus,
} from 'lucide-react'
import type { Expense } from '../lib/types'
import toast from 'react-hot-toast'

type Tab = 'overview' | 'payments' | 'bills' | 'expenses' | 'mileage'

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('overview')
  const [payEntry, setPayEntry] = useState<any>(null)
  const [payMethod, setPayMethod] = useState('')
  const [payNotes, setPayNotes] = useState('')

  // Expense edit state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', category: '', expense_date: '',
    vendor: '', is_tax_deductible: true, notes: '',
  })
  const [showNewExpense, setShowNewExpense] = useState(false)

  // Mileage add state
  const [showNewMileage, setShowNewMileage] = useState(false)

  const { data: event, isLoading } = useEvent(id)
  const { data: expenses = [] } = useEventExpenses(id)
  const { data: mileage = [] } = useEventMileage(id)
  const { data: bills = [] } = useEventBills(id)
  const updateEvent = useUpdateEvent()
  const uploadContract = useUploadContract()
  const recordPayment = useRecordPayment()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const createExpense = useCreateExpense()
  const deleteMileage = useDeleteMileage()
  const createMileage = useCreateMileage()

  function openExpenseEdit(exp: Expense) {
    setEditingExpense(exp)
    setExpenseForm({
      description: exp.description,
      amount: String(exp.amount),
      category: exp.category,
      expense_date: exp.expense_date,
      vendor: exp.vendor || '',
      is_tax_deductible: exp.is_tax_deductible,
      notes: exp.notes || '',
    })
  }

  async function handleSaveExpense() {
    if (!editingExpense) return
    try {
      await updateExpense.mutateAsync({
        id: editingExpense.id,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        expense_date: expenseForm.expense_date,
        vendor: expenseForm.vendor || undefined,
        is_tax_deductible: expenseForm.is_tax_deductible,
        notes: expenseForm.notes || undefined,
      })
      toast.success('Expense updated')
      setEditingExpense(null)
    } catch { toast.error('Failed to update expense') }
  }

  async function handleCreateExpenseHere(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await createExpense.mutateAsync({
        event_id: id,
        description: fd.get('description') as string,
        amount: parseFloat(fd.get('amount') as string),
        category: fd.get('category') as string,
        expense_date: fd.get('expense_date') as string,
        vendor: (fd.get('vendor') as string) || undefined,
        is_tax_deductible: fd.get('is_tax_deductible') === 'on',
        notes: (fd.get('notes') as string) || undefined,
      })
      toast.success('Expense added')
      setShowNewExpense(false)
    } catch { toast.error('Failed to add expense') }
  }

  async function handleCreateMileageHere(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const miles = parseFloat(fd.get('miles') as string)
    const rate = 0.70
    try {
      await createMileage.mutateAsync({
        event_id: id,
        trip_date: fd.get('trip_date') as string,
        from_location: (fd.get('from_location') as string) || undefined,
        to_location: (fd.get('to_location') as string) || undefined,
        miles,
        purpose: (fd.get('purpose') as string) || undefined,
        rate_per_mile: rate,
      })
      toast.success('Mileage logged')
      setShowNewMileage(false)
    } catch { toast.error('Failed to log mileage') }
  }

  if (isLoading) return <div className="text-cream/50 text-center py-20">Loading event...</div>
  if (!event) return (
    <div className="text-cream/50 text-center py-20">
      Event not found.{' '}
      <button onClick={() => navigate('/events')} className="text-gold hover:underline">← Back to Events</button>
    </div>
  )

  const arEntries = event.ar_entries || []
  const pendingAR = arEntries.filter(e => e.status === 'pending')
  const receivedAR = arEntries.filter(e => e.status === 'received')
  const totalReceived = receivedAR.reduce((s, e) => s + Number(e.amount), 0)
  const totalOutstanding = pendingAR.reduce((s, e) => s + Number(e.amount), 0)
  const depositPaid = arEntries.some(e => e.entry_type === 'deposit' && e.status === 'received')
  const balancePaid = arEntries.some(e => e.entry_type === 'balance' && e.status === 'received')

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalMileageDeduction = mileage.reduce((s, m) => s + Number(m.deduction_amount), 0)
  const totalBills = bills.filter(b => b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0)
  const totalCosts = totalExpenses + totalMileageDeduction + totalBills
  const eventNet = totalReceived - totalCosts

  const handlePayment = async () => {
    if (!payEntry || !payMethod) return
    try {
      await recordPayment.mutateAsync({
        entryId: payEntry.id,
        paymentMethod: payMethod,
        notes: payNotes || undefined,
        eventId: event.id,
        entryType: payEntry.entry_type,
      })
      toast.success('Payment recorded')
      setPayEntry(null)
      setPayMethod('')
      setPayNotes('')
    } catch {
      toast.error('Failed to record payment')
    }
  }

  const handleContractUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      await uploadContract.mutateAsync({ eventId: event.id, file, clientName: event.client_name })
      await updateEvent.mutateAsync({ id: event.id, status: 'signed' })
      toast.success('Contract uploaded')
    }
    input.click()
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments', count: arEntries.length },
    { id: 'bills', label: 'Bills', count: bills.length },
    { id: 'expenses', label: 'Expenses', count: expenses.length },
    { id: 'mileage', label: 'Mileage', count: mileage.length },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back nav */}
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-2 text-cream/40 hover:text-gold text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Back to Events
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gold">{event.event_name || event.client_name}</h1>
          <p className="text-cream/50 text-sm mt-1">
            {event.client_name} · {formatDate(event.event_date)}
            {event.location ? ` · ${event.location}` : ''}
            {event.event_type ? ` · ${event.event_type}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={event.status} />
          <select
            value={event.status}
            onChange={async e => {
              await updateEvent.mutateAsync({ id: event.id, status: e.target.value })
              toast.success(`Status → ${e.target.value}`)
            }}
            className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-cream/70 focus:outline-none focus:border-gold/50"
          >
            {EVENT_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {event.signed_contract_url ? (
            <a
              href={event.signed_contract_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gold/70 hover:text-gold px-3 py-1.5 bg-gold/10 rounded-lg border border-gold/20 transition-colors"
            >
              <FileText size={14} /> View Contract
            </a>
          ) : (
            <Button size="sm" variant="secondary" onClick={handleContractUpload}>
              <Upload size={14} /> Upload Contract
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Contract Value" value={formatCurrency(event.total_amount)} color="text-gold" />
        <StatCard label="Received" value={formatCurrency(totalReceived)} color="text-success" />
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} color="text-warning" />
        <StatCard label="Event Net" value={formatCurrency(eventNet)} color={eventNet >= 0 ? 'text-success' : 'text-danger'} />
      </div>

      {/* Deposit / Balance status strip */}
      <div className="flex gap-4 flex-wrap">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${
          depositPaid ? 'bg-success/10 border-success/30 text-success' : 'bg-warning/10 border-warning/30 text-warning'
        }`}>
          {depositPaid ? <CheckCircle2 size={14} /> : <Clock size={14} />}
          Deposit {depositPaid ? `paid` : `pending`} — {formatCurrency(event.deposit_amount)}
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${
          balancePaid ? 'bg-success/10 border-success/30 text-success' : 'bg-navy-lighter border-gold-dim text-cream/60'
        }`}>
          {balancePaid ? <CheckCircle2 size={14} /> : <Clock size={14} />}
          Balance {balancePaid ? 'paid' : 'pending'} — {formatCurrency(event.balance_amount)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gold-dim">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-gold text-gold'
                : 'border-transparent text-cream/50 hover:text-cream'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs bg-navy-lighter px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client info */}
          <Card>
            <h3 className="text-xs text-cream/40 uppercase tracking-wider mb-3">Client</h3>
            <div className="space-y-2 text-sm">
              <p className="text-cream font-semibold">{event.client_name}</p>
              {event.client_email && (
                <a href={`mailto:${event.client_email}`}
                  className="flex items-center gap-2 text-cream/60 hover:text-gold transition-colors">
                  <Mail size={13} /> {event.client_email}
                </a>
              )}
              {event.client_phone && (
                <a href={`tel:${event.client_phone}`}
                  className="flex items-center gap-2 text-cream/60 hover:text-gold transition-colors">
                  <Phone size={13} /> {event.client_phone}
                </a>
              )}
            </div>
          </Card>

          {/* Event details */}
          <Card>
            <h3 className="text-xs text-cream/40 uppercase tracking-wider mb-3">Event Details</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-cream/50">Date</span>
                <span className="text-cream">{formatDate(event.event_date)}</span>
              </div>
              {event.event_type && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Type</span>
                  <span className="text-cream">{event.event_type}</span>
                </div>
              )}
              {event.location && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Venue</span>
                  <span className="text-cream">{event.location}</span>
                </div>
              )}
              {event.guest_count && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Guests</span>
                  <span className="text-cream">{event.guest_count}</span>
                </div>
              )}
              {event.service_hours && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Service Hours</span>
                  <span className="text-cream">{event.service_hours}h</span>
                </div>
              )}
              {event.service_start_time && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Time</span>
                  <span className="text-cream">
                    {event.service_start_time}{event.service_end_time ? ` – ${event.service_end_time}` : ''}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Financial summary */}
          <Card>
            <h3 className="text-xs text-cream/40 uppercase tracking-wider mb-3">Financial Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-cream/50">Contract Value</span>
                <span className="text-gold font-semibold">{formatCurrency(event.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream/50">Collected</span>
                <span className="text-success">{formatCurrency(totalReceived)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cream/50">Expenses</span>
                <span className="text-danger">({formatCurrency(totalExpenses)})</span>
              </div>
              {totalMileageDeduction > 0 && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Mileage deduction</span>
                  <span className="text-danger">({formatCurrency(totalMileageDeduction)})</span>
                </div>
              )}
              {totalBills > 0 && (
                <div className="flex justify-between">
                  <span className="text-cream/50">Bills paid</span>
                  <span className="text-danger">({formatCurrency(totalBills)})</span>
                </div>
              )}
              <div className="border-t border-gold-dim pt-2 flex justify-between font-medium">
                <span className="text-cream">Net Profit</span>
                <span className={eventNet >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(eventNet)}
                </span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {event.notes && (
            <Card>
              <h3 className="text-xs text-cream/40 uppercase tracking-wider mb-3">Notes</h3>
              <p className="text-sm text-cream/70 whitespace-pre-wrap">{event.notes}</p>
            </Card>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === 'payments' && (
        <div className="space-y-3">
          {arEntries.length === 0 ? (
            <Card className="text-center py-10 text-cream/50">No AR entries for this event</Card>
          ) : (
            arEntries.map(entry => (
              <Card key={entry.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-cream capitalize">{entry.entry_type}</span>
                      <StatusBadge status={entry.status} />
                    </div>
                    {entry.due_date && (
                      <p className="text-xs text-cream/40">
                        Due: {formatDate(entry.due_date)}
                      </p>
                    )}
                    {entry.received_at && (
                      <p className="text-xs text-success mt-0.5">
                        Received {formatDate(entry.received_at.split('T')[0])}
                        {entry.payment_method ? ` via ${entry.payment_method}` : ''}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gold">{formatCurrency(entry.amount)}</span>
                    {entry.status === 'pending' && (
                      <Button size="sm" variant="success" onClick={() => setPayEntry(entry)}>
                        <DollarSign size={14} /> Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── BILLS TAB ── */}
      {tab === 'bills' && (
        <div className="space-y-3">
          {bills.length === 0 ? (
            <Card className="text-center py-10 text-cream/50">
              No bills linked to this event.
              <div className="mt-2">
                <Link to="/ap" className="text-gold/70 hover:text-gold text-sm">Add a bill on the Payables page →</Link>
              </div>
            </Card>
          ) : (
            bills.map(bill => (
              <Card key={bill.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-cream">{bill.vendors?.name || 'No vendor'}</span>
                      <StatusBadge status={bill.status} />
                    </div>
                    <p className="text-sm text-cream/50">{bill.description}</p>
                    {bill.category && (
                      <p className="text-xs text-cream/30 mt-0.5 capitalize">{bill.category}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-gold">{formatCurrency(bill.amount)}</span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewExpense(true)}>
              <Plus size={14} /> New Expense
            </Button>
          </div>
          {expenses.length === 0 ? (
            <Card className="text-center py-10 text-cream/50">
              No expenses linked to this event yet.
            </Card>
          ) : (
            <>
              {expenses.map(exp => (
                <Card key={exp.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-cream">{exp.description}</span>
                        {exp.is_tax_deductible && (
                          <span className="text-xs px-1.5 py-0.5 bg-success/20 text-success rounded">✓ Write-off</span>
                        )}
                      </div>
                      <div className="text-xs text-cream/40 flex flex-wrap gap-3">
                        <span>{formatDate(exp.expense_date)}</span>
                        {exp.vendor && <span>· {exp.vendor}</span>}
                        {exp.category && (
                          <span>· {EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}</span>
                        )}
                        {exp.schedule_c_line && <span className="text-cream/30">(Line {exp.schedule_c_line})</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-danger">{formatCurrency(exp.amount)}</span>
                      {exp.receipt_url && (
                        <a href={exp.receipt_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-success/15 text-success rounded hover:bg-success/25"
                          title="View receipt">
                          <Receipt size={11} /> Receipt
                        </a>
                      )}
                      <button onClick={() => openExpenseEdit(exp)}
                        className="text-cream/30 hover:text-gold transition-colors p-1" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { if (confirm('Delete this expense?')) deleteExpense.mutate(exp.id) }}
                        className="text-cream/30 hover:text-red-400 transition-colors p-1" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
              <Card className="bg-navy-light/50">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-cream/60">Total Expenses</span>
                  <span className="text-danger">{formatCurrency(totalExpenses)}</span>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── MILEAGE TAB ── */}
      {tab === 'mileage' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowNewMileage(true)}>
              <Plus size={14} /> Log Mileage
            </Button>
          </div>
          {mileage.length === 0 ? (
            <Card className="text-center py-10 text-cream/50">
              No mileage logged for this event yet.
            </Card>
          ) : (
            <>
              {mileage.map(m => (
                <Card key={m.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Car size={14} className="text-cream/40" />
                        <span className="font-medium text-cream">
                          {m.from_location || '?'} → {m.to_location || '?'}
                        </span>
                      </div>
                      <div className="text-xs text-cream/40 flex gap-3">
                        <span>{formatDate(m.trip_date)}</span>
                        <span>· {m.miles} miles @ ${m.rate_per_mile}/mi</span>
                        {m.purpose && <span>· {m.purpose}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-success">{formatCurrency(m.deduction_amount)}</span>
                      <button onClick={() => { if (confirm('Delete this mileage entry?')) deleteMileage.mutate(m.id) }}
                        className="text-cream/30 hover:text-red-400 transition-colors p-1" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
              <Card className="bg-navy-light/50">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-cream/60">Total Deduction</span>
                  <span className="text-success">{formatCurrency(totalMileageDeduction)}</span>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Edit Expense Modal ── */}
      <Modal open={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit Expense" preventBackdropClose>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-cream/50 mb-1">Description *</label>
              <input value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Date *</label>
              <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Category</label>
              <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Vendor / Store</label>
              <input value={expenseForm.vendor} onChange={e => setExpenseForm(f => ({ ...f, vendor: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={expenseForm.is_tax_deductible} onChange={e => setExpenseForm(f => ({ ...f, is_tax_deductible: e.target.checked }))}
              className="w-4 h-4 accent-gold" />
            <span className="text-sm text-cream/70">Tax write-off (Schedule C)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1" onClick={handleSaveExpense}>Save Changes</Button>
            <Button variant="secondary" onClick={() => setEditingExpense(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ── New Expense Modal (from event detail) ── */}
      <Modal open={showNewExpense} onClose={() => setShowNewExpense(false)} title="New Expense" preventBackdropClose>
        <form onSubmit={handleCreateExpenseHere} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-cream/50 mb-1">Description *</label>
              <input name="description" required className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Amount ($) *</label>
              <input name="amount" type="number" step="0.01" required className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Date *</label>
              <input name="expense_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Category</label>
              <select name="category" className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Vendor / Store</label>
              <input name="vendor" className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="is_tax_deductible" defaultChecked className="w-4 h-4 accent-gold" />
            <span className="text-sm text-cream/70">Tax write-off (Schedule C)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Add Expense</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewExpense(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* ── New Mileage Modal (from event detail) ── */}
      <Modal open={showNewMileage} onClose={() => setShowNewMileage(false)} title="Log Mileage" preventBackdropClose>
        <form onSubmit={handleCreateMileageHere} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Date *</label>
              <input name="trip_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Miles *</label>
              <input name="miles" type="number" step="0.1" required className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">From</label>
              <input name="from_location" placeholder="Home" className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">To</label>
              <input name="to_location" placeholder="Venue / Store" className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-cream/50 mb-1">Purpose</label>
              <input name="purpose" placeholder="e.g. Drive to event, supply run" className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
          </div>
          <p className="text-xs text-cream/30">Rate: $0.70/mile (2025 IRS standard)</p>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Log Mileage</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewMileage(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!payEntry} onClose={() => setPayEntry(null)} title="Record Payment">
        {payEntry && (
          <div className="space-y-4">
            <div className="text-sm text-cream/60">
              <p><strong className="text-cream">{event.client_name}</strong></p>
              <p className="capitalize">{payEntry.entry_type}: {formatCurrency(payEntry.amount)}</p>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Payment Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                <option value="">Select...</option>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g., Venmo @client, Check #1234..."
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handlePayment} disabled={!payMethod} className="flex-1">
                Confirm Payment
              </Button>
              <Button variant="secondary" onClick={() => { setPayEntry(null); setPayNotes('') }}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
