import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import { useQuote } from '../hooks/useQuotes'

interface StoredLine {
  label: string
  amount: number
}

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function numberValue(source: Record<string, unknown>, key: string): number {
  return typeof source[key] === 'number' ? source[key] : 0
}

function storedLines(breakdown: unknown): StoredLine[] {
  const bd = record(breakdown)
  if (!bd) return []
  const engine = record(bd.engine)
  const result = engine ? record(engine.result) : null
  if (result && Array.isArray(result.lines)) {
    return result.lines.flatMap((value) => {
      const line = record(value)
      return line && typeof line.label === 'string' && typeof line.amount === 'number'
        ? [{ label: line.label, amount: line.amount }]
        : []
    })
  }

  const lines: StoredLine[] = []
  const add = (label: string, key: string, negative = false) => {
    const amount = numberValue(bd, key)
    if (amount) lines.push({ label, amount: negative ? -amount : amount })
  }
  add('Base Package', 'base')
  add('Additional Bartenders', 'staffing')
  add('2-Hour Service Reduction', 'twoHrReduction', true)
  add('Extended Service Hours', 'extraHours')
  add('Long-Event Premium', 'longEventPremium')
  add('Full Bar Service', 'package')
  add('Signature Cocktails', 'cocktails')
  add('House Featured Cocktails', 'houseCocktails')
  add('Featured Cocktail Program', 'cocktailProgram')
  add('High-Volume Event Adjustment', 'volume')
  add('Large Event & Multi-Bar Operations', 'multiBarOperations')
  const addonItems = Array.isArray(bd.addonItems) ? bd.addonItems : []
  if (addonItems.length) {
    for (const value of addonItems) {
      const item = record(value)
      if (item && typeof item.name === 'string' && typeof item.amount === 'number') lines.push({ label: item.name, amount: item.amount })
    }
  } else add('Premium Add-Ons', 'addons')
  add('Premium Glassware', 'glassware')
  if (bd.glasswareAtCost === true) lines.push({ label: 'Plastic Serviceware (at cost, confirmed later)', amount: 0 })
  add('Travel Fee', 'travel')
  const customItems = Array.isArray(bd.customItems) ? bd.customItems : []
  if (customItems.length) {
    for (const value of customItems) {
      const item = record(value)
      if (item && typeof item.name === 'string' && typeof item.price === 'number') lines.push({ label: item.name, amount: item.price })
    }
  } else add('Custom Items', 'customItemsTotal')
  add('Promo Discount', 'discount', true)
  const customDiscountLabel = typeof bd.customDiscountLabel === 'string' && bd.customDiscountLabel ? bd.customDiscountLabel : 'Custom Discount'
  add(customDiscountLabel, 'customDiscount', true)
  return lines
}

export default function SavedQuotePage() {
  const { id } = useParams()
  const quoteQuery = useQuote(id)

  if (quoteQuery.isLoading) return <p className="text-sm text-cream/60">Loading saved quote...</p>
  if (quoteQuery.isError || !quoteQuery.data) {
    return <Card><p className="text-danger">This quote could not be loaded. Check the link and try again.</p></Card>
  }

  const quote = quoteQuery.data
  const lines = storedLines(quote.breakdown)
  const versions = Array.isArray(quote.version_history) ? quote.version_history : []

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/leads" className="inline-flex items-center gap-2 text-sm text-cream/50 hover:text-gold"><ArrowLeft size={15} /> Back to leads</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-widest text-gold/70">Saved quote</p><h1 className="mt-1 text-2xl font-bold text-cream">Quote {quote.id.slice(0, 8)}</h1></div>
        <StatusBadge status={quote.status} />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
        <LockKeyhole size={18} className="mt-0.5 shrink-0 text-gold" />
        <div><p className="font-medium text-cream">Saved price. This quote is not re-priced when opened.</p><p className="mt-0.5 text-xs text-cream/50">The amounts below are the stored quote record.</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-gold">Stored line items</h2>
          {lines.length ? (
            <div className="divide-y divide-white/5 rounded-lg border border-white/10">
              {lines.map((line, index) => <div key={`${line.label}-${index}`} className="flex gap-4 px-3 py-2.5 text-sm"><span className="flex-1 text-cream/65">{line.label}</span><span className={line.amount < 0 ? 'text-success' : 'text-cream'}>{money(line.amount)}</span></div>)}
            </div>
          ) : <p className="text-sm text-cream/45">No stored line-item breakdown is available for this quote.</p>}
          <div className="space-y-2 border-t border-gold-dim pt-4">
            <div className="flex justify-between text-xl font-bold text-gold"><span>Total</span><span>{money(quote.total)}</span></div>
            <div className="flex justify-between text-sm text-cream/70"><span>Deposit</span><span>{money(quote.deposit)}</span></div>
            <div className="flex justify-between text-sm text-cream/70"><span>Balance</span><span>{money(quote.balance)}</span></div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-gold">Quote details</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-cream/40">Status</dt><dd className="mt-1 capitalize text-cream">{quote.status}</dd></div>
              <div><dt className="text-xs text-cream/40">Valid until</dt><dd className="mt-1 text-cream">{quote.valid_until || 'Not set'}</dd></div>
              <div><dt className="text-xs text-cream/40">Event date</dt><dd className="mt-1 text-cream">{quote.event_date || 'Not set'}</dd></div>
              <div><dt className="text-xs text-cream/40">Guests</dt><dd className="mt-1 text-cream">{quote.guest_count ?? 'Not set'}</dd></div>
              <div><dt className="text-xs text-cream/40">Service</dt><dd className="mt-1 text-cream">{quote.hours ? `${quote.hours} hours` : 'Not set'}{quote.bartenders ? `, ${quote.bartenders} bar staff` : ''}</dd></div>
              {quote.addon_notes && <div><dt className="text-xs text-cream/40">Quote option</dt><dd className="mt-1 text-cream">{quote.addon_notes}</dd></div>}
            </dl>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-gold">Version history</h2>
            {versions.length ? <div className="space-y-2">{versions.map((version) => {
              const rawVersion = record(version)
              const storedDate = version.created_at || (typeof rawVersion?.edited_at === 'string' ? rawVersion.edited_at : '')
              return <div key={version.versionNum} className="rounded-lg border border-white/10 px-3 py-2 text-sm"><div className="flex justify-between"><span className="font-medium text-gold">Version {version.versionNum}</span><span className="capitalize text-cream/50">{version.status || quote.status}</span></div><p className="mt-1 text-cream/70">{money(version.total)} total, {money(version.deposit)} deposit</p><p className="mt-1 text-xs text-cream/35">{storedDate ? new Date(storedDate).toLocaleString() : 'Date not stored'}</p></div>
            })}</div> : <p className="text-sm text-cream/45">No version history is stored.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}
