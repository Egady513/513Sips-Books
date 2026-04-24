import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useCreateExpense, useUpdateExpense, useUploadReceipt } from '../../hooks/useExpenses'
import { useVendors, useCreateBill } from '../../hooks/useBills'
import Modal from './Modal'
import Button from './Button'
import { EXPENSE_CATEGORIES } from '../../lib/constants'
import { getScheduleCLine } from '../../utils/taxCalc'
import { ScanLine, Loader2 } from 'lucide-react'
import type { Expense, Event } from '../../lib/types'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  /** Pre-fills and hides the event selector when opening from an event page */
  eventId?: string
  /** When set, puts the form in edit mode */
  editExpense?: Expense | null
  /** Required for the event dropdown when eventId is not pre-set */
  events?: Event[]
}

export default function ExpenseFormModal({ open, onClose, eventId, editExpense, events }: Props) {
  const [ocrData, setOcrData] = useState<{
    vendor?: string; amount?: string; date?: string; description?: string; category?: string
  } | null>(null)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [addToAP, setAddToAP] = useState(false)
  const ocrInputRef = useRef<HTMLInputElement | null>(null)

  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const uploadReceipt = useUploadReceipt()
  const createBill = useCreateBill()
  const { data: vendors } = useVendors()

  function handleClose() {
    setOcrData(null)
    setPendingReceiptFile(null)
    setAddToAP(false)
    onClose()
  }

  async function handleScanReceipt(file: File) {
    setIsOcrLoading(true)
    setPendingReceiptFile(file)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data, error } = await supabase.functions.invoke('ocr-receipt', {
        body: { imageBase64: base64, mediaType: file.type || 'image/jpeg' },
      })
      if (error) throw error
      if (data?.success === false) throw new Error(data.error || 'OCR failed')
      setOcrData({
        vendor:      data.vendor      || '',
        amount:      data.amount != null ? String(data.amount) : '',
        date:        data.date        || new Date().toISOString().split('T')[0],
        description: data.description || '',
        category:    data.category    || '',
      })
      setFormKey(k => k + 1)
      toast.success('Receipt scanned — review the pre-filled fields')
    } catch (err) {
      console.error('OCR error:', err)
      toast.error('Could not scan receipt — fill in manually')
      setOcrData(null)
    } finally {
      setIsOcrLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const category = fd.get('category') as string
    const isTaxDeductible = fd.get('is_tax_deductible') === 'on'
    const resolvedEventId = eventId || (fd.get('event_id') as string) || undefined
    const payload = {
      event_id: resolvedEventId,
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
      } else {
        const newExpense = await createExpense.mutateAsync(payload)
        if (pendingReceiptFile && newExpense?.id) {
          await uploadReceipt.mutateAsync({ file: pendingReceiptFile, expenseId: newExpense.id })
        }
        if (addToAP) {
          const apVendorId = (fd.get('ap_vendor_id') as string) || undefined
          const apDueDate = (fd.get('ap_due_date') as string) || undefined
          await createBill.mutateAsync({
            vendor_id: apVendorId,
            event_id: resolvedEventId,
            description: payload.description,
            amount: payload.amount,
            category: payload.category,
            due_date: apDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'pending',
          })
          toast.success('Expense logged + added to AP')
        } else {
          toast.success('Expense added')
        }
      }
      handleClose()
    } catch {
      toast.error('Something went wrong')
    }
  }

  const isEditing = !!editExpense

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventBackdropClose
      title={isEditing ? 'Edit Expense' : 'New Expense'}
      wide
    >
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">

        {/* Scan Receipt — new expenses only */}
        {!isEditing && (
          <div className="flex items-center gap-3 p-3 bg-navy-lighter rounded-lg border border-gold-dim">
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleScanReceipt(f) }}
            />
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              disabled={isOcrLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50 transition-colors"
            >
              {isOcrLoading ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {isOcrLoading ? 'Scanning...' : 'Scan Receipt'}
            </button>
            {pendingReceiptFile && !isOcrLoading
              ? <span className="text-xs text-success">✓ {pendingReceiptFile.name}</span>
              : !isOcrLoading && <span className="text-xs text-cream/40">Upload a receipt to auto-fill the form</span>
            }
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-cream/50 mb-1">Description *</label>
            <input name="description" required
              defaultValue={ocrData?.description || editExpense?.description || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Amount ($) *</label>
            <input name="amount" type="number" step="0.01" required
              defaultValue={ocrData?.amount || (editExpense ? String(editExpense.amount) : '')}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Date *</label>
            <input name="expense_date" type="date" required
              defaultValue={ocrData?.date || editExpense?.expense_date || new Date().toISOString().split('T')[0]}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Category *</label>
            <select name="category" required
              defaultValue={ocrData?.category || editExpense?.category || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} (Line {c.scheduleCLine})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Vendor / Store</label>
            <input name="vendor"
              defaultValue={ocrData?.vendor || editExpense?.vendor || ''}
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
          </div>
          {/* Event selector — hidden when eventId is pre-set from context */}
          {!eventId && (
            <div>
              <label className="block text-xs text-cream/50 mb-1">Link to Event</label>
              <select name="event_id" defaultValue={editExpense?.event_id || ''}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                <option value="">None</option>
                {events?.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.client_name} — {new Date(ev.event_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-cream/50 mb-1">Notes</label>
          <textarea name="notes" rows={2} defaultValue={editExpense?.notes || ''}
            className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm" />
        </div>

        {/* Tax write-off */}
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

        {/* AP toggle — new expenses only */}
        {!isEditing && (
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-cream/70 cursor-pointer p-3 bg-navy-lighter rounded-lg border border-gold-dim hover:border-gold/40 transition-colors">
              <input
                type="checkbox"
                checked={addToAP}
                onChange={e => setAddToAP(e.target.checked)}
                className="w-4 h-4 rounded accent-gold"
              />
              <div>
                <span className="font-medium text-cream">Needs to be paid back</span>
                <p className="text-xs text-cream/40 mt-0.5">I paid out of pocket — add this to Accounts Payable</p>
              </div>
            </label>
            {addToAP && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-navy-lighter rounded-lg border border-gold/30">
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Pay to (Vendor) *</label>
                  <select name="ap_vendor_id" required className="w-full bg-navy border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm">
                    <option value="">Select vendor…</option>
                    {vendors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Due Date</label>
                  <input
                    name="ap_due_date"
                    type="date"
                    defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    className="w-full bg-navy border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1">{isEditing ? 'Save Changes' : 'Add Expense'}</Button>
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
