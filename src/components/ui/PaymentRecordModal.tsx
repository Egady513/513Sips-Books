import { useState } from 'react'
import { useRecordPayment } from '../../hooks/useInvoices'
import Modal from './Modal'
import Button from './Button'
import { formatCurrency } from '../../utils/formatters'
import { PAYMENT_METHODS } from '../../lib/constants'
import type { AREntry } from '../../lib/types'
import toast from 'react-hot-toast'

interface Props {
  entry: AREntry | null
  clientName?: string
  onClose: () => void
}

export default function PaymentRecordModal({ entry, clientName, onClose }: Props) {
  const [payMethod, setPayMethod] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const recordPayment = useRecordPayment()

  function handleClose() {
    setPayMethod('')
    setPayNotes('')
    onClose()
  }

  async function handleConfirm() {
    if (!entry || !payMethod) return
    try {
      await recordPayment.mutateAsync({
        entryId: entry.id,
        paymentMethod: payMethod,
        notes: payNotes || undefined,
        eventId: entry.event_id,
        entryType: entry.entry_type,
      })
      toast.success('Payment recorded')
      handleClose()
    } catch {
      toast.error('Failed to record payment')
    }
  }

  const displayName = entry?.events?.client_name || clientName || 'Client'

  return (
    <Modal open={!!entry} onClose={handleClose} title="Record Payment">
      {entry && (
        <div className="space-y-4">
          <div className="text-sm text-cream/60">
            <p><strong className="text-cream">{displayName}</strong></p>
            <p className="capitalize">{entry.entry_type}: {formatCurrency(entry.amount)}</p>
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
            <Button onClick={handleConfirm} disabled={!payMethod} className="flex-1">
              Confirm Payment
            </Button>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
