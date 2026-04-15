import { useState } from 'react'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from '../hooks/useLeads'
import { useRecentQuotes, useLinkQuoteToLead } from '../hooks/useQuotes'
import type { Quote } from '../hooks/useQuotes'
import { Card, StatCard } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDate } from '../utils/formatters'
import { Plus, Instagram, Users, Phone, Mail, Calendar, DollarSign, Trash2, Edit2, Download, ExternalLink } from 'lucide-react'
import type { Lead } from '../lib/types'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  new:         { label: 'New Lead',     color: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  quoted:      { label: 'Quoted',       color: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  negotiating: { label: 'Negotiating',  color: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  booked:      { label: 'Booked! 🎉',   color: 'bg-green-500/20 text-green-300 border border-green-500/30' },
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
}

export default function LeadsPage() {
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [showQuoteImport, setShowQuoteImport] = useState(false)
  const [importTargetLead, setImportTargetLead] = useState<Lead | null>(null)

  const { data: leads = [], isLoading } = useLeads(filter === 'all' ? undefined : filter)
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const { data: recentQuotes = [] } = useRecentQuotes()
  const linkQuote = useLinkQuoteToLead()

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
      name:       lead.name,
      email:      lead.email || '',
      phone:      lead.phone || '',
      event_date: lead.event_date || '',
      event_type: lead.event_type || '',
      guest_count:String(lead.guest_count || ''),
      budget:     String(lead.budget || ''),
      source:     lead.source,
      status:     lead.status,
      notes:      lead.notes || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Partial<Lead> = {
      name:       form.name,
      email:      form.email || undefined,
      phone:      form.phone || undefined,
      event_date: form.event_date || undefined,
      event_type: form.event_type || undefined,
      guest_count:form.guest_count ? parseInt(form.guest_count) : undefined,
      budget:     form.budget ? parseFloat(form.budget) : undefined,
      source:     form.source as Lead['source'],
      status:     form.status as Lead['status'],
      notes:      form.notes || undefined,
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
    } catch (err) {
      toast.error('Something went wrong')
    }
  }

  async function handleStatusChange(lead: Lead, status: Lead['status']) {
    await updateLead.mutateAsync({ id: lead.id, status })
    toast.success(`Status → ${STATUS_CONFIG[status].label}`)
  }

  async function handleImportQuote(quote: Quote) {
    if (!importTargetLead) return
    try {
      await linkQuote.mutateAsync({ quoteId: quote.id, leadId: importTargetLead.id })
      // Pre-fill lead budget from quote total
      await updateLead.mutateAsync({ id: importTargetLead.id, budget: quote.total })
      toast.success(`Quote $${quote.total.toLocaleString()} linked to ${importTargetLead.name}`)
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
        <Button onClick={openNew} icon={<Plus size={16} />}>New Lead</Button>
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
            <Button className="mt-4" onClick={openNew} icon={<Plus size={16} />}>Add Lead</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leads.map(lead => (
            <Card key={lead.id} className="hover:border-gold/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-cream text-lg">{lead.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg">{SOURCE_CONFIG[lead.source]?.icon}</span>
                    <span className="text-xs text-cream/50">{SOURCE_CONFIG[lead.source]?.label}</span>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_CONFIG[lead.status]?.color}`}>
                  {STATUS_CONFIG[lead.status]?.label}
                </span>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-sm text-cream/70 mb-3">
                {lead.email && (
                  <div className="flex items-center gap-1.5"><Mail size={13} className="text-gold/60" />{lead.email}</div>
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
                {lead.budget && (
                  <div className="flex items-center gap-1.5"><DollarSign size={13} className="text-gold/60" />Budget: {formatCurrency(lead.budget)}</div>
                )}
                {lead.event_type && (
                  <div className="flex items-center gap-1.5">🎉 {lead.event_type}</div>
                )}
              </div>

              {lead.notes && (
                <p className="text-xs text-cream/50 italic mb-3 line-clamp-2">"{lead.notes}"</p>
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
                <div className="flex gap-2">
                  <button
                    onClick={() => { setImportTargetLead(lead); setShowQuoteImport(true) }}
                    className="text-cream/40 hover:text-gold transition-colors p-1"
                    title="Link a quote from Calculator"
                  >
                    <Download size={15} />
                  </button>
                  <button onClick={() => openEdit(lead)} className="text-cream/40 hover:text-gold transition-colors p-1">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(lead.id)} className="text-cream/40 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Quote Import Modal */}
      <Modal
        isOpen={showQuoteImport}
        onClose={() => { setShowQuoteImport(false); setImportTargetLead(null) }}
        title={`Link Quote → ${importTargetLead?.name || ''}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-cream/60 mb-4">
            Select a quote saved from the Calculator tool. It will be linked to this lead and update the budget.
          </p>
          {recentQuotes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-cream/50 mb-4">No quotes saved yet.</p>
              <a
                href="https://www.513sips.com/tools/calculator.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button icon={<ExternalLink size={14} />}>Open Calculator</Button>
              </a>
              <p className="text-xs text-cream/40 mt-3">Hit "Save to Books" after calculating</p>
            </div>
          ) : (
            recentQuotes.map(quote => (
              <button
                key={quote.id}
                onClick={() => handleImportQuote(quote)}
                className="w-full text-left p-4 rounded-lg bg-white/5 hover:bg-gold/10 border border-white/10 hover:border-gold/30 transition-all"
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
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editLead ? 'Edit Lead' : 'New Lead'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-cream/50 mb-1">Client Name *</label>
            <input className="w-full" placeholder="Sarah Johnson" value={form.name} onChange={set('name')} required />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Email</label>
              <input type="email" className="w-full" placeholder="sarah@email.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Phone</label>
              <input type="tel" className="w-full" placeholder="(513) 555-0100" value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          {/* Source + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">How'd they find you?</label>
              <select className="w-full" value={form.source} onChange={set('source')}>
                {Object.entries(SOURCE_CONFIG).map(([v, { label, icon }]) => (
                  <option key={v} value={v}>{icon} {label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Status</label>
              <select className="w-full" value={form.status} onChange={set('status')}>
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
              <input type="date" className="w-full" value={form.event_date} onChange={set('event_date')} />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Event Type</label>
              <select className="w-full" value={form.event_type} onChange={set('event_type')}>
                <option value="">Select type...</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-cream/50 mb-1">Guest Count</label>
              <input type="number" className="w-full" placeholder="75" value={form.guest_count} onChange={set('guest_count')} />
            </div>
            <div>
              <label className="block text-xs text-cream/50 mb-1">Budget</label>
              <input type="number" className="w-full" placeholder="800" value={form.budget} onChange={set('budget')} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-cream/50 mb-1">Notes</label>
            <textarea
              className="w-full h-20 resize-none"
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
    </div>
  )
}
