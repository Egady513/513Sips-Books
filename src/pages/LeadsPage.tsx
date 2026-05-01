import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from '../hooks/useLeads'
import { useRecentQuotes, useLinkQuoteToLead, useUpdateQuote, useCreateQuote, useDeleteQuote } from '../hooks/useQuotes'
import { useAlcoholEstimatesByLead } from '../hooks/useAlcoholEstimates'
import { useCreateEvent, useLinkedEvents } from '../hooks/useEvents'
import { useCreateAREntry } from '../hooks/useInvoices'
import type { Quote } from '../hooks/useQuotes'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import QuoteVersionHistory from '../components/ui/QuoteVersionHistory'
import { formatCurrency, formatDate } from '../utils/formatters'
import {
  Plus, Instagram, Users, Phone, Mail, Calendar, DollarSign,
  Trash2, Edit2, Download, ExternalLink, FileSignature, CheckCircle2, FileText, Pencil, FileDown,
  AlertCircle, Clock, ChevronDown, LayoutGrid, List, History, CalendarPlus,
} from 'lucide-react'
import type { Lead } from '../lib/types'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  new:         { label: 'New Lead',     color: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  quoted:      { label: 'Quoted',       color: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  negotiating: { label: 'Negotiating',  color: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  booked:      { label: 'Booked!',      color: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  lost:        { label: 'Lost',         color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
}

const SOURCE_CONFIG = {
  instagram:    { label: 'Instagram',      icon: '📸' },
  word_of_mouth:{ label: 'Word of Mouth',  icon: '🗣️' },
  website:      { label: 'Website',        icon: '🌐' },
  referral:     { label: 'Referral',       icon: '🤝' },
  other:        { label: 'Other',          icon: '💬' },
}

const EVENT_TYPES = ['Birthday', 'Wedding', 'Corporate', 'Holiday Party', 'Graduation', 'Fundraiser', 'Baby Shower', 'Bridal Shower', 'Retirement', 'Other']

const FILTER_TABS = [
  { value: 'all',         label: 'All' },
  { value: 'new',         label: 'New' },
  { value: 'quoted',      label: 'Quoted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'booked',      label: 'Booked' },
  { value: 'lost',        label: 'Lost' },
]

const emptyForm = {
  name: '', email: '', phone: '', event_date: '', event_type: '',
  guest_count: '', budget: '', source: 'instagram', status: 'new', notes: '',
  venue_name: '', venue_contact_name: '', venue_contact_phone: '',
  venue_address: '', service_start_time: '', service_end_time: '',
  number_of_events: '1',
}

export default function LeadsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [showQuoteImport, setShowQuoteImport] = useState(false)
  const [importTargetLead, setImportTargetLead] = useState<Lead | null>(null)

  const [showBookConfirm, setShowBookConfirm] = useState(false)
  const [bookingLead, setBookingLead] = useState<Lead | null>(null)
  const [bookingQuote, setBookingQuote] = useState<Quote | null>(null)

  // Sprint 3: addon notes inline editing
  const [editingAddonNotes, setEditingAddonNotes] = useState<string | null>(null)
  const [addonNotesValue, setAddonNotesValue] = useState('')

  // Local probability state (tracks slider while dragging before save)
  const [localProb, setLocalProb] = useState<Record<string, number>>({})

  // View mode + collapsible cards
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const toggleCard = (id: string) => setExpandedCards(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // Sprint 4: contract validation modal
  const [showContractValidation, setShowContractValidation] = useState(false)
  const [contractValidationLead, setContractValidationLead] = useState<Lead | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])

  // Manual quote creation
  const [showCreateQuote, setShowCreateQuote] = useState(false)
  const [createQuoteForLead, setCreateQuoteForLead] = useState<Lead | null>(null)
  const [createQuoteForm, setCreateQuoteForm] = useState({ total: '', deposit: '', balance: '', guest_count: '', hours: '', valid_until: '', addon_notes: '' })

  // Quote version history modal
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionHistoryQuote, setVersionHistoryQuote] = useState<Quote | null>(null)

  // Multi-event: Add Event modal
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [addEventLead, setAddEventLead] = useState<Lead | null>(null)
  const [addEventForm, setAddEventForm] = useState({ event_name: '', event_date: '', total: '', deposit: '', balance: '' })

  // Multi-event: editable per-event amount in the booking confirmation modal
  const [bookingEventAmount, setBookingEventAmount] = useState<string>('')

  const { data: leads = [], isLoading } = useLeads(filter === 'all' ? undefined : filter)
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const createEvent = useCreateEvent()
  const createAREntry = useCreateAREntry()
  const { data: recentQuotes = [] } = useRecentQuotes()
  const linkQuote = useLinkQuoteToLead()
  const updateQuote = useUpdateQuote()
  const createQuote = useCreateQuote()
  const deleteQuote = useDeleteQuote()
  const { data: linkedEvents = [] } = useLinkedEvents()

  // ── Calculator → Books quote pre-fill ──────────────────────────────────────
  // When calculator opens Books with ?cq_lead=ID&cq=base64data, pre-fill the
  // existing quote creation modal so Eddie can review and save normally.
  useEffect(() => {
    const cqLeadId = searchParams.get('cq_lead')
    const cqEncoded = searchParams.get('cq')
    if (!cqLeadId || !cqEncoded || !leads.length) return
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(cqEncoded))))
      const lead = leads.find(l => l.id === cqLeadId)
      if (!lead) return
      setCreateQuoteForLead(lead)
      setCreateQuoteForm({
        total:       String(data.total ?? ''),
        deposit:     String(data.deposit ?? ''),
        balance:     String(data.balance ?? ''),
        guest_count: String(data.guests ?? ''),
        hours:       String(data.hours ?? ''),
        valid_until: data.valid_until ?? '',
        addon_notes: data.addon_notes ?? '',
      })
      setShowCreateQuote(true)
      // Remove params so a refresh doesn't re-open the modal
      setSearchParams({}, { replace: true })
    } catch (e) {
      console.error('Failed to parse calculator quote data', e)
    }
  }, [leads, searchParams])
  // ───────────────────────────────────────────────────────────────────────────

  const allLeads = useLeads().data || []
  const stats = {
    total:       allLeads.length,
    new:         allLeads.filter(l => l.status === 'new').length,
    booked:      allLeads.filter(l => l.status === 'booked').length,
    // Weighted pipeline: use linked quote total (or budget fallback), × win probability
    pipeline: allLeads.filter(l => l.status !== 'lost').reduce((s, l) => {
      const quote = recentQuotes.find(q => q.lead_id === l.id)
      const amount = quote?.total ?? l.budget ?? 0
      const prob = l.probability ?? 50
      return s + Math.round(amount * prob / 100)
    }, 0),
  }

  function openNew() {
    setForm(emptyForm)
    setEditLead(null)
    setShowForm(true)
  }

  function openEdit(lead: Lead) {
    setEditLead(lead)
    setForm({
      name:                lead.name,
      email:               lead.email || '',
      phone:               lead.phone || '',
      event_date:          lead.event_date || '',
      event_type:          lead.event_type || '',
      guest_count:         String(lead.guest_count || ''),
      budget:              String(lead.budget || ''),
      source:              lead.source,
      status:              lead.status,
      notes:               lead.notes || '',
      venue_name:          lead.venue_name || '',
      venue_contact_name:  lead.venue_contact_name || '',
      venue_contact_phone: lead.venue_contact_phone || '',
      venue_address:       lead.venue_address || '',
      service_start_time:  lead.service_start_time || '',
      service_end_time:    lead.service_end_time || '',
      number_of_events:    String(lead.number_of_events ?? 1),
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Partial<Lead> = {
      name:                form.name,
      email:               form.email || undefined,
      phone:               form.phone || undefined,
      event_date:          form.event_date || undefined,
      event_type:          form.event_type || undefined,
      guest_count:         form.guest_count ? parseInt(form.guest_count) : undefined,
      budget:              form.budget ? parseFloat(form.budget) : undefined,
      source:              form.source as Lead['source'],
      status:              form.status as Lead['status'],
      notes:               form.notes || undefined,
      venue_name:          form.venue_name || undefined,
      venue_contact_name:  form.venue_contact_name || undefined,
      venue_contact_phone: form.venue_contact_phone || undefined,
      venue_address:       form.venue_address || undefined,
      service_start_time:  form.service_start_time || undefined,
      service_end_time:    form.service_end_time || undefined,
      number_of_events:    parseInt(form.number_of_events) || 1,
    }

    try {
      if (editLead) {
        await updateLead.mutateAsync({ id: editLead.id, ...payload })
        toast.success('Lead updated')
      } else {
        // Duplicate detection
        const dup = allLeads.find(l =>
          l.id !== editLead &&
          ((form.email && l.email && l.email.toLowerCase() === form.email.toLowerCase()) ||
           (form.phone && l.phone && l.phone.replace(/\D/g, '') === form.phone.replace(/\D/g, '')))
        )
        if (dup) {
          const ok = confirm(`⚠️ Similar lead already exists: "${dup.name}" (${dup.status})\n\nAdd anyway?`)
          if (!ok) return
        }
        await createLead.mutateAsync(payload)
        toast.success('Lead added!')
      }
      setShowForm(false)
    } catch {
      toast.error('Something went wrong')
    }
  }

  // Handle status change — intercept "booked" to trigger conversion flow
  async function handleStatusChange(lead: Lead, status: Lead['status']) {
    if (status === 'booked' && lead.status !== 'booked') {
      const linked = recentQuotes.find(q => q.lead_id === lead.id)
      setBookingLead(lead)
      setBookingQuote(linked || null)
      // Pre-fill per-event amount for multi-event leads
      const numEvents = lead.number_of_events ?? 1
      if (linked && numEvents > 1) {
        setBookingEventAmount(String(Math.round(linked.total / numEvents)))
      } else {
        setBookingEventAmount('')
      }
      setShowBookConfirm(true)
      return
    }
    await updateLead.mutateAsync({ id: lead.id, status })
    toast.success(`Status → ${STATUS_CONFIG[status].label}`)
  }

  // Convert lead → event when booked
  async function handleConfirmBooking() {
    if (!bookingLead) return
    const lead = bookingLead
    const quote = bookingQuote

    try {
      const isMultiEvent = (lead.number_of_events ?? 1) > 1
      const total = isMultiEvent && bookingEventAmount
        ? parseFloat(bookingEventAmount)
        : (quote?.total ?? (lead.budget ?? 0))
      const deposit = Math.round(total * 0.5)
      const balance = total - deposit

      // Determine service_hours from quote or default 4
      const serviceHours = quote?.hours ?? 4

      // Calculate end time from start + hours if we have start but no end
      let endTime = lead.service_end_time
      if (lead.service_start_time && !endTime && serviceHours) {
        const [h, m] = lead.service_start_time.split(':').map(Number)
        const endH = (h + serviceHours) % 24
        endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }

      // Create the event
      const newEvent = await createEvent.mutateAsync({
        client_name:          lead.name,
        client_email:         lead.email,
        client_phone:         lead.phone,
        event_name:           lead.name + (lead.event_type ? ` — ${lead.event_type}` : ''),
        event_date:           lead.event_date || new Date().toISOString().split('T')[0],
        location:             lead.venue_name || lead.venue_address || '',
        venue_contact_name:   lead.venue_contact_name,
        venue_contact_phone:  lead.venue_contact_phone,
        venue_address:        lead.venue_address,
        event_type:           lead.event_type,
        guest_count:          lead.guest_count ?? quote?.guest_count,
        service_hours:        serviceHours,
        service_start_time:   lead.service_start_time,
        service_end_time:     endTime,
        total_amount:         total,
        deposit_amount:       deposit,
        balance_amount:       balance,
        status:               'signed',
        notes:                lead.notes,
        lead_id:              lead.id,
      })

      // Create AR entries
      if (total > 0 && lead.event_date) {
        const eventDate = new Date(lead.event_date)
        const depositDue = new Date(eventDate)
        depositDue.setDate(depositDue.getDate() - 30)

        await createAREntry.mutateAsync({
          event_id:   newEvent.id,
          entry_type: 'deposit',
          amount:     deposit,
          status:     'pending',
          due_date:   depositDue.toISOString().split('T')[0],
        })
        await createAREntry.mutateAsync({
          event_id:   newEvent.id,
          entry_type: 'balance',
          amount:     balance,
          status:     'pending',
          due_date:   lead.event_date,
        })
      }

      // Update lead status + link converted_event_id
      await updateLead.mutateAsync({
        id:                 lead.id,
        status:             'booked',
        converted_event_id: newEvent.id,
      })

      // P2: mark linked quote as accepted
      if (quote) {
        try { await updateQuote.mutateAsync({ id: quote.id, status: 'accepted' }) } catch { /* non-blocking */ }
      }

      toast.success(`Booked! Event created for ${lead.name}`)
      setShowBookConfirm(false)
      setBookingLead(null)
      setBookingQuote(null)
      setBookingEventAmount('')
      navigate(`/events/${newEvent.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to create event')
    }
  }

  async function handleAddEvent() {
    if (!addEventLead) return
    const total = parseFloat(addEventForm.total) || 0
    const deposit = parseFloat(addEventForm.deposit) || Math.round(total * 0.5)
    const balance = parseFloat(addEventForm.balance) || (total - deposit)
    try {
      const newEvent = await createEvent.mutateAsync({
        client_name:         addEventLead.name,
        client_email:        addEventLead.email,
        client_phone:        addEventLead.phone,
        event_name:          addEventForm.event_name || addEventLead.name,
        event_date:          addEventForm.event_date || new Date().toISOString().split('T')[0],
        location:            addEventLead.venue_name || addEventLead.venue_address || '',
        venue_contact_name:  addEventLead.venue_contact_name,
        venue_contact_phone: addEventLead.venue_contact_phone,
        venue_address:       addEventLead.venue_address,
        event_type:          addEventLead.event_type,
        guest_count:         addEventLead.guest_count,
        total_amount:        total,
        deposit_amount:      deposit,
        balance_amount:      balance,
        status:              'signed',
        notes:               addEventLead.notes,
        lead_id:             addEventLead.id,
      })
      if (total > 0 && addEventForm.event_date) {
        const eventDate = new Date(addEventForm.event_date)
        const depositDue = new Date(eventDate)
        depositDue.setDate(depositDue.getDate() - 30)
        await createAREntry.mutateAsync({ event_id: newEvent.id, entry_type: 'deposit', amount: deposit, status: 'pending', due_date: depositDue.toISOString().split('T')[0] })
        await createAREntry.mutateAsync({ event_id: newEvent.id, entry_type: 'balance', amount: balance, status: 'pending', due_date: addEventForm.event_date })
      }
      toast.success(`Event added for ${addEventLead.name}`)
      setShowAddEvent(false)
      setAddEventLead(null)
      setAddEventForm({ event_name: '', event_date: '', total: '', deposit: '', balance: '' })
    } catch (err) {
      console.error(err)
      toast.error('Failed to add event')
    }
  }

  async function handleImportQuote(quote: Quote) {
    if (!importTargetLead) return
    try {
      await linkQuote.mutateAsync({ quoteId: quote.id, leadId: importTargetLead.id })
      await updateLead.mutateAsync({ id: importTargetLead.id, budget: quote.total })
      // Advance status to "quoted" if still new
      if (importTargetLead.status === 'new') {
        await updateLead.mutateAsync({ id: importTargetLead.id, status: 'quoted' })
      }
      toast.success(`Quote ${formatCurrency(quote.total)} linked to ${importTargetLead.name}`)
      setShowQuoteImport(false)
      setImportTargetLead(null)
    } catch {
      toast.error('Failed to link quote')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return
    await deleteLead.mutateAsync(id)
    toast.success('Lead deleted')
  }

  async function handleGenerateContract(lead: Lead) {
    const linkedQuote = recentQuotes.find(q => q.lead_id === lead.id)

    // Sprint 4: validate required fields
    const missing: string[] = []
    if (!lead.name) missing.push('Client Name')
    if (!lead.email) missing.push('Client Email')
    if (!lead.phone) missing.push('Client Phone')
    if (!lead.event_date) missing.push('Event Date')
    if (!lead.event_type) missing.push('Event Type')
    if (!lead.venue_name) missing.push('Venue Name')
    if (!lead.venue_contact_name) missing.push('Venue Contact Name')
    if (!lead.venue_contact_phone) missing.push('Venue Contact Phone')
    if (!lead.venue_address) missing.push('Venue Address')
    if (!lead.service_start_time) missing.push('Service Start Time')
    if (!lead.service_end_time) missing.push('Service End Time')
    if (!lead.guest_count) missing.push('Guest Count')
    if (!linkedQuote) missing.push('Linked Quote (create one from calculator first)')

    if (missing.length > 0) {
      setMissingFields(missing)
      setContractValidationLead(lead)
      setShowContractValidation(true)
      return
    }

    const quote = linkedQuote!
    const total = quote.total
    const deposit = quote.deposit
    const balance = quote.balance

    const contractData = {
      leadId:              lead.id,
      clientName:          lead.name,
      clientEmail:         lead.email || '',
      clientPhone:         lead.phone || '',
      eventDate:           lead.event_date || '',
      eventType:           lead.event_type || '',
      venueName:           lead.venue_name || '',
      venueContactName:    lead.venue_contact_name || '',
      venueContactPhone:   lead.venue_contact_phone || '',
      venueAddress:        lead.venue_address || '',
      startTime:           lead.service_start_time || '',
      endTime:             lead.service_end_time || '',
      guestCount:          lead.guest_count ?? quote.guest_count ?? '',
      serviceHours:        quote.hours ?? 4,
      total:               total,
      deposit:             deposit,
      balance:             balance,
      breakdown:           quote.breakdown,
      addonNotes:          quote.addon_notes ?? '',
      leadNotes:           lead.notes ?? '',
      promoCode:           quote.promo_code,
      bartenders:          quote.bartenders,
    }

    const quotePayload = {
      total, deposit, balance,
      guestCount: quote.guest_count,
      hours: quote.hours,
      bartenders: quote.bartenders,
      breakdown: quote.breakdown,
      promoCode: quote.promo_code,
    }
    // Pass data via URL param — localStorage is domain-scoped so cross-origin writes don't work
    const booksData = encodeURIComponent(JSON.stringify({ contractData, quoteData: quotePayload }))
    // P2: auto-advance quote status to 'sent'
    try { await updateQuote.mutateAsync({ id: quote.id, status: 'sent' }) } catch { /* non-blocking */ }
    window.open(`https://www.513sips.com/tools/contract.html?booksData=${booksData}`, '_blank')
  }

  // Sprint 2: open calculator pre-filled for a lead
  // Opens calculator pre-filled; multi-event leads pass ?events=N to enable tabbed mode
  function handleCreateQuote(lead: Lead) {
    const n = lead.number_of_events ?? 1
    const eventsParam = n > 1 ? `&events=${n}` : ''
    const url = `https://www.513sips.com/tools/calculator.html?lead_id=${lead.id}&name=${encodeURIComponent(lead.name)}&guests=${lead.guest_count || ''}&date=${lead.event_date || ''}${eventsParam}`
    window.open(url, '_blank')
  }

  async function handleDeleteQuote(quoteId: string, leadId: string) {
    if (!confirm('Delete this quote?')) return
    try {
      await deleteQuote.mutateAsync(quoteId)
      await updateLead.mutateAsync({ id: leadId, budget: undefined })
      toast.success('Quote deleted')
    } catch {
      toast.error('Failed to delete quote')
    }
  }

  // Create a quote manually (without going through the calculator)
  async function handleCreateQuoteManual() {
    if (!createQuoteForLead) return
    const total = parseFloat(createQuoteForm.total) || 0
    const deposit = parseFloat(createQuoteForm.deposit) || Math.round(total * 0.5)
    const balance = parseFloat(createQuoteForm.balance) || (total - deposit)
    if (total > 0 && Math.abs(deposit + balance - total) > 0.01) {
      toast.error(`Deposit ($${deposit}) + Balance ($${balance}) must equal Total ($${total})`)
      return
    }
    try {
      const newQuote = await createQuote.mutateAsync({
        lead_id: createQuoteForLead.id,
        total,
        deposit,
        balance,
        guest_count: parseInt(createQuoteForm.guest_count) || undefined,
        hours: parseFloat(createQuoteForm.hours) || undefined,
        valid_until: createQuoteForm.valid_until || undefined,
        addon_notes: createQuoteForm.addon_notes || undefined,
        status: 'sent',
      })
      // Sync lead budget and advance status to quoted
      await updateLead.mutateAsync({
        id: createQuoteForLead.id,
        budget: total,
        ...(createQuoteForLead.status === 'new' ? { status: 'quoted' } : {}),
      })
      toast.success(`Quote created — ${newQuote.id.slice(0, 8)}`)
      setShowCreateQuote(false)
      setCreateQuoteForLead(null)
      setCreateQuoteForm({ total: '', deposit: '', balance: '', guest_count: '', hours: '', valid_until: '', addon_notes: '' })
    } catch {
      toast.error('Failed to create quote')
    }
  }

  // Sprint 3: save addon notes edit
  async function handleSaveAddonNotes(quoteId: string) {
    try {
      await updateQuote.mutateAsync({ id: quoteId, addon_notes: addonNotesValue })
      toast.success('Add-on notes saved')
      setEditingAddonNotes(null)
    } catch {
      toast.error('Failed to save notes')
    }
  }

  // Generate clean quote PDF directly from saved Supabase data — no calculator needed
  function handleDownloadQuotePDF(lead: Lead, quote: Quote) {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const numEvents = lead.number_of_events ?? 1
    const eventDate = lead.event_date
      ? new Date(lead.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD'
    const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // Build multi-event package block (only for numEvents > 1)
    let eventPkgBlock = ''
    if (numEvents > 1 && quote.addon_notes) {
      const lines = quote.addon_notes.split('\n').filter(l => l.trim())
      const eventRows = lines.map(line => {
        // Parse "Name: $Amount" or "Name — Detail: $Amount"
        const match = line.match(/^(.+?):\s*\$?([\d,]+(?:\.\d{0,2})?)$/)
        if (match) {
          const [, name, amount] = match
          const amt = parseFloat(amount.replace(/,/g, ''))
          return `<div class="evt-row"><span class="evt-name">${name.trim()}</span><span class="evt-amt">${fmt(amt)}</span></div>`
        }
        return `<div class="evt-row"><span class="evt-name">${line}</span><span class="evt-amt"></span></div>`
      }).join('')
      eventPkgBlock = `
        <div class="evt-pkg">
          <div class="evt-pkg-header">📋 ${numEvents}-Event Package Breakdown</div>
          ${eventRows}
          <div class="evt-subtotal"><span>${numEvents} events included in this quote</span><span style="font-weight:700;color:#5a4a00">${fmt(quote.total)} combined</span></div>
        </div>`
    }

    // Build itemized breakdown rows from stored breakdown object
    const bd = (quote.breakdown && typeof quote.breakdown === 'object' && !Array.isArray(quote.breakdown))
      ? quote.breakdown as Record<string, unknown>
      : null

    let breakdownRows = ''
    if (bd) {
      const base = typeof bd.base === 'number' ? bd.base : 650
      const baseLabel = bd.base === 395 ? 'Base — Small Group (2 hrs, ≤20 guests)' : 'Base Package (3 hrs, ≤50 guests)'
      breakdownRows += `<div class="brow"><span>${baseLabel}</span><span>${fmt(base)}</span></div>`
      if (typeof bd.staffing === 'number' && bd.staffing > 0)
        breakdownRows += `<div class="brow"><span>Additional Staffing</span><span>+${fmt(bd.staffing)}</span></div>`
      if (typeof bd.volume === 'number' && bd.volume > 0)
        breakdownRows += `<div class="brow"><span>High-Volume Adjustment</span><span>+${fmt(bd.volume)}</span></div>`
      if (typeof bd.extraHours === 'number' && bd.extraHours > 0)
        breakdownRows += `<div class="brow"><span>Extended Hours</span><span>+${fmt(bd.extraHours)}</span></div>`
      if (typeof bd.twoHrReduction === 'number' && bd.twoHrReduction > 0)
        breakdownRows += `<div class="brow green"><span>2-Hour Service</span><span>-${fmt(bd.twoHrReduction)}</span></div>`
      if (typeof bd.package === 'number' && bd.package > 0)
        breakdownRows += `<div class="brow"><span>Full Bar Upgrade</span><span>+${fmt(bd.package)}</span></div>`
      if (typeof bd.glassware === 'number' && bd.glassware > 0)
        breakdownRows += `<div class="brow"><span>Glassware</span><span>+${fmt(bd.glassware)}</span></div>`
      if (typeof bd.travel === 'number' && bd.travel > 0)
        breakdownRows += `<div class="brow"><span>Travel Fee</span><span>+${fmt(bd.travel)}</span></div>`
      if (typeof bd.cocktails === 'number' && bd.cocktails > 0)
        breakdownRows += `<div class="brow gold"><span>Signature Cocktails</span><span>+${fmt(bd.cocktails)}</span></div>`
      if (typeof bd.addons === 'number' && bd.addons > 0)
        breakdownRows += `<div class="brow gold"><span>Premium Add-Ons</span><span>+${fmt(bd.addons)}</span></div>`
      if (typeof bd.custom === 'number' && bd.custom > 0)
        breakdownRows += `<div class="brow gold"><span>Custom Add-Ons</span><span>+${fmt(bd.custom)}</span></div>`
      if (typeof bd.discount === 'number' && bd.discount > 0) {
        const promoLabel = quote.promo_code ? quote.promo_code : 'Adjustment'
        breakdownRows += `<div class="brow green"><span>${promoLabel}</span><span>-${fmt(bd.discount)}</span></div>`
      }
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>513 Sips Quote — ${lead.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Georgia,'Times New Roman',serif;color:#111;background:#fff;padding:48px;max-width:720px;margin:0 auto}
  .header{text-align:center;border-bottom:3px solid #D4AF37;padding-bottom:24px;margin-bottom:32px}
  .brand{font-size:36px;color:#D4AF37;font-weight:bold;letter-spacing:3px}
  .tagline{font-size:12px;color:#777;margin-top:6px;letter-spacing:2px;text-transform:uppercase}
  .doc-title{font-size:22px;color:#0A1628;margin-top:28px;text-align:center;font-weight:normal;letter-spacing:1px}
  .doc-date{text-align:center;color:#999;font-size:12px;margin-top:6px}
  .section{margin:24px 0}
  .section-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#D4AF37;border-bottom:1px solid #D4AF37;padding-bottom:5px;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 32px}
  .field{display:flex;flex-direction:column}
  .label{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
  .value{font-size:14px;color:#111}
  .breakdown{border:1px solid #e8e0c0;border-radius:8px;overflow:hidden;margin-top:8px}
  .brow{display:flex;justify-content:space-between;padding:9px 16px;border-bottom:1px solid #f0e8d0;font-size:14px}
  .brow:last-child{border-bottom:none}
  .brow.gold{color:#8a6a00}
  .brow.green{color:#2e7d32}
  .evt-pkg{background:#f8f4e8;border:2px solid #D4AF37;border-radius:8px;overflow:hidden;margin-bottom:16px}
  .evt-pkg-header{background:#D4AF37;color:#0A1628;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;padding:8px 16px}
  .evt-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #e8d880;font-size:14px}
  .evt-row:last-child{border-bottom:none}
  .evt-row .evt-name{font-weight:600;color:#0A1628}
  .evt-row .evt-amt{font-weight:700;color:#8a6a00;font-size:15px}
  .evt-subtotal{display:flex;justify-content:space-between;padding:10px 16px;background:#ede8c8;font-size:13px;color:#555;border-top:1px solid #d4c870}
  .totals{margin-top:16px;border:1px solid #e8e0c0;border-radius:8px;overflow:hidden}
  .trow{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #f0e8d0;font-size:14px}
  .trow:last-child{border-bottom:none}
  .trow.total{background:#0A1628;color:#FAF8F3;font-weight:600}
  .trow.total span:last-child{font-size:20px;color:#D4AF37}
  .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa}
  @media print{body{padding:28px}}
</style></head>
<body>
<div class="header">
  <div class="brand">513 SIPS</div>
  <div class="tagline">Mobile Craft Bartending · Cincinnati, OH</div>
</div>
<div class="doc-title">Service Quote</div>
<div class="doc-date">Prepared ${today}${quote.valid_until ? ` · Valid until ${new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ' · Valid for 30 days'}</div>

<div class="section">
  <div class="section-title">Client Information</div>
  <div class="grid">
    <div class="field"><span class="label">Client Name</span><span class="value">${lead.name}</span></div>
    <div class="field"><span class="label">Event Type</span><span class="value">${lead.event_type || '—'}</span></div>
    <div class="field"><span class="label">Email</span><span class="value">${lead.email || '—'}</span></div>
    <div class="field"><span class="label">Phone</span><span class="value">${lead.phone || '—'}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Event Details</div>
  <div class="grid">
    <div class="field"><span class="label">Event Date</span><span class="value">${eventDate}</span></div>
    <div class="field"><span class="label">Venue</span><span class="value">${lead.venue_name || lead.venue_address || '—'}</span></div>
    <div class="field"><span class="label">Guest Count</span><span class="value">${lead.guest_count ?? quote.guest_count ?? '—'}</span></div>
    <div class="field"><span class="label">Service Hours</span><span class="value">${quote.hours ?? 3} hours</span></div>
    ${lead.service_start_time ? `<div class="field"><span class="label">Service Time</span><span class="value">${lead.service_start_time}${lead.service_end_time ? ' – ' + lead.service_end_time : ''}</span></div>` : ''}
    ${quote.bartenders ? `<div class="field"><span class="label">Bar Staff</span><span class="value">${quote.bartenders} bartender${quote.bartenders > 1 ? 's' : ''}</span></div>` : ''}
    ${numEvents > 1 ? `<div class="field" style="grid-column:1/-1"><span class="label">Package</span><span class="value">${numEvents}-Event Package</span></div>` : ''}
  </div>
</div>

<div class="section">
  <div class="section-title">Pricing</div>
  ${eventPkgBlock}
  ${breakdownRows ? `<div class="breakdown">${breakdownRows}</div>` : ''}
  <div class="totals" style="${breakdownRows ? 'margin-top:12px' : ''}">
    <div class="trow total">
      <span>Total Investment</span>
      <span>${fmt(quote.total)}</span>
    </div>
    <div class="trow"><span>Deposit (50% — due to secure date)</span><span>${fmt(quote.deposit)}</span></div>
    <div class="trow"><span>Balance (due on event date)</span><span>${fmt(quote.balance)}</span></div>
  </div>
</div>

<div class="footer">513 Sips LLC · Cincinnati, OH · 513sips.com · instagram.com/513sips</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  // Open calculator with lead pre-loaded — Eddie uses "Export Quote to PDF" from there
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleExportQuotePDF(_quote: Quote) {
    if (importTargetLead) {
      handleCreateQuote(importTargetLead)
    } else {
      window.open('https://www.513sips.com/tools/calculator.html', '_blank')
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold">Leads</h1>
          <p className="text-cream/50 text-sm mt-0.5">Track inquiries from Instagram, referrals & more</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? 'text-gold bg-gold/10' : 'text-cream/40 hover:text-cream'}`}
            title="Card view"
          ><LayoutGrid size={16} /></button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'text-gold bg-gold/10' : 'text-cream/40 hover:text-cream'}`}
            title="List view"
          ><List size={16} /></button>
          <Button onClick={openNew}><Plus size={16} /> New Lead</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads"    value={String(stats.total)}   color="text-gold" />
        <StatCard label="New / Unread"   value={String(stats.new)}     color="text-blue-300" />
        <StatCard label="Booked"         value={String(stats.booked)}  color="text-success" />
        <StatCard label="Wtd. Pipeline" value={formatCurrency(stats.pipeline)} color="text-warning" />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name, email, venue..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-navy-lighter border border-gold-dim rounded-lg px-3 py-1.5 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-gold/50"
        />
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-gold text-navy-dark'
                  : 'bg-white/5 text-cream/60 hover:text-cream'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lead Cards / List */}
      {isLoading ? (
        <p className="text-cream/50 text-center py-10">Loading leads...</p>
      ) : leads.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Instagram size={40} className="mx-auto text-cream/20 mb-3" />
            <p className="text-cream/50">No leads yet. Add your first one!</p>
            <Button className="mt-4" onClick={openNew}><Plus size={16} /> Add Lead</Button>
          </div>
        </Card>
      ) : viewMode === 'list' ? (
        /* ── LIST VIEW ── */
        <div className="flex flex-col gap-1.5">
          {leads.filter(lead => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return (
              lead.name.toLowerCase().includes(q) ||
              lead.email?.toLowerCase().includes(q) ||
              lead.phone?.includes(q) ||
              lead.venue_name?.toLowerCase().includes(q) ||
              lead.notes?.toLowerCase().includes(q) ||
              lead.event_type?.toLowerCase().includes(q)
            )
          }).map(lead => {
            const linkedQuote = recentQuotes.find(q => q.lead_id === lead.id)
            return (
              <div key={lead.id} className="bg-navy-lighter/50 border border-white/5 rounded-lg px-4 py-2.5 flex items-center gap-3 hover:border-gold/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-cream text-sm">{lead.name}</span>
                    <span>{SOURCE_CONFIG[lead.source]?.icon}</span>
                    {lead.converted_event_id && <CheckCircle2 size={11} className="text-success" />}
                  </div>
                  <div className="text-xs text-cream/40 mt-0.5">
                    {[lead.event_type, lead.event_date && formatDate(lead.event_date), lead.guest_count && `${lead.guest_count} guests`].filter(Boolean).join(' · ') || 'No details yet'}
                  </div>
                </div>
                <div className="shrink-0 text-right w-24 hidden sm:block">
                  {linkedQuote
                    ? <div className="text-gold font-semibold text-sm">{formatCurrency(linkedQuote.total)}</div>
                    : lead.budget
                    ? <div className="text-cream/40 text-sm">{formatCurrency(lead.budget)}</div>
                    : <div className="text-cream/20 text-xs">No quote</div>
                  }
                  <div className="text-xs text-cream/30">{lead.probability ?? 50}% win</div>
                </div>
                <div className="shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[lead.status]?.color}`}>
                    {STATUS_CONFIG[lead.status]?.label}
                  </span>
                </div>
                <div className="shrink-0 flex items-center gap-0.5">
                  <button onClick={() => handleCreateQuote(lead)} className="text-cream/40 hover:text-gold p-1.5 rounded" title="Open Calculator"><FileText size={13}/></button>
                  <button onClick={() => handleGenerateContract(lead)} className="text-cream/40 hover:text-gold p-1.5 rounded" title="Generate Contract"><FileSignature size={13}/></button>
                  <button onClick={() => openEdit(lead)} className="text-cream/40 hover:text-gold p-1.5 rounded" title="Edit lead"><Edit2 size={13}/></button>
                  <button onClick={() => handleDelete(lead.id)} className="text-cream/40 hover:text-red-400 p-1.5 rounded" title="Delete"><Trash2 size={13}/></button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── CARD VIEW (collapsible) ── */
        <div className="grid gap-3 md:grid-cols-2">
          {leads.filter(lead => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return (
              lead.name.toLowerCase().includes(q) ||
              lead.email?.toLowerCase().includes(q) ||
              lead.phone?.includes(q) ||
              lead.venue_name?.toLowerCase().includes(q) ||
              lead.notes?.toLowerCase().includes(q) ||
              lead.event_type?.toLowerCase().includes(q)
            )
          }).map(lead => {
            const linkedQuote = recentQuotes.find(q => q.lead_id === lead.id)
            const { data: estimate } = useAlcoholEstimatesByLead(lead.id)
            const isExpanded = expandedCards.has(lead.id)
            return (
              <Card key={lead.id} className="hover:border-gold/30 transition-colors">
                {/* Clickable header — always visible */}
                <button
                  className="w-full text-left flex items-center gap-2"
                  onClick={() => toggleCard(lead.id)}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-cream">{lead.name}</span>
                    <span>{SOURCE_CONFIG[lead.source]?.icon}</span>
                    {lead.event_date && <span className="text-xs text-cream/40 hidden sm:inline">{formatDate(lead.event_date)}</span>}
                    {lead.event_type && <span className="text-xs text-cream/30 hidden sm:inline">{lead.event_type}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {linkedQuote && <span className="text-sm font-semibold text-gold">{formatCurrency(linkedQuote.total)}</span>}
                    {lead.converted_event_id && <CheckCircle2 size={12} className="text-success" />}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[lead.status]?.color}`}>
                      {STATUS_CONFIG[lead.status]?.label}
                    </span>
                    <ChevronDown size={14} className={`text-cream/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expandable body */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 text-sm text-cream/70">
                      {lead.email && (
                        <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1 truncate">
                          <Mail size={13} className="text-gold/60 shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1.5"><Phone size={13} className="text-gold/60" />{lead.phone}</div>
                      )}
                      {lead.event_date && (
                        <div className="flex items-center gap-1.5"><Calendar size={13} className="text-gold/60" />{formatDate(lead.event_date)}</div>
                      )}
                      {lead.guest_count && (
                        <div className="flex items-center gap-1.5"><Users size={13} className="text-gold/60" />{lead.guest_count} guests</div>
                      )}
                      {(lead.budget || linkedQuote) && (
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={13} className="text-gold/60" />
                          {linkedQuote ? (
                            <span className="text-gold">{formatCurrency(linkedQuote.total)} <span className="text-cream/40 text-xs">(quoted)</span></span>
                          ) : (
                            <span>Budget: {formatCurrency(lead.budget!)}</span>
                          )}
                        </div>
                      )}
                      {lead.event_type && (
                        <div className="flex items-center gap-1.5 text-cream/70">🎉 {lead.event_type}</div>
                      )}
                    </div>

                    {lead.venue_name && (
                      <p className="text-xs text-cream/40">📍 {lead.venue_name}{lead.service_start_time ? ` · ${lead.service_start_time}–${lead.service_end_time || '?'}` : ''}</p>
                    )}

                    {lead.notes && (
                      <p className="text-xs text-cream/50 italic line-clamp-2">"{lead.notes}"</p>
                    )}

                    {/* Quote strip */}
                    {linkedQuote && (
                      <div className="rounded-md bg-gold/5 border border-gold/15 px-3 py-2">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0]
                          const isExpired = linkedQuote.valid_until && linkedQuote.valid_until < today
                          const expiresSoon = linkedQuote.valid_until && !isExpired &&
                            (new Date(linkedQuote.valid_until).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000
                          return (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-gold font-semibold">{formatCurrency(linkedQuote.total)}</span>
                                  <span className="text-cream/40">·</span>
                                  <span className="text-cream/50">Dep: {formatCurrency(linkedQuote.deposit)}</span>
                                  <span className="text-cream/40">·</span>
                                  <span className="text-cream/50">Bal: {formatCurrency(linkedQuote.balance)}</span>
                                </div>
                                {(linkedQuote.guest_count || linkedQuote.hours || linkedQuote.bartenders) && (
                                  <div className="text-xs text-cream/35 mt-0.5">
                                    {[
                                      linkedQuote.guest_count && `${linkedQuote.guest_count} guests`,
                                      linkedQuote.hours && `${linkedQuote.hours}h`,
                                      linkedQuote.bartenders && `${linkedQuote.bartenders} bar staff`,
                                    ].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                                {linkedQuote.valid_until && (
                                  <div className={`flex items-center gap-1 text-xs mt-1 ${
                                    isExpired ? 'text-danger' : expiresSoon ? 'text-warning' : 'text-cream/40'
                                  }`}>
                                    {isExpired
                                      ? <><AlertCircle size={10} /> Expired {formatDate(linkedQuote.valid_until)}</>
                                      : expiresSoon
                                      ? <><Clock size={10} /> Expires {formatDate(linkedQuote.valid_until)} — soon!</>
                                      : <><Clock size={10} /> Valid until {formatDate(linkedQuote.valid_until)}</>
                                    }
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  linkedQuote.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                                  linkedQuote.status === 'sent'     ? 'bg-blue-500/20 text-blue-300' :
                                  linkedQuote.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                                                      'bg-white/5 text-cream/40'
                                }`}>{linkedQuote.status}</span>
                                <button onClick={() => { setVersionHistoryQuote(linkedQuote); setShowVersionHistory(true) }} className="text-cream/25 hover:text-gold transition-colors" title="View version history"><History size={11} /></button>
                                <button onClick={() => handleDownloadQuotePDF(lead, linkedQuote)} className="text-cream/25 hover:text-gold transition-colors" title="Download PDF"><FileDown size={11} /></button>
                                <button onClick={() => handleCreateQuote(lead)} className="text-cream/25 hover:text-gold transition-colors" title="Revise in calculator"><Pencil size={11} /></button>
                                <button onClick={() => handleDeleteQuote(linkedQuote.id, lead.id)} className="text-cream/25 hover:text-red-400 transition-colors" title="Delete quote"><Trash2 size={11} /></button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {/* Contract status */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {lead.unsigned_contract_url ? (
                        <a
                          href={lead.unsigned_contract_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md hover:bg-blue-500/30 transition-colors"
                        >
                          <FileText size={11} /> Unsigned ✓
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-white/5 text-cream/40 rounded-md">
                          <FileText size={11} /> Unsigned ○
                        </span>
                      )}
                      {lead.signed_contract_url ? (
                        <a
                          href={lead.signed_contract_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-md hover:bg-green-500/30 transition-colors"
                        >
                          <FileText size={11} /> Signed ✓
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 bg-white/5 text-cream/40 rounded-md">
                          <FileText size={11} /> Signed ○
                        </span>
                      )}
                    </div>

                    {/* Alcohol estimate strip */}
                    {estimate && (
                      <div className="rounded-md bg-amber-500/5 border border-amber-500/15 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-amber-300 font-semibold">🍾 Alcohol Estimate</span>
                              <span className="text-cream/40">·</span>
                              <span className="text-cream/50">{estimate.total_bottles} bottles</span>
                            </div>
                            {Object.entries(estimate.breakdown).filter(([,v]) => typeof v === 'number' && v > 0).length > 0 && (
                              <div className="text-xs text-cream/35 mt-0.5">
                                {[
                                  estimate.breakdown.wine && `${estimate.breakdown.wine} wine`,
                                  estimate.breakdown.beer && `${estimate.breakdown.beer} beer`,
                                  estimate.breakdown.spirits && `${estimate.breakdown.spirits} spirits`,
                                  estimate.breakdown.champagne && `${estimate.breakdown.champagne} champagne`,
                                  estimate.breakdown.seltzer && `${estimate.breakdown.seltzer} seltzer`,
                                ].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          <a
                            href="https://www.513sips.com/tools/alcohol-estimator.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded"
                            title="Open alcohol estimator"
                          ><ExternalLink size={13} /></a>
                        </div>
                      </div>
                    )}

                    {/* Multi-event progress */}
                    {(lead.number_of_events ?? 1) > 1 && (() => {
                      const linkedForLead = linkedEvents.filter(e => e.lead_id === lead.id)
                      const bookedCount = linkedForLead.length
                      const totalEvents = lead.number_of_events ?? 1
                      const atCapacity = bookedCount >= totalEvents
                      const quote = recentQuotes.find(q => q.lead_id === lead.id)
                      const perEventAmt = quote ? Math.round(quote.total / totalEvents) : undefined
                      return (
                        <div className="rounded-md bg-blue-500/5 border border-blue-500/15 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`font-semibold ${atCapacity ? 'text-green-300' : 'text-blue-300'}`}>
                                  {atCapacity ? '✓' : <CalendarPlus size={11} className="inline mr-0.5" />}
                                  {bookedCount} of {totalEvents} events added
                                </span>
                                {perEventAmt && !atCapacity && (
                                  <span className="text-cream/40">· ~{formatCurrency(perEventAmt)}/event</span>
                                )}
                              </div>
                              {linkedForLead.map(e => (
                                <div key={e.id} className="text-xs text-cream/35 mt-0.5">
                                  {e.event_name || 'Event'}{e.event_date ? ` · ${formatDate(e.event_date)}` : ' · Date TBD'}
                                </div>
                              ))}
                            </div>
                            {!atCapacity && (
                              <button
                                onClick={() => {
                                  const nextNum = bookedCount + 1
                                  setAddEventLead(lead)
                                  setAddEventForm({
                                    event_name: `${lead.name} — Event ${nextNum}`,
                                    event_date: '',
                                    total: String(perEventAmt || ''),
                                    deposit: String(perEventAmt ? Math.round(perEventAmt * 0.5) : ''),
                                    balance: String(perEventAmt ? perEventAmt - Math.round(perEventAmt * 0.5) : ''),
                                  })
                                  setShowAddEvent(true)
                                }}
                                className="text-blue-300 hover:text-blue-200 text-xs px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20 hover:bg-blue-500/20 transition-colors shrink-0 flex items-center gap-1"
                              >
                                <CalendarPlus size={11} /> Add Event
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Win probability slider */}
                    {lead.status !== 'lost' && (
                      <div className="flex items-center gap-2 text-xs py-1">
                        <span className="text-cream/40 shrink-0 w-9">Win %</span>
                        <input
                          type="range" min="0" max="100" step="5"
                          value={localProb[lead.id] ?? lead.probability ?? 50}
                          onChange={e => setLocalProb(p => ({ ...p, [lead.id]: Number(e.target.value) }))}
                          onPointerUp={e => updateLead.mutate({ id: lead.id, probability: Number((e.target as HTMLInputElement).value) })}
                          className="flex-1 accent-gold cursor-pointer"
                          style={{ height: '4px' }}
                        />
                        <span className="text-gold font-semibold w-9 text-right shrink-0">{localProb[lead.id] ?? lead.probability ?? 50}%</span>
                      </div>
                    )}

                    {/* Status + actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <select
                        value={lead.status}
                        onChange={e => handleStatusChange(lead, e.target.value as Lead['status'])}
                        className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-cream/70 focus:outline-none focus:border-gold/50"
                      >
                        {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        {!linkedQuote && (
                          <button
                            onClick={() => {
                              setCreateQuoteForLead(lead)
                              const n = lead.number_of_events ?? 1
                              const perEvent = lead.budget ? Math.round(lead.budget / n) : 0
                              const template = n > 1
                                ? Array.from({ length: n }, (_, i) =>
                                    `Event ${i + 1} — ${lead.event_type || 'Event'}: $${perEvent || ''}`
                                  ).join('\n')
                                : ''
                              setCreateQuoteForm({
                                total: String(lead.budget || ''),
                                deposit: lead.budget ? String(Math.round(lead.budget * 0.5)) : '',
                                balance: lead.budget ? String(lead.budget - Math.round(lead.budget * 0.5)) : '',
                                guest_count: String(lead.guest_count || ''),
                                hours: '', valid_until: '',
                                addon_notes: template,
                              })
                              setShowCreateQuote(true)
                            }}
                            className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded"
                            title="Create quote (manual entry)"
                          ><Plus size={15} /></button>
                        )}
                        <button onClick={() => { setImportTargetLead(lead); setShowQuoteImport(true) }} className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded" title="Link quote from Calculator"><Download size={15} /></button>
                        <button onClick={() => handleCreateQuote(lead)} className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded" title="Create Quote in Calculator"><FileText size={15} /></button>
                        <button onClick={() => handleGenerateContract(lead)} className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded" title="Generate contract"><FileSignature size={15} /></button>
                        <button onClick={() => openEdit(lead)} className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded"><Edit2 size={15} /></button>
                        <button onClick={() => handleDelete(lead.id)} className="text-cream/40 hover:text-red-400 transition-colors p-1.5 rounded"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Book Confirmation Modal */}
      <Modal
        open={showBookConfirm}
        onClose={() => { setShowBookConfirm(false); setBookingLead(null); setBookingQuote(null); setBookingEventAmount('') }}
        title="Confirm Booking"
      >
        {bookingLead && (
          <div className="space-y-4">
            <div className="bg-navy-lighter rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-cream/60">Client</span>
                <span className="text-cream font-medium">{bookingLead.name}</span>
              </div>
              {bookingLead.event_date && (
                <div className="flex justify-between">
                  <span className="text-cream/60">Event Date</span>
                  <span className="text-cream">{formatDate(bookingLead.event_date)}</span>
                </div>
              )}
              {bookingLead.event_type && (
                <div className="flex justify-between">
                  <span className="text-cream/60">Event Type</span>
                  <span className="text-cream">{bookingLead.event_type}</span>
                </div>
              )}
              {bookingQuote ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-cream/60">Total</span>
                    <span className="text-gold font-bold">{formatCurrency(bookingQuote.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream/60">Deposit</span>
                    <span className="text-cream">{formatCurrency(bookingQuote.deposit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream/60">Balance</span>
                    <span className="text-cream">{formatCurrency(bookingQuote.balance)}</span>
                  </div>
                </>
              ) : bookingLead.budget ? (
                <div className="flex justify-between">
                  <span className="text-cream/60">Budget / Total</span>
                  <span className="text-gold font-bold">{formatCurrency(bookingLead.budget)}</span>
                </div>
              ) : (
                <p className="text-warning text-xs">No quote linked — event will be created with $0 total. You can edit it on the Events page.</p>
              )}
            </div>
            {(bookingLead.number_of_events ?? 1) > 1 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                <p className="text-blue-300 text-xs font-medium">
                  Multi-event booking · {bookingLead.number_of_events} events total — creating Event 1
                </p>
                <div className="flex items-center gap-2">
                  <label className="text-cream/60 text-xs shrink-0">Event 1 Amount ($)</label>
                  <input
                    type="number"
                    value={bookingEventAmount}
                    onChange={e => setBookingEventAmount(e.target.value)}
                    className="flex-1 bg-navy-lighter border border-gold-dim rounded px-2 py-1 text-cream text-sm"
                  />
                </div>
                <p className="text-cream/40 text-xs">Add remaining events from the lead card after booking.</p>
              </div>
            )}
            <p className="text-sm text-cream/60">
              This will create an Event record and AR entries (deposit + balance), then mark this lead as Booked.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleConfirmBooking}>
                <CheckCircle2 size={16} /> Confirm Booking
              </Button>
              <Button variant="secondary" onClick={() => { setShowBookConfirm(false); setBookingLead(null); setBookingQuote(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quote Import Modal */}
      <Modal
        open={showQuoteImport}
        onClose={() => { setShowQuoteImport(false); setImportTargetLead(null) }}
        title={`Link Quote → ${importTargetLead?.name || ''}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-cream/60 mb-4">
            Select a quote saved from the Calculator tool. It will be linked to this lead and update the budget.
          </p>
          {recentQuotes.filter(q => !q.lead_id || q.lead_id === importTargetLead?.id).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-cream/50 mb-4">No unlinked quotes found.</p>
              <a
                href="https://www.513sips.com/tools/calculator.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button><ExternalLink size={14} /> Open Calculator</Button>
              </a>
              <p className="text-xs text-cream/40 mt-3">Hit "Save to Books" after calculating</p>
            </div>
          ) : (
            recentQuotes
              .filter(q => !q.lead_id || q.lead_id === importTargetLead?.id)
              .map(quote => (
                <div key={quote.id} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                  {/* Click to link */}
                  <button
                    onClick={() => handleImportQuote(quote)}
                    className="w-full text-left p-4 hover:bg-gold/10 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-gold font-bold text-lg">{formatCurrency(quote.total)}</span>
                        <span className="text-cream/50 text-xs ml-2">
                          {quote.guest_count} guests · {quote.hours}h · {quote.bartenders} bartender{quote.bartenders !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-cream/40">{formatDate(quote.created_at)}</div>
                        {quote.event_date && <div className="text-xs text-gold/60">Event: {formatDate(quote.event_date)}</div>}
                      </div>
                    </div>
                    <div className="text-xs text-cream/40 mt-1">
                      Deposit: {formatCurrency(quote.deposit)} · Balance: {formatCurrency(quote.balance)}
                    </div>
                  </button>

                  {/* Sprint 3: Pricing breakdown */}
                  {quote.breakdown && typeof quote.breakdown === 'object' && !Array.isArray(quote.breakdown) && (
                    <div className="px-4 pb-2 pt-1 border-t border-white/5">
                      <div className="space-y-0.5">
                        {(Object.entries(quote.breakdown as Record<string, unknown>) as [string, unknown][])
                          .filter(([k, v]) => typeof v === 'number' && (v as number) > 0 && !['addonsList', 'customList'].includes(k))
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between text-xs text-cream/50">
                              <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span>{formatCurrency(v as number)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Sprint 3: Addon Notes */}
                  <div className="px-4 py-2 border-t border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-cream/40 font-medium">Add-on Notes</span>
                      <button
                        onClick={() => { setEditingAddonNotes(quote.id); setAddonNotesValue(quote.addon_notes || '') }}
                        className="text-cream/30 hover:text-gold transition-colors p-0.5"
                        title="Edit add-on notes"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                    {editingAddonNotes === quote.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          className="w-full text-xs resize-none bg-white/5 border border-white/10 rounded px-2 py-1.5 text-cream/80 focus:outline-none focus:border-gold/50"
                          rows={3}
                          value={addonNotesValue}
                          onChange={e => setAddonNotesValue(e.target.value)}
                          placeholder="e.g., bourbon-forward cocktails, outdoor venue..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveAddonNotes(quote.id)}
                            className="text-xs px-2 py-1 bg-gold/20 text-gold rounded hover:bg-gold/30 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingAddonNotes(null)}
                            className="text-xs px-2 py-1 bg-white/5 text-cream/50 rounded hover:bg-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-cream/50 italic">
                        {quote.addon_notes || <span className="text-cream/25">None</span>}
                      </p>
                    )}
                  </div>

                  {/* Sprint 3: Export PDF */}
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => handleExportQuotePDF(quote)}
                      className="text-xs text-gold/60 hover:text-gold flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={11} /> Export Quote PDF
                    </button>
                  </div>
                </div>
              ))
          )}
          <div className="pt-2 border-t border-white/5 text-center">
            <a
              href="https://www.513sips.com/tools/calculator.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gold/60 hover:text-gold flex items-center justify-center gap-1"
            >
              <ExternalLink size={11} /> Open Calculator to create a new quote
            </a>
          </div>
        </div>
      </Modal>

      {/* Create Quote Modal — manual entry without calculator */}
      <Modal
        open={showCreateQuote}
        onClose={() => { setShowCreateQuote(false); setCreateQuoteForLead(null); setCreateQuoteForm({ total: '', deposit: '', balance: '', guest_count: '', hours: '', valid_until: '', addon_notes: '' }) }}
        title={`Create Quote — ${createQuoteForLead?.name || ''}`}
        preventBackdropClose
      >
        <div className="space-y-4">
          <p className="text-xs text-cream/50 bg-gold/5 border border-gold/15 rounded-lg px-3 py-2">
            Enter the numbers you've already quoted. You can edit these anytime from the lead card.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Total ($) *</label>
              <input
                type="number" step="0.01" placeholder="0.00"
                value={createQuoteForm.total}
                onChange={e => {
                  const total = parseFloat(e.target.value) || 0
                  const dep = Math.round(total * 0.5)
                  setCreateQuoteForm(f => ({ ...f, total: e.target.value, deposit: String(dep), balance: String(total - dep) }))
                }}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Deposit ($)</label>
              <input
                type="number" step="0.01" placeholder="auto 50%"
                value={createQuoteForm.deposit}
                onChange={e => setCreateQuoteForm(f => ({ ...f, deposit: e.target.value, balance: String((parseFloat(f.total) || 0) - (parseFloat(e.target.value) || 0)) }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Balance ($)</label>
              <input
                type="number" step="0.01" placeholder="auto"
                value={createQuoteForm.balance}
                onChange={e => setCreateQuoteForm(f => ({ ...f, balance: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Guest Count</label>
              <input
                type="number" placeholder={String(createQuoteForLead?.guest_count || '')}
                value={createQuoteForm.guest_count}
                onChange={e => setCreateQuoteForm(f => ({ ...f, guest_count: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Service Hours</label>
              <input
                type="number" step="0.5" placeholder="4"
                value={createQuoteForm.hours}
                onChange={e => setCreateQuoteForm(f => ({ ...f, hours: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                Valid Until
                <span className="ml-1 text-warning/70">(expiration)</span>
              </label>
              <input
                type="date"
                value={createQuoteForm.valid_until}
                onChange={e => setCreateQuoteForm(f => ({ ...f, valid_until: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
          </div>
          {createQuoteForm.valid_until && (
            <p className="text-xs text-warning/70 flex items-center gap-1.5">
              <Clock size={12} />
              Quote will show as expired after {formatDate(createQuoteForm.valid_until)}
            </p>
          )}

          {/* Multi-event breakdown — only shown when lead has >1 event */}
          {(createQuoteForLead?.number_of_events ?? 1) > 1 && (
            <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">📋 Event Breakdown</span>
                <span className="text-xs text-cream/40">(shown prominently on PDF — one event per line)</span>
              </div>
              <textarea
                rows={createQuoteForLead?.number_of_events ?? 2}
                placeholder={`Event 1 — Women's Night: $500\nEvent 2 — Men's Night + Custom Ice: $750`}
                value={createQuoteForm.addon_notes}
                onChange={e => setCreateQuoteForm(f => ({ ...f, addon_notes: e.target.value }))}
                className="w-full bg-navy-lighter border border-blue-500/30 rounded-lg px-3 py-2 text-cream text-sm resize-none font-mono"
              />
              <p className="text-xs text-cream/35">Format: <code className="text-blue-300">Event N — Description: $Amount</code> — each line becomes a row on the quote PDF</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={handleCreateQuoteManual}
              disabled={!createQuoteForm.total || parseFloat(createQuoteForm.total) <= 0}
            >
              Save Quote
            </Button>
            <Button variant="secondary" onClick={() => { setShowCreateQuote(false); setCreateQuoteForLead(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editLead ? 'Edit Lead' : 'New Lead'}
        preventBackdropClose
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-cream/50 mb-1">Client Name *</label>
            <input
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              placeholder="Sarah Johnson"
              value={form.name}
              onChange={set('name')}
              required
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Email</label>
              <input
                type="email"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                placeholder="sarah@email.com"
                value={form.email}
                onChange={set('email')}
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Phone</label>
              <input
                type="tel"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                placeholder="(513) 555-0100"
                value={form.phone}
                onChange={set('phone')}
              />
            </div>
          </div>

          {/* Source + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">How'd they find you?</label>
              <select
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                value={form.source}
                onChange={set('source')}
              >
                {Object.entries(SOURCE_CONFIG).map(([v, { label, icon }]) => (
                  <option key={v} value={v}>{icon} {label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Status</label>
              <select
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                value={form.status}
                onChange={set('status')}
              >
                {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Event details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Event Date</label>
              <input
                type="date"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                value={form.event_date}
                onChange={set('event_date')}
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Event Type</label>
              <select
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                value={form.event_type}
                onChange={set('event_type')}
              >
                <option value="">Select type...</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Guest Count</label>
              <input
                type="number"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                placeholder="75"
                value={form.guest_count}
                onChange={set('guest_count')}
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Budget</label>
              <input
                type="number"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                placeholder="800"
                value={form.budget}
                onChange={set('budget')}
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">
                # of Events
                <span className="ml-1 text-cream/30">(default 1)</span>
              </label>
              <input
                type="number"
                min="1"
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                placeholder="1"
                value={form.number_of_events}
                onChange={set('number_of_events')}
              />
            </div>
          </div>

          {/* Venue & Timing */}
          <details className="border border-white/10 rounded-lg">
            <summary className="px-3 py-2 text-xs text-cream/60 cursor-pointer hover:text-cream select-none">
              Venue &amp; Timing (needed for contracts)
            </summary>
            <div className="px-3 pb-3 space-y-3 pt-2">
              <div>
                <label className="block text-xs text-cream/50 mb-1">Venue Name</label>
                <input
                  className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                  placeholder="The Grand Ballroom"
                  value={form.venue_name}
                  onChange={set('venue_name')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Venue Contact Name</label>
                  <input
                    className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                    placeholder="Venue Manager"
                    value={form.venue_contact_name}
                    onChange={set('venue_contact_name')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Venue Contact Phone</label>
                  <input
                    type="tel"
                    className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                    placeholder="(513) 555-0199"
                    value={form.venue_contact_phone}
                    onChange={set('venue_contact_phone')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-cream/50 mb-1">Venue Address</label>
                <textarea
                  className="w-full resize-none bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                  rows={2}
                  placeholder="123 Main St, Cincinnati, OH 45202"
                  value={form.venue_address}
                  onChange={set('venue_address')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Service Start Time</label>
                  <input
                    type="time"
                    className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                    value={form.service_start_time}
                    onChange={set('service_start_time')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Service End Time</label>
                  <input
                    type="time"
                    className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
                    value={form.service_end_time}
                    onChange={set('service_end_time')}
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Notes */}
          <div>
            <label className="block text-xs text-cream/50 mb-1">Notes</label>
            <textarea
              className="w-full h-20 resize-none bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              placeholder="Birthday party for 50th, wants tropical theme, reached out via Instagram DM..."
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={createLead.isPending || updateLead.isPending}>
              {editLead ? 'Save Changes' : 'Add Lead'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Sprint 4: Contract Missing Fields Validation Modal */}
      <Modal
        open={showContractValidation}
        onClose={() => setShowContractValidation(false)}
        title="Missing Required Fields"
      >
        <div className="space-y-4">
          <p className="text-cream/70 text-sm">
            The following fields are required before generating a contract.
            Edit the lead to fill them in, then try again.
          </p>
          <div className="space-y-2">
            {missingFields.map(field => (
              <div key={field} className="flex items-center gap-2 text-red-400 text-sm">
                <span>✗</span>
                <span>{field}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => {
                setShowContractValidation(false)
                if (contractValidationLead) openEdit(contractValidationLead)
              }}
            >
              Edit Lead
            </Button>
            <Button variant="secondary" onClick={() => setShowContractValidation(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quote Version History Modal */}
      <QuoteVersionHistory
        open={showVersionHistory}
        onClose={() => { setShowVersionHistory(false); setVersionHistoryQuote(null) }}
        versions={versionHistoryQuote?.version_history || []}
        currentVersion={versionHistoryQuote ? {
          versionNum: (versionHistoryQuote.version_history?.length || 0) + 1,
          total: versionHistoryQuote.total,
          deposit: versionHistoryQuote.deposit,
          balance: versionHistoryQuote.balance,
          status: versionHistoryQuote.status,
          created_at: new Date().toISOString(),
        } : undefined}
      />

      {/* Add Event Modal — for events 2+ on multi-event leads */}
      <Modal
        open={showAddEvent}
        onClose={() => { setShowAddEvent(false); setAddEventLead(null) }}
        title={`Add Event — ${addEventLead?.name || ''}`}
        preventBackdropClose
      >
        <div className="space-y-4">
          <p className="text-xs text-cream/50 bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2">
            Adding an event to a {addEventLead?.number_of_events}-event booking.
            {' '}{linkedEvents.filter(e => e.lead_id === addEventLead?.id).length + 1} of {addEventLead?.number_of_events}.
          </p>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Event Name</label>
            <input
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              placeholder="e.g. Women's Night"
              value={addEventForm.event_name}
              onChange={e => setAddEventForm(f => ({ ...f, event_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">Event Date</label>
            <input
              type="date"
              className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              value={addEventForm.event_date}
              onChange={e => setAddEventForm(f => ({ ...f, event_date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Total ($) *</label>
              <input
                type="number" step="0.01"
                value={addEventForm.total}
                onChange={e => {
                  const t = parseFloat(e.target.value) || 0
                  const dep = Math.round(t * 0.5)
                  setAddEventForm(f => ({ ...f, total: e.target.value, deposit: String(dep), balance: String(t - dep) }))
                }}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Deposit ($)</label>
              <input
                type="number" step="0.01"
                value={addEventForm.deposit}
                onChange={e => setAddEventForm(f => ({ ...f, deposit: e.target.value, balance: String((parseFloat(f.total) || 0) - (parseFloat(e.target.value) || 0)) }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Balance ($)</label>
              <input
                type="number" step="0.01"
                value={addEventForm.balance}
                onChange={e => setAddEventForm(f => ({ ...f, balance: e.target.value }))}
                className="w-full bg-navy-lighter border border-gold-dim rounded-lg px-3 py-2 text-cream text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={handleAddEvent}
              disabled={!addEventForm.total || parseFloat(addEventForm.total) <= 0}
            >
              <CalendarPlus size={16} /> Add Event
            </Button>
            <Button variant="secondary" onClick={() => { setShowAddEvent(false); setAddEventLead(null) }}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
