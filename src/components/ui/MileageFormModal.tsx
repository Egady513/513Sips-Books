import { useCreateMileage } from '../../hooks/useExpenses'
import { MILEAGE_RATES } from '../../lib/constants'
import Modal from './Modal'
import Button from './Button'
import type { Event } from '../../lib/types'
import { formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-fills and hides event selector when opening from an event page */
  eventId?: string
  events?: Event[]
  year?: number
}

export default function MileageFormModal({ open, onClose, eventId, events, year }: Props) {
  const createMileage = useCreateMileage()
  const currentYear = year || new Date().getFullYear()
  const rate = MILEAGE_RATES[currentYear] || 0.70

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const miles = parseFloat(fd.get('miles') as string)
    const tripDate = fd.get('trip_date') as string
    const tripYear = tripDate ? new Date(tripDate).getFullYear() : currentYear
    const tripRate = MILEAGE_RATES[tripYear] || 0.70
    try {
      await createMileage.mutateAsync({
        event_id: eventId || (fd.get('event_id') as string) || undefined,
        trip_date: tripDate,
        from_location: (fd.get('from_location') as string) || undefined,
        to_location: (fd.get('to_location') as string) || undefined,
        miles,
        purpose: (fd.get('purpose') as string) || undefined,
        rate_per_mile: tripRate,
      })
      toast.success('Mileage logged')
      onClose()
    } catch {
      toast.error('Failed to log mileage')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Mileage" preventBackdropClose>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Trip Date *</label>
            <input name="trip_date" type="date" required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Miles *</label>
            <input name="miles" type="number" step="0.1" required
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">From</label>
            <input name="from_location" placeholder="e.g., Home"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">To</label>
            <input name="to_location" placeholder="e.g., Venue / Store"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-cream/50 mb-1">Purpose</label>
            <input name="purpose" placeholder="e.g., Supply run, drive to event"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          {!eventId && (
            <div className="col-span-2">
              <label className="block text-xs text-cream/50 mb-1">Link to Event</label>
              <select name="event_id"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                <option value="">None</option>
                {events?.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client_name} — {formatDate(ev.event_date)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="text-xs text-cream/40">${rate}/mile ({currentYear} IRS standard rate)</p>
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">Log Mileage</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
