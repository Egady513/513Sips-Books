import { useState } from 'react'
import { useBills, useCreateBill, useMarkBillPaid, useVendors, useCreateVendor } from '../hooks/useBills'
import { useEvents } from '../hooks/useEvents'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters'
import { EXPENSE_CATEGORIES } from '../lib/constants'
import { getScheduleCLine } from '../utils/taxCalc'
import { Plus, DollarSign, UserPlus } from 'lucide-react'

export default function APPage() {
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [showVendorForm, setShowVendorForm] = useState(false)
  const { data: bills, isLoading } = useBills(filter)
  const { data: vendors } = useVendors()
  const { data: events } = useEvents()
  const createBill = useCreateBill()
  const markPaid = useMarkBillPaid()
  const createVendor = useCreateVendor()

  const pending = bills?.filter(b => b.status === 'pending') || []
  const totalOutstanding = pending.reduce((s, b) => s + Number(b.amount), 0)
  const totalPaid = (bills?.filter(b => b.status === 'paid') || []).reduce((s, b) => s + Number(b.amount), 0)

  const handleCreateBill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const category = fd.get('category') as string
    await createBill.mutateAsync({
      vendor_id: fd.get('vendor_id') as string || undefined,
      event_id: fd.get('event_id') as string || undefined,
      description: fd.get('description') as string,
      amount: parseFloat(fd.get('amount') as string),
      due_date: fd.get('due_date') as string,
      category,
      schedule_c_line: getScheduleCLine(category),
      is_owner_draw: fd.get('is_owner_draw') === 'on',
      status: 'pending',
    })
    setShowForm(false)
  }

  const handleCreateVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await createVendor.mutateAsync({
      name: fd.get('name') as string,
      contact_name: fd.get('contact_name') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
    })
    setShowVendorForm(false)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gold">Accounts Payable</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowVendorForm(true)}>
            <UserPlus size={16} /> Add Vendor
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> New Bill
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} color="text-danger" />
        <StatCard label="Paid (YTD)" value={formatCurrency(totalPaid)} color="text-success" />
        <StatCard label="Pending Count" value={String(pending.length)} color="text-warning" />
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'paid', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-gold text-navy font-semibold' : 'bg-navy-lighter text-cream/60'}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-cream/50 text-center py-12">Loading...</div>
      ) : !bills?.length ? (
        <Card className="text-center py-12 text-cream/50">No bills found</Card>
      ) : (
        <div className="space-y-3">
          {bills.map(bill => {
            const days = daysUntil(bill.due_date)
            const isOverdue = days < 0 && bill.status === 'pending'
            return (
              <Card key={bill.id} className="hover:border-gold/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-cream">
                        {bill.vendors?.name || 'No Vendor'}
                      </span>
                      <StatusBadge status={isOverdue ? 'overdue' : bill.status} />
                      {bill.is_owner_draw && (
                        <span className="text-xs px-2 py-0.5 bg-gold/20 text-gold rounded">Owner Draw</span>
                      )}
                    </div>
                    <div className="text-sm text-cream/50">
                      {bill.description}
                      {bill.category && <span className="ml-2 text-cream/40">• {bill.category}</span>}
                    </div>
                    <div className="text-xs text-cream/40 mt-1">
                      Due: {formatDate(bill.due_date)}
                      {bill.status === 'pending' && (
                        <span className={isOverdue ? 'text-danger ml-1' : 'ml-1'}>
                          ({isOverdue ? `${Math.abs(days)}d overdue` : `${days}d left`})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gold">{formatCurrency(bill.amount)}</span>
                    {bill.status === 'pending' && (
                      <Button size="sm" variant="success"
                        onClick={() => markPaid.mutate({ id: bill.id })}>
                        <DollarSign size={14} /> Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* New Bill Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Bill" wide>
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Vendor</label>
              <select name="vendor_id"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                <option value="">Select vendor...</option>
                {vendors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Link to Event</label>
              <select name="event_id"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                <option value="">None</option>
                {events?.map(ev => <option key={ev.id} value={ev.id}>{ev.client_name} - {formatDate(ev.event_date)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Description *</label>
              <input name="description" required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Amount ($) *</label>
              <input name="amount" type="number" step="0.01" required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Due Date *</label>
              <input name="due_date" type="date" required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Category</label>
              <select name="category"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-cream/60">
            <input type="checkbox" name="is_owner_draw" className="rounded" />
            This is an owner draw / personal payment
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Add Bill</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* New Vendor Modal */}
      <Modal open={showVendorForm} onClose={() => setShowVendorForm(false)} title="Add Vendor">
        <form onSubmit={handleCreateVendor} className="space-y-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Vendor Name *</label>
            <input name="name" required
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Contact Name</label>
            <input name="contact_name"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Email</label>
            <input name="email" type="email"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Phone</label>
            <input name="phone" type="tel"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Add Vendor</Button>
            <Button type="button" variant="secondary" onClick={() => setShowVendorForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
