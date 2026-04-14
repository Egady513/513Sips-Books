import { useState } from 'react'
import { useEvents, useCreateEvent, useUpdateEvent, useUploadContract } from '../hooks/useEvents'
import { useCreateAREntry } from '../hooks/useInvoices'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate } from '../utils/formatters'
import { EVENT_STATUSES, EVENT_TYPES } from '../lib/constants'
import { Plus, Upload, FileText } from 'lucide-react'
import type { Event } from '../lib/types'

export default function EventsPage() {
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const { data: events, isLoading } = useEvents(filter)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const uploadContract = useUploadContract()
  const createAREntry = useCreateAREntry()

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
    } else {
      const newEvent = await createEvent.mutateAsync(payload)
      // Auto-create AR entries for deposit and balance
      if (total > 0) {
        const eventDate = new Date(payload.event_date)
        const depositDue = new Date(eventDate)
        depositDue.setDate(depositDue.getDate() - 30)

        await createAREntry.mutateAsync({
          event_id: newEvent.id,
          entry_type: 'deposit',
          amount: deposit,
          status: 'pending',
          due_date: depositDue.toISOString().split('T')[0],
        })
        await createAREntry.mutateAsync({
          event_id: newEvent.id,
          entry_type: 'balance',
          amount: total - deposit,
          status: 'pending',
          due_date: payload.event_date,
        })
      }
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
    }
    input.click()
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gold">Events</h1>
        <Button onClick={() => { setEditEvent(null); setShowForm(true) }}>
          <Plus size={16} /> New Event
        </Button>
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
      ) : !events?.length ? (
        <Card className="text-center py-12 text-cream/50">No events found</Card>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const depositPaid = event.ar_entries?.some(e => e.entry_type === 'deposit' && e.status === 'received')
            const balancePaid = event.ar_entries?.some(e => e.entry_type === 'balance' && e.status === 'received')

            return (
              <Card key={event.id} className="hover:border-gold/40 transition-colors">
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
                    <div className="text-xs text-cream/40 mt-1 flex gap-4">
                      <span>Deposit: {depositPaid ? '✓' : '○'} {formatCurrency(event.deposit_amount)}</span>
                      <span>Balance: {balancePaid ? '✓' : '○'} {formatCurrency(event.balance_amount)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gold">{formatCurrency(event.total_amount)}</span>
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
              <label className="block text-xs text-cream/50 mb-1">Location</label>
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
