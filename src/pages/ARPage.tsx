import { useState } from 'react'
import { useAREntries } from '../hooks/useInvoices'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import FilterTabs from '../components/ui/FilterTabs'
import PaymentRecordModal from '../components/ui/PaymentRecordModal'
import { formatCurrency, formatDate, daysUntil } from '../utils/formatters'
import { DollarSign, Copy } from 'lucide-react'
import type { AREntry } from '../lib/types'
import toast from 'react-hot-toast'

export default function ARPage() {
  const [filter, setFilter] = useState('all')
  const [payEntry, setPayEntry] = useState<AREntry | null>(null)
  const { data: entries, isLoading } = useAREntries(filter)

  const pending = entries?.filter(e => e.status === 'pending') || []
  const received = entries?.filter(e => e.status === 'received') || []
  const totalOutstanding = pending.reduce((s, e) => s + Number(e.amount), 0)
  const totalReceived = received.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-gold">Accounts Receivable</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} color="text-warning" />
        <StatCard label="Received (YTD)" value={formatCurrency(totalReceived)} color="text-success" />
        <StatCard label="Pending Count" value={String(pending.length)} color="text-warning" />
        <StatCard label="Total Entries" value={String(entries?.length || 0)} color="text-gold" />
      </div>

      <FilterTabs
        value={filter}
        onChange={setFilter}
        options={['all', 'pending', 'received', 'overdue'].map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))}
      />

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
                      <>
                        <button
                          onClick={() => {
                            const daysLeft = entry.due_date ? Math.round((new Date(entry.due_date).getTime() - Date.now()) / 86400000) : null
                            const dueStr = daysLeft === null ? '' : daysLeft === 0 ? 'today' : daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                            const msg = `Hi ${entry.events?.client_name || 'there'}! Just a friendly reminder that your ${entry.entry_type} payment of ${formatCurrency(entry.amount)} is due ${dueStr}${entry.due_date ? ` (${entry.due_date})` : ''}. Payment accepted via Venmo, Zelle, cash, or check. Feel free to reach out with any questions!\n— Eddie @ 513 Sips`
                            navigator.clipboard.writeText(msg)
                            toast.success('Reminder copied!')
                          }}
                          className="text-cream/30 hover:text-blue-300 transition-colors p-1.5 rounded"
                          title="Copy reminder message"
                        >
                          <Copy size={14} />
                        </button>
                        <Button size="sm" variant="success" onClick={() => setPayEntry(entry)}>
                          <DollarSign size={14} /> Mark Paid
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <PaymentRecordModal entry={payEntry} onClose={() => setPayEntry(null)} />
    </div>
  )
}
