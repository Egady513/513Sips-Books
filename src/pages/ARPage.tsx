import { useState } from 'react'
import { useAREntries, useRecordPayment } from '../hooks/useInvoices'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters'
import { PAYMENT_METHODS } from '../lib/constants'
import { DollarSign } from 'lucide-react'

export default function ARPage() {
  const [filter, setFilter] = useState('all')
  const [payEntry, setPayEntry] = useState<any>(null)
  const [payMethod, setPayMethod] = useState('')
  const { data: entries, isLoading } = useAREntries(filter)
  const recordPayment = useRecordPayment()

  const pending = entries?.filter(e => e.status === 'pending') || []
  const received = entries?.filter(e => e.status === 'received') || []
  const totalOutstanding = pending.reduce((s, e) => s + Number(e.amount), 0)
  const totalReceived = received.reduce((s, e) => s + Number(e.amount), 0)

  const handlePayment = async () => {
    if (!payEntry || !payMethod) return
    await recordPayment.mutateAsync({
      entryId: payEntry.id,
      paymentMethod: payMethod,
      eventId: payEntry.event_id,
      entryType: payEntry.entry_type,
    })
    setPayEntry(null)
    setPayMethod('')
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gold">Accounts Receivable</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} color="text-warning" />
        <StatCard label="Received (YTD)" value={formatCurrency(totalReceived)} color="text-success" />
        <StatCard label="Pending Count" value={String(pending.length)} color="text-warning" />
        <StatCard label="Total Entries" value={String(entries?.length || 0)} color="text-gold" />
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'received', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === f ? 'bg-gold text-navy font-semibold' : 'bg-navy-lighter text-cream/60'}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-cream/50 text-center py-12">Loading...</div>
      ) : !entries?.length ? (
        <Card className="text-center py-12 text-cream/50">No AR entries found</Card>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const days = entry.due_date ? daysUntil(entry.due_date) : null
            return (
              <Card key={entry.id} className="hover:border-gold/40 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-cream">
                        {entry.events?.client_name || 'Unknown'}
                      </span>
                      <StatusBadge status={entry.status} />
                      <span className="text-xs text-cream/40 capitalize px-2 py-0.5 bg-navy-lighter rounded">
                        {entry.entry_type}
                      </span>
                    </div>
                    <div className="text-sm text-cream/50">
                      {entry.events?.event_name && <span>{entry.events.event_name} • </span>}
                      {entry.due_date && (
                        <span>
                          Due: {formatDate(entry.due_date)}
                          {days !== null && entry.status === 'pending' && (
                            <span className={days < 0 ? 'text-danger ml-1' : days < 7 ? 'text-warning ml-1' : 'ml-1'}>
                              ({days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {entry.received_at && (
                      <div className="text-xs text-success mt-1">
                        Received {formatDate(entry.received_at.split('T')[0])} via {entry.payment_method}
                      </div>
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
            )
          })}
        </div>
      )}

      {/* Payment Modal */}
      <Modal open={!!payEntry} onClose={() => setPayEntry(null)} title="Record Payment">
        {payEntry && (
          <div className="space-y-4">
            <div className="text-sm text-cream/60">
              <p><strong className="text-cream">{payEntry.events?.client_name}</strong></p>
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
            <div className="flex gap-3">
              <Button onClick={handlePayment} disabled={!payMethod} className="flex-1">
                Confirm Payment
              </Button>
              <Button variant="secondary" onClick={() => setPayEntry(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
