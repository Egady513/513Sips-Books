import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEvents, useCreateEvent, useUpdateEvent, useUploadContract } from '../hooks/useEvents'
import { useCreateAREntry } from '../hooks/useInvoices'
import { useExpenses } from '../hooks/useExpenses'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate } from '../utils/formatters'
import { EVENT_STATUSES, EVENT_TYPES } from '../lib/constants'
import { Plus, Upload, FileText, TrendingUp, Archive, Search } from 'lucide-react'
import type { Event } from '../lib/types'
import toast from 'react-hot-toast'

export default function EventsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const { data: events, isLoading } = useEvents(filter)
  const { data: allExpenses } = useExpenses()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const uploadContract = useUploadContract()
  const createAREntry = useCreateAREntry()

  // Build event_id → total expenses map
  const expensesByEvent = useMemo(() => {
    const map: Record<string, number> = {}
    for (const exp of allExpenses || []) {
      if (exp.event_id) {
        map[exp.event_id] = (map[exp.event_id] || 0) + Number(exp.amount)
      }
    }
    return map
  }, [allExpenses])

  // Client-side search filter
  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events || []
    const q = search.toLowerCase()
    return (events || []).filter(ev =>
      ev.client_name?.toLowerCase().includes(q) ||
      ev.event_name?.toLowerCase().includes(q) ||
      ev.location?.toLowerCase().includes(q) ||
      ev.event_type?.toLowerCase().includes(q)
    )
  }, [events, search])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const total = parseFloat(fd.get('total_amount') as string) || 0
    const deposit = Math.round(total * 0.5)

    const payload = {
      client_name: fd.get('client_name') as string,
      client_email: fd.get('client_email') as string,
      client_phone: fd.get('client_phone') as string,
      event_name: fd.get('event_name') as string,
      event_date: fd.get('event_date') as string,
      location: fd.get('location') as string,
      event_type: fd.get('event_type') as string,
      guest_count: parseInt(fd.get('guest_count') as string) || 0,
      service_hours: parseInt(fd.get('service_hours') as string) || 3,
      description: fd.get('description') as string,
      total_amount: total,
      deposit_amount: deposit,
      balance_amount: total - deposit,
      status: editEvent?.status || 'draft',
    }

    if (editEvent) {
      await updateEvent.mutateAsync({ id: editEvent.id, ...payload })
      toast.success('Event updated')
    } else {
      const newEvent = await createEvent.mutateAsync(payload)
      // Auto-create AR entries for deposit and balance
      if (total > 0) {
        const eventDate = new Date(payload.event_date)
        const depositDue = new Date(eventDate)
        depositDue.setDate(depositDue.getDate() - 30)
        // Clamp deposit due date to today at earliest
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const depositDueClamped = depositDue < today ? today : depositDue

        await createAREntry.mutateAsync({
          event_id: newEvent.id,
          entry_type: 'deposit',
          amount: deposit,
          status: 'pending',
          due_date: depositDueClamped.toISOString().split('T')[0],
        })
        await createAREntry.mutateAsync({
          event_id: newEvent.id,
          entry_type: 'balance',
          amount: total - deposit,
          status: 'pending',
          due_date: payload.event_date,
        })
      }
      toast.success('Event created')
      navigate(`/events/${newEvent.id}`)
    }

    setShowForm(false)
    setEditEvent(null)
  }

  const handleContractUpload = async (eventId: string, clientName: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      await uploadContract.mutateAsync({ eventId, file, clientName })
      await updateEvent.mutateAsync({ id: eventId, status: 'signed' })
      toast.success('Contract uploaded')
    }
    input.click()
  }

  const handleArchive = async (event: Event) => {
    if (!confirm(`Archive event for ${event.client_name}? It will be marked Cancelled and removed from active views.`)) return
    await updateEvent.mutateAsync({ id: event.id, status: 'cancelled' })
    toast.success('Event archived')
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Events</h1>
        <Button onClick={() => { setEditEvent(null); setShowForm(true) }}>
          <Plus size={16} /> New Event
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/40" />
        <input
          type="text"
          placeholder="Search by client, event name, venue, or type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-navy-lighter border border-gold-dim rounded-lg pl-9 pr-4 py-2.5 text-cream text-sm placeholder-cream/30 focus:outline-none focus:border-gold/50"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm ${filter === 'all' ? 'bg-gold text-navy font-semibold' : 'bg-navy-lighter text-cream/60'}`}
        >
          All
        </button>
        {EVENT_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === s.value ? 'bg-gold text-navy font-semibold' : 'bg-navy-lighter text-cream/60'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="text-cream/50 text-center py-12">Loading events...</div>
      ) : !filteredEvents.length ? (
        <Card className="text-center py-12 text-cream/50">
          {search ? `No events matching "${search}"` : 'No events found'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(event => {
            const depositPaid = event.ar_entries?.some(e => e.entry_type === 'deposit' && e.status === 'received')
            const balancePaid = event.ar_entries?.some(e => e.entry_type === 'balance' && e.status === 'received')
            const eventCosts = expensesByEvent[event.id] || 0
            const eventNet = event.total_amount - eventCosts

            return (
              <Card key={event.id}
                className="hover:border-gold/40 transition-colors cursor-pointer"
                onClick={() => navigate(`/events/${event.id}`)}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gold truncate">
                        {event.event_name || event.client_name}
                      </span>
                      <StatusBadge status={event.status} />
                    </div>
                    <div className="text-sm text-cream/50 flex flex-wrap gap-x-4">
                      <span>{event.client_name}</span>
                      <span>{formatDate(event.event_date)}</span>
                      {event.location && <span>{event.location}</span>}
                      {event.event_type && <span>{event.event_type}</span>}
                    </div>
                    <div className="text-xs text-cream/40 mt-1 flex flex-wrap gap-x-4">
                      <span>Deposit: {depositPaid ? '✓' : '○'} {formatCurrency(event.deposit_amount)}</span>
                      <span>Balance: {balancePaid ? '✓' : '○'} {formatCurrency(event.balance_amount)}</span>
                      {eventCosts > 0 && (
                        <span className="flex items-center gap-1">
                          <TrendingUp size={11} className={eventNet >= 0 ? 'text-success' : 'text-danger'} />
                          <span>Costs: {formatCurrency(eventCosts)} · Net: </span>
                          <span className={eventNet >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(eventNet)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                    <span className="text-lg font-bold text-gold">{formatCurrency(event.total_amount)}</span>
                    {/* Quick status change */}
                    <select
                      value={event.status}
                      onChange={async e => {
                        await updateEvent.mutateAsync({ id: event.id, status: e.target.value })
                        toast.success(`Status → ${e.target.value}`)
                      }}
                      className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-cream/70 focus:outline-none focus:border-gold/50"
                    >
                      {EVENT_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    {event.signed_contract_url && (
                      <a href={event.signed_contract_url} target="_blank" rel="noreferrer"
                        className="text-cream/40 hover:text-gold">
                        <FileText size={16} />
                      </a>
                    )}
                    {!event.signed_contract_url && (
                      <Button size="sm" variant="secondary"
                        onClick={() => handleContractUpload(event.id, event.client_name)}>
                        <Upload size={14} /> Contract
                      </Button>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => { setEditEvent(event); setShowForm(true) }}>
                      Edit
                    </Button>
                    <button
                      onClick={() => handleArchive(event)}
                      className="text-cream/30 hover:text-warning transition-colors p-1.5 rounded"
                      title="Archive event (sets status to Cancelled)"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Event Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditEvent(null) }}
        title={editEvent ? 'Edit Event' : 'New Event'} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Client Name *</label>
              <input name="client_name" defaultValue={editEvent?.client_name} required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Event Name</label>
              <input name="event_name" defaultValue={editEvent?.event_name || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Event Date *</label>
              <input name="event_date" type="date" defaultValue={editEvent?.event_date} required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Event Type</label>
              <select name="event_type" defaultValue={editEvent?.event_type || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                <option value="">Select...</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Location / Venue</label>
              <input name="location" defaultValue={editEvent?.location || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Guest Count</label>
              <input name="guest_count" type="number" defaultValue={editEvent?.guest_count || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Service Hours</label>
              <input name="service_hours" type="number" defaultValue={editEvent?.service_hours || 3}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Total Amount ($) *</label>
              <input name="total_amount" type="number" step="0.01" defaultValue={editEvent?.total_amount || ''} required
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Client Email</label>
              <input name="client_email" type="email" defaultValue={editEvent?.client_email || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Client Phone</label>
              <input name="client_phone" type="tel" defaultValue={editEvent?.client_phone || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Description / Notes</label>
            <textarea name="description" rows={3} defaultValue={editEvent?.description || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">
              {editEvent ? 'Update Event' : 'Create Event'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditEvent(null) }}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
