import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from '../hooks/useLeads'
import { useRecentQuotes, useLinkQuoteToLead, useUpdateQuote } from '../hooks/useQuotes'
import { useCreateEvent } from '../hooks/useEvents'
import { useCreateAREntry } from '../hooks/useInvoices'
import type { Quote } from '../hooks/useQuotes'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate } from '../utils/formatters'
import {
  Plus, Instagram, Users, Phone, Mail, Calendar, DollarSign,
  Trash2, Edit2, Download, ExternalLink, FileSignature, CheckCircle2, FileText, Pencil,
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
}

export default function LeadsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
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

  // Sprint 4: contract validation modal
  const [showContractValidation, setShowContractValidation] = useState(false)
  const [contractValidationLead, setContractValidationLead] = useState<Lead | null>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])

  // Quote quick-edit
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [quoteEditForm, setQuoteEditForm] = useState({ total: '', deposit: '', balance: '', guest_count: '', hours: '' })

  const { data: leads = [], isLoading } = useLeads(filter === 'all' ? undefined : filter)
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const createEvent = useCreateEvent()
  const createAREntry = useCreateAREntry()
  const { data: recentQuotes = [] } = useRecentQuotes()
  const linkQuote = useLinkQuoteToLead()
  const updateQuote = useUpdateQuote()

  const allLeads = useLeads().data || []
  const stats = {
    total:       allLeads.length,
    new:         allLeads.filter(l => l.status === 'new').length,
    booked:      allLeads.filter(l => l.status === 'booked').length,
    pipeline:    allLeads.filter(l => l.status !== 'lost' && l.budget).reduce((s, l) => s + (l.budget || 0), 0),
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
    }

    try {
      if (editLead) {
        await updateLead.mutateAsync({ id: editLead.id, ...payload })
        toast.success('Lead updated')
      } else {
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
      // Find linked quote
      const linked = recentQuotes.find(q => q.lead_id === lead.id)
      setBookingLead(lead)
      setBookingQuote(linked || null)
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
      const total = quote?.total ?? (lead.budget ?? 0)
      const deposit = quote?.deposit ?? Math.round(total * 0.5)
      const balance = quote?.balance ?? (total - deposit)

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
      navigate('/events')
    } catch (err) {
      console.error(err)
      toast.error('Failed to create event')
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
      promoCode:           quote.promo_code,
      bartenders:          quote.bartenders,
    }

    localStorage.setItem('513sips_contract_data', JSON.stringify(contractData))
    localStorage.setItem('513sips_quote', JSON.stringify({
      total, deposit, balance,
      guestCount: quote.guest_count,
      hours: quote.hours,
      bartenders: quote.bartenders,
      breakdown: quote.breakdown,
      promoCode: quote.promo_code,
    }))
    // P2: auto-advance quote status to 'sent'
    try { await updateQuote.mutateAsync({ id: quote.id, status: 'sent' }) } catch { /* non-blocking */ }
    window.open('https://www.513sips.com/tools/contract.html', '_blank')
  }

  // Sprint 2: open calculator pre-filled for a lead
  function handleCreateQuote(lead: Lead) {
    const url = `https://www.513sips.com/tools/calculator.html?lead_id=${lead.id}&name=${encodeURIComponent(lead.name)}&guests=${lead.guest_count || ''}&date=${lead.event_date || ''}`
    window.open(url, '_blank')
  }

  // Quote quick-edit handlers
  function openQuoteEdit(quote: Quote) {
    setEditingQuoteId(quote.id)
    setQuoteEditForm({
      total: String(quote.total),
      deposit: String(quote.deposit),
      balance: String(quote.balance),
      guest_count: String(quote.guest_count ?? ''),
      hours: String(quote.hours ?? ''),
    })
  }

  async function handleSaveQuoteEdit(quoteId: string) {
    const total = parseFloat(quoteEditForm.total) || 0
    const deposit = parseFloat(quoteEditForm.deposit) || 0
    const balance = parseFloat(quoteEditForm.balance) || 0
    try {
      await updateQuote.mutateAsync({
        id: quoteId,
        total,
        deposit,
        balance,
        guest_count: parseInt(quoteEditForm.guest_count) || undefined,
        hours: parseFloat(quoteEditForm.hours) || undefined,
      })
      // Update lead budget to match new quote total
      const lead = leads.find(l => recentQuotes.find(q => q.id === quoteId && q.lead_id === l.id))
      if (lead) await updateLead.mutateAsync({ id: lead.id, budget: total })
      toast.success('Quote updated')
      setEditingQuoteId(null)
    } catch {
      toast.error('Failed to update quote')
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

  // Sprint 3: export quote to PDF via contract.html
  function handleExportQuotePDF(quote: Quote) {
    const quoteForContract = {
      total: quote.total,
      deposit: quote.deposit,
      balance: quote.balance,
      guestCount: quote.guest_count,
      hours: quote.hours,
      bartenders: quote.bartenders,
      breakdown: quote.breakdown,
      promoCode: quote.promo_code,
      addonNotes: quote.addon_notes,
    }
    localStorage.setItem('513sips_quote', JSON.stringify(quoteForContract))
    window.open('https://www.513sips.com/tools/contract.html', '_blank')
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
        <Button onClick={openNew}><Plus size={16} /> New Lead</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads"    value={String(stats.total)}   color="text-gold" />
        <StatCard label="New / Unread"   value={String(stats.new)}     color="text-blue-300" />
        <StatCard label="Booked"         value={String(stats.booked)}  color="text-success" />
        <StatCard label="Pipeline Value" value={formatCurrency(stats.pipeline)} color="text-warning" />
      </div>

      {/* Filter tabs */}
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

      {/* Lead Cards */}
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leads.map(lead => {
            const linkedQuote = recentQuotes.find(q => q.lead_id === lead.id)
            return (
              <Card key={lead.id} className="hover:border-gold/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-cream text-lg">{lead.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg">{SOURCE_CONFIG[lead.source]?.icon}</span>
                      <span className="text-xs text-cream/50">{SOURCE_CONFIG[lead.source]?.label}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CONFIG[lead.status]?.color}`}>
                      {STATUS_CONFIG[lead.status]?.label}
                    </span>
                    {lead.converted_event_id && (
                      <span className="text-xs text-success/70 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Event created
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-sm text-cream/70 mb-3">
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

                {/* Venue info if present */}
                {lead.venue_name && (
                  <p className="text-xs text-cream/40 mb-3">📍 {lead.venue_name}{lead.service_start_time ? ` · ${lead.service_start_time}–${lead.service_end_time || '?'}` : ''}</p>
                )}

                {lead.notes && (
                  <p className="text-xs text-cream/50 italic mb-3 line-clamp-2">"{lead.notes}"</p>
                )}

                {/* Linked quote summary strip */}
                {linkedQuote && (
                  <div className="mb-3 rounded-md bg-gold/5 border border-gold/15 px-3 py-2 space-y-2">
                    {editingQuoteId === linkedQuote.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key: 'total', label: 'Total' },
                            { key: 'deposit', label: 'Deposit' },
                            { key: 'balance', label: 'Balance' },
                          ].map(({ key, label }) => (
                            <div key={key}>
                              <label className="text-xs text-cream/40 block mb-0.5">{label}</label>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full text-xs bg-navy-dark border border-white/10 rounded px-2 py-1 text-cream focus:outline-none focus:border-gold/50"
                                value={quoteEditForm[key as keyof typeof quoteEditForm]}
                                onChange={e => setQuoteEditForm(f => ({ ...f, [key]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: 'guest_count', label: 'Guests' },
                            { key: 'hours', label: 'Hours' },
                          ].map(({ key, label }) => (
                            <div key={key}>
                              <label className="text-xs text-cream/40 block mb-0.5">{label}</label>
                              <input
                                type="number"
                                className="w-full text-xs bg-navy-dark border border-white/10 rounded px-2 py-1 text-cream focus:outline-none focus:border-gold/50"
                                value={quoteEditForm[key as keyof typeof quoteEditForm]}
                                onChange={e => setQuoteEditForm(f => ({ ...f, [key]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveQuoteEdit(linkedQuote.id)}
                            className="text-xs px-3 py-1 bg-gold/20 text-gold rounded hover:bg-gold/30 transition-colors"
                          >Save</button>
                          <button
                            onClick={() => setEditingQuoteId(null)}
                            className="text-xs px-3 py-1 bg-white/5 text-cream/50 rounded hover:bg-white/10 transition-colors"
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
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
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            linkedQuote.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                            linkedQuote.status === 'sent'     ? 'bg-blue-500/20 text-blue-300' :
                            linkedQuote.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-white/5 text-cream/40'
                          }`}>
                            {linkedQuote.status}
                          </span>
                          <button
                            onClick={() => openQuoteEdit(linkedQuote)}
                            className="text-cream/25 hover:text-gold transition-colors"
                            title="Edit quote numbers"
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status change + actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
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
                    {/* Link Quote from Calculator */}
                    <button
                      onClick={() => { setImportTargetLead(lead); setShowQuoteImport(true) }}
                      className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded"
                      title="Link a quote from Calculator"
                    >
                      <Download size={15} />
                    </button>
                    {/* Sprint 2: Create Quote in Calculator pre-filled */}
                    <button
                      onClick={() => handleCreateQuote(lead)}
                      className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded"
                      title="Create Quote in Calculator"
                    >
                      <FileText size={15} />
                    </button>
                    {/* Generate Contract */}
                    <button
                      onClick={() => handleGenerateContract(lead)}
                      className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded"
                      title="Generate contract"
                    >
                      <FileSignature size={15} />
                    </button>
                    <button onClick={() => openEdit(lead)} className="text-cream/40 hover:text-gold transition-colors p-1.5 rounded">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(lead.id)} className="text-cream/40 hover:text-red-400 transition-colors p-1.5 rounded">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Book Confirmation Modal */}
      <Modal
        open={showBookConfirm}
        onClose={() => { setShowBookConfirm(false); setBookingLead(null); setBookingQuote(null) }}
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

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editLead ? 'Edit Lead' : 'New Lead'}
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

          <div className="grid grid-cols-2 gap-3">
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
    </div>
  )
}
