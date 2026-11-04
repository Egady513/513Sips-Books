import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useCreatePricedQuote, useQuote, useUpdatePricedQuote } from '../hooks/useQuotes'
import {
  buildMultiEventQuoteRecord,
  buildQuoteUpdate,
  buildQuoteRecord,
  calculateMultiEventQuote,
  calculateQuote,
  inputsFromSavedQuote,
  planQuoteChangeIfEditable,
  type CustomItem,
  type PromoCode,
  type QuoteInput,
} from '../lib/pricing'

const promoCodes: Array<{ value: PromoCode; label: string }> = [
  { value: 'FIRST10', label: 'FIRST10 (10%)' },
  { value: 'WEDDING2024', label: 'WEDDING2024 (5%)' },
  { value: 'REFERRAL', label: 'REFERRAL (5%)' },
  { value: 'VENDOR50', label: 'VENDOR50 ($50)' },
  { value: 'LAUNCH50', label: 'LAUNCH50 ($50)' },
  { value: 'RECURRING1', label: 'RECURRING1 ($10, Small Group)' },
  { value: 'RECURRING3', label: 'RECURRING3 ($20, Small Group)' },
  { value: 'RECURRING6', label: 'RECURRING6 ($35, Small Group)' },
]

const inputClass = 'w-full rounded-lg border border-gold-dim bg-navy-dark px-3 py-2 text-sm text-cream outline-none focus:border-gold'
const checkboxClass = 'h-4 w-4 rounded border-gold-dim bg-navy-dark text-gold focus:ring-gold'

function localIsoDate(): string {
  const date = new Date()
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-cream/60">{label}</span>
      {children}
    </label>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-cream/75">
      <input type="checkbox" className={checkboxClass} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function defaultQuoteInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    eventName: '', eventDateIso: '', quoteOptionName: '', clientNotes: '', guestCount: 50,
    isSmallGroup: false, serviceHours: 3, bartenderCount: 1, packageType: 'beerwine',
    fullBarStaffCount: 1, glasswareType: 'plastic_at_cost', glassCount: 0,
    oneWayDistanceMiles: 0, signatureCocktailCount: 0, houseCocktailCount: 0,
    signatureCocktailNames: '', houseCocktailNames: '', hasMultiBarOperations: false,
    hasAlcoholProcurement: false, hasCoffeeService: false, hasArchBackdrop: false,
    hasCustomLogoIce: false, logoIceCubeCount: 100, hasTentRental: false,
    promoCode: null, customDiscount: null, customItems: [], ...overrides,
  }
}

function QuoteEventForm({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

export default function QuotePage() {
  const { id: editId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const createQuote = useCreatePricedQuote()
  const updateQuote = useUpdatePricedQuote()
  const quoteQuery = useQuote(editId)
  const isEdit = Boolean(editId)
  const leadId = params.get('lead_id') ?? ''
  const [saveError, setSaveError] = useState('')
  const [confirmReason, setConfirmReason] = useState<'edit' | 'requote' | null>(null)
  const [inputReady, setInputReady] = useState(!isEdit)
  const [activeEventIndex, setActiveEventIndex] = useState(0)
  const [inputs, setInputs] = useState<QuoteInput[]>(() => [defaultQuoteInput({
    eventName: params.get('name') ?? '',
    eventDateIso: params.get('date') ?? '',
    guestCount: Number.parseInt(params.get('guests') ?? '', 10) || 50,
  })])
  const input = inputs[activeEventIndex] ?? inputs[0]
  const setInput = (value: QuoteInput | ((current: QuoteInput) => QuoteInput)) => {
    setInputs((current) => current.map((eventInput, index) => index === activeEventIndex
      ? typeof value === 'function' ? value(eventInput) : value
      : eventInput))
  }
  const today = localIsoDate()
  const savedInputs = useMemo(
    () => quoteQuery.data ? inputsFromSavedQuote(quoteQuery.data) : null,
    [quoteQuery.data],
  )
  useEffect(() => {
    if (!inputReady && savedInputs?.events) {
      setInputs(savedInputs.events)
      setActiveEventIndex(0)
      setInputReady(true)
    } else if (!inputReady && savedInputs && 'input' in savedInputs && savedInputs.input) {
      setInputs([savedInputs.input])
      setInputReady(true)
    }
  }, [inputReady, savedInputs])
  const multiResult = useMemo(() => calculateMultiEventQuote(
    inputs.map((eventInput, index) => ({ name: eventInput.eventName || `Event ${index + 1}`, input: eventInput })),
    { today },
  ), [inputs, today])
  const result = multiResult.events[activeEventIndex]?.result ?? calculateQuote(input, { today })
  const quotedResult = inputs.length > 1 ? multiResult : result
  const editInput = savedInputs?.events ? inputs : inputs.length > 1 ? inputs : input
  const editResult = inputs.length > 1 ? multiResult : result
  const changePlan = useMemo(
    () => isEdit && inputReady && quoteQuery.data
      ? planQuoteChangeIfEditable({ row: quoteQuery.data, newInput: editInput, today })
      : null,
    [editInput, inputReady, isEdit, quoteQuery.data, today],
  )
  const set = <Key extends keyof QuoteInput>(key: Key, value: QuoteInput[Key]) => {
    setInput((current) => ({ ...current, [key]: value }))
  }
  const number = (value: string, fallback = 0) => Number.parseFloat(value) || fallback

  const updateCustomItem = (index: number, patch: Partial<CustomItem>) => {
    set('customItems', input.customItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function saveQuote() {
    setSaveError('')
    if (!leadId) {
      setSaveError('Open this screen from a lead before saving the quote.')
      return
    }
    try {
      const record = inputs.length > 1
        ? buildMultiEventQuoteRecord({
            leadId,
            events: inputs.map((eventInput, index) => ({ name: eventInput.eventName || `Event ${index + 1}`, input: eventInput })),
            result: multiResult,
            today,
          })
        : buildQuoteRecord({ leadId, input, result, today, statusDefault: 'draft' })
      const saved = await createQuote.mutateAsync(record)
      if (!saved?.id) throw new Error('The quote was not returned after saving.')
      navigate(`/quotes/${saved.id}`)
    } catch {
      setSaveError('The quote could not be saved. Check your connection and try again.')
    }
  }

  async function saveEdit(reason: 'edit' | 'requote') {
    if (!editId || !quoteQuery.data || !changePlan) return
    setSaveError('')
    try {
      const plan = reason === 'requote'
        ? planQuoteChangeIfEditable({ row: quoteQuery.data, newInput: editInput, today, requote: true })
        : changePlan
      if (!plan) throw new Error('This quote cannot be edited.')
      const updates = buildQuoteUpdate({ row: quoteQuery.data, plan, input: editInput, result: editResult, today, reason })
      const saved = await updateQuote.mutateAsync({ id: editId, updates })
      if (!saved?.id) throw new Error('The quote was not returned after updating.')
      navigate(`/quotes/${saved.id}`)
    } catch {
      setConfirmReason(null)
      setSaveError('The quote could not be updated. Check your connection and try again.')
    }
  }

  if (isEdit && quoteQuery.isLoading) return <p className="text-sm text-cream/60">Loading saved quote...</p>
  if (isEdit && (quoteQuery.isError || !quoteQuery.data)) {
    return <Card><p className="text-danger">This quote could not be loaded. Check the link and try again.</p></Card>
  }
  if (isEdit && savedInputs && 'input' in savedInputs && !savedInputs.input) {
    return (
      <Card className="space-y-3">
        <p className="text-danger">{savedInputs.reason}</p>
        <Link to={`/quotes/${editId}`} className="text-sm text-gold hover:text-gold-light">Back to the saved quote</Link>
      </Card>
    )
  }

  const savedQuote = isEdit ? quoteQuery.data : null
  const activePlan = confirmReason === 'requote' && savedQuote
    ? planQuoteChangeIfEditable({ row: savedQuote, newInput: editInput, today, requote: true })
    : changePlan

  const addEvent = () => {
    const nextIndex = inputs.length
    setInputs((current) => [...current, defaultQuoteInput({ eventName: `Event ${nextIndex + 1}` })])
    setActiveEventIndex(nextIndex)
  }

  const removeEvent = (index: number) => {
    if (inputs.length === 1) return
    setInputs((current) => current.filter((_, eventIndex) => eventIndex !== index))
    setActiveEventIndex((current) => Math.max(0, Math.min(current > index ? current - 1 : current, inputs.length - 2)))
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold/70">Books quote</p>
        <h1 className="mt-1 text-2xl font-bold text-cream">{isEdit ? 'Edit saved quote' : 'Build a new quote'}</h1>
        <p className="mt-1 text-sm text-cream/50">{isEdit ? 'Change details or choose when to save a new price.' : 'Price one or more events and save the complete calculator record to Books.'}</p>
      </div>

      {savedQuote && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3">
          <p className="font-semibold text-cream">Saved price: {money(savedQuote.total)} ({money(savedQuote.deposit)} deposit, {money(savedQuote.balance)} balance)</p>
          <p className="mt-1 text-xs text-cream/55">This price stays stored until you confirm a new price.</p>
        </div>
      )}

      {!isEdit && !leadId && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          A lead is required to save. Return to Leads and choose Quote in Books.
        </div>
      )}

      <Card className="flex flex-wrap items-center gap-2">
        {inputs.map((eventInput, index) => (
          <button
            key={index}
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm transition-colors ${index === activeEventIndex ? 'border-gold bg-gold/15 text-gold' : 'border-white/10 text-cream/60 hover:border-gold/50'}`}
            onClick={() => setActiveEventIndex(index)}
          >
            {eventInput.eventName || `Event ${index + 1}`}
          </button>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addEvent}><Plus size={14} /> Add event</Button>
        {inputs.length > 1 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => removeEvent(activeEventIndex)}><Trash2 size={14} /> Remove active event</Button>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <QuoteEventForm>
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Event basics</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Event Name"><input className={inputClass} value={input.eventName} onChange={(event) => set('eventName', event.target.value)} /></Field>
              <Field label="Event Date"><input type="date" className={inputClass} value={input.eventDateIso} onChange={(event) => set('eventDateIso', event.target.value)} /></Field>
              <Field label="Quote Option Name"><input className={inputClass} value={input.quoteOptionName} onChange={(event) => set('quoteOptionName', event.target.value)} /></Field>
              <Field label="Number of Guests"><input type="number" min="1" max="500" className={inputClass} value={input.guestCount} onChange={(event) => set('guestCount', number(event.target.value, 50))} /></Field>
            </div>
            <Check label="Small Group Event" checked={input.isSmallGroup} onChange={(checked) => set('isSmallGroup', checked)} />
            <Field label="Client-Facing Assumptions / Notes"><textarea rows={3} className={inputClass} value={input.clientNotes} onChange={(event) => set('clientNotes', event.target.value)} /></Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Staffing and hours</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Service Duration">
                <select className={inputClass} value={input.serviceHours} onChange={(event) => set('serviceHours', number(event.target.value, 3))}>
                  {[2, 3, 4, 5, 6, 7, 8].map((hours) => <option key={hours} value={hours}>{hours} hours</option>)}
                </select>
              </Field>
              <Field label="Number of Bartenders">
                <select className={inputClass} value={input.bartenderCount} onChange={(event) => {
                  const count = number(event.target.value, 1)
                  setInput((current) => ({ ...current, bartenderCount: count, fullBarStaffCount: Math.min(current.fullBarStaffCount, count) }))
                }}>
                  {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </Field>
            </div>
            <Check label="Large Event & Multi-Bar Operations" checked={input.hasMultiBarOperations} onChange={(checked) => set('hasMultiBarOperations', checked)} />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Package and Full Bar coverage</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Package Type">
                <select className={inputClass} value={input.packageType} onChange={(event) => set('packageType', event.target.value === 'fullbar' ? 'fullbar' : 'beerwine')}>
                  <option value="beerwine">Beer & Wine Service</option><option value="fullbar">Full Bar Service</option>
                </select>
              </Field>
              {input.packageType === 'fullbar' && (
                <Field label="Full Bar Coverage">
                  <select className={inputClass} value={Math.min(input.fullBarStaffCount, input.bartenderCount)} onChange={(event) => set('fullBarStaffCount', number(event.target.value, 1))}>
                    {Array.from({ length: input.bartenderCount }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} bartender{count === 1 ? '' : 's'}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Signature and house cocktails</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Signature Cocktails"><input type="number" min="0" max="8" className={inputClass} value={input.signatureCocktailCount} onChange={(event) => set('signatureCocktailCount', number(event.target.value))} /></Field>
              <Field label="Signature cocktail names"><input className={inputClass} value={input.signatureCocktailNames} onChange={(event) => set('signatureCocktailNames', event.target.value)} /></Field>
              <Field label="House Featured Cocktails"><input type="number" min="0" max="8" className={inputClass} value={input.houseCocktailCount} onChange={(event) => set('houseCocktailCount', number(event.target.value))} /></Field>
              <Field label="House cocktail names"><input className={inputClass} value={input.houseCocktailNames} onChange={(event) => set('houseCocktailNames', event.target.value)} /></Field>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Glassware</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Glassware Selection">
                <select className={inputClass} value={input.glasswareType} onChange={(event) => set('glasswareType', event.target.value as QuoteInput['glasswareType'])}>
                  <option value="plastic_at_cost">Plastic Serviceware (at cost, confirmed later)</option><option value="formal">Formal Glassware</option><option value="none">None</option>
                </select>
              </Field>
              <Field label="Number of Glasses Needed"><input type="number" min="0" className={inputClass} value={input.glassCount} onChange={(event) => set('glassCount', number(event.target.value))} /></Field>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Add-ons</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Check label="Alcohol Procurement & Return Service" checked={input.hasAlcoholProcurement} onChange={(checked) => set('hasAlcoholProcurement', checked)} />
              <Check label="Coffee & Hot Chocolate Service" checked={input.hasCoffeeService} onChange={(checked) => set('hasCoffeeService', checked)} />
              <Check label="Arch Backdrop (Photo Ready)" checked={input.hasArchBackdrop} onChange={(checked) => set('hasArchBackdrop', checked)} />
              <Check label="Custom Logo Ice by DrinkBigIce" checked={input.hasCustomLogoIce} onChange={(checked) => set('hasCustomLogoIce', checked)} />
              <Check label="Tent Rental" checked={input.hasTentRental} onChange={(checked) => set('hasTentRental', checked)} />
            </div>
            {input.hasCustomLogoIce && <Field label="Logo ice cubes"><input type="number" min="0" className={inputClass} value={input.logoIceCubeCount} onChange={(event) => set('logoIceCubeCount', number(event.target.value))} /></Field>}
            {result.procurementRequiresCustomQuote && <p className="text-sm text-warning">Alcohol procurement for this guest count needs a custom price.</p>}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Travel</h2>
            <Field label="One-Way Driving Distance from 2851 Minto Avenue"><input type="number" min="0" className={inputClass} value={input.oneWayDistanceMiles} onChange={(event) => set('oneWayDistanceMiles', number(event.target.value))} /></Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-gold">Promo code and custom discount</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Have a Promo Code?">
                <select className={inputClass} value={input.promoCode ?? ''} onChange={(event) => set('promoCode', event.target.value ? event.target.value as PromoCode : null)}>
                  <option value="">No promo code</option>{promoCodes.map((promo) => <option key={promo.value} value={promo.value}>{promo.label}</option>)}
                </select>
              </Field>
              <Field label="Custom Discount label"><input className={inputClass} value={input.customDiscount?.label ?? ''} onChange={(event) => set('customDiscount', { label: event.target.value, type: input.customDiscount?.type ?? 'fixed', value: input.customDiscount?.value ?? 0 })} /></Field>
              <Field label="Custom Discount amount"><input type="number" min="0" className={inputClass} value={input.customDiscount ? (input.customDiscount.type === 'percent' ? input.customDiscount.value * 100 : input.customDiscount.value) : ''} onChange={(event) => {
                const type = input.customDiscount?.type ?? 'fixed'
                const raw = number(event.target.value)
                set('customDiscount', raw > 0 ? { label: input.customDiscount?.label || 'Custom Discount', type, value: type === 'percent' ? raw / 100 : raw } : null)
              }} /></Field>
              <Field label="Custom Discount type"><select className={inputClass} value={input.customDiscount?.type ?? 'fixed'} onChange={(event) => {
                const nextType = event.target.value === 'percent' ? 'percent' : 'fixed'
                const current = input.customDiscount
                if (!current) return
                const raw = current.type === 'percent' ? current.value * 100 : current.value
                set('customDiscount', { ...current, type: nextType, value: nextType === 'percent' ? raw / 100 : raw })
              }}><option value="fixed">Fixed dollars</option><option value="percent">Percent</option></select></Field>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gold">Custom line items</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => set('customItems', [...input.customItems, { name: '', price: 0 }])}><Plus size={14} /> Add item</Button>
            </div>
            {input.customItems.length === 0 && <p className="text-sm text-cream/40">No custom items.</p>}
            {input.customItems.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_130px_auto] gap-2">
                <input aria-label={`Custom item ${index + 1} description`} placeholder="Item description" className={inputClass} value={item.name} onChange={(event) => updateCustomItem(index, { name: event.target.value })} />
                <input aria-label={`Custom item ${index + 1} price`} type="number" min="0" placeholder="Price" className={inputClass} value={item.price} onChange={(event) => updateCustomItem(index, { price: number(event.target.value) })} />
                <button type="button" aria-label={`Remove custom item ${index + 1}`} className="rounded-lg px-2 text-cream/40 hover:bg-white/5 hover:text-danger" onClick={() => set('customItems', input.customItems.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
              </div>
            ))}
          </Card>
        </QuoteEventForm>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card className="space-y-4">
            <div><p className="text-xs uppercase tracking-widest text-gold/70">{isEdit ? 'Price with current rules' : 'Live breakdown'}</p><h2 className="mt-1 text-xl font-semibold text-cream">{input.quoteOptionName || input.eventName || 'New quote'}</h2></div>
            <div className="divide-y divide-white/5 rounded-lg border border-white/10">
              {result.lines.map((line) => <div key={line.code} className="flex gap-4 px-3 py-2.5 text-sm"><span className="flex-1 text-cream/65">{line.label}</span><span className={line.amount < 0 ? 'text-success' : 'text-cream'}>{money(line.amount)}</span></div>)}
            </div>
            <div className="space-y-2 border-t border-gold-dim pt-4 text-sm">
              <div className="flex justify-between text-cream/60"><span>Subtotal</span><span>{money(result.subtotal)}</span></div>
              {result.discounts.promo > 0 && <div className="flex justify-between text-success"><span>Promo discount</span><span>-{money(result.discounts.promo)}</span></div>}
              {result.discounts.custom > 0 && <div className="flex justify-between text-success"><span>Custom discount</span><span>-{money(result.discounts.custom)}</span></div>}
              <div className="flex justify-between text-lg font-bold text-gold"><span>Total</span><span>{money(result.total)}</span></div>
              <div className="flex justify-between text-cream/70"><span>Deposit</span><span>{money(result.deposit)}</span></div>
              <div className="flex justify-between text-cream/70"><span>Balance</span><span>{money(result.balance)}</span></div>
              {savedQuote && quotedResult.total !== savedQuote.total && (
                <div className={`flex justify-between font-medium ${quotedResult.total > savedQuote.total ? 'text-warning' : 'text-success'}`}><span>Difference from saved price</span><span>{quotedResult.total > savedQuote.total ? '+' : ''}{money(quotedResult.total - savedQuote.total)}</span></div>
              )}
              <p className="pt-1 text-xs text-cream/40">{result.paymentTerms.shortNotice ? 'Full amount due at signing.' : '50% deposit. Balance due 14 days before the event.'}</p>
            </div>
            {inputs.length > 1 && (
              <div className="space-y-2 rounded-lg border border-gold/25 bg-gold/5 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold/70">Combined package</p>
                {multiResult.events.map((event, index) => (
                  <div key={index} className="flex justify-between text-cream/60"><span>{event.name}</span><span>{money(event.result.total)}</span></div>
                ))}
                <div className="flex justify-between border-t border-gold/20 pt-2 text-lg font-bold text-gold"><span>Combined total</span><span>{money(multiResult.total)}</span></div>
                <div className="flex justify-between text-cream/70"><span>{multiResult.paymentTerms.shortNotice ? 'Full amount due at signing' : 'Combined deposit'}</span><span>{money(multiResult.deposit)}</span></div>
                <div className="flex justify-between text-cream/70"><span>Combined balance</span><span>{money(multiResult.balance)}</span></div>
                <p className="pt-1 text-xs text-cream/40">Payment timing uses the earliest event date that is filled in.</p>
              </div>
            )}
            {saveError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{saveError}</p>}
            {isEdit ? (
              <div className="space-y-2">
                <Button className="w-full" size="lg" disabled={changePlan?.kind !== 'details-only' || updateQuote.isPending} onClick={() => saveEdit('edit')}><Save size={17} />{updateQuote.isPending ? 'Saving...' : 'Save details'}</Button>
                {changePlan?.kind === 'reprice' ? (
                  <Button className="w-full" variant="secondary" size="lg" disabled={updateQuote.isPending} onClick={() => setConfirmReason('edit')}>Save new price</Button>
                ) : (
                  <Button className="w-full" variant="secondary" size="lg" disabled={updateQuote.isPending} onClick={() => setConfirmReason('requote')}>Re-quote with current prices</Button>
                )}
                <Link to={`/quotes/${editId}`} className="block pt-1 text-center text-sm text-cream/50 hover:text-gold">Cancel and return to saved quote</Link>
              </div>
            ) : (
              <Button className="w-full" size="lg" disabled={!leadId || createQuote.isPending} onClick={saveQuote}><Save size={17} />{createQuote.isPending ? 'Saving quote...' : 'Save quote to Books'}</Button>
            )}
          </Card>
        </aside>
      </div>

      {confirmReason && activePlan && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-price-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md space-y-4 border border-gold/35">
            <div><h2 id="confirm-price-title" className="text-xl font-semibold text-cream">Confirm the new quote price</h2><p className="mt-1 text-sm text-cream/55">This replaces the saved price and adds a version history entry.</p></div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-cream/55">Saved total</dt><dd className="text-cream">{money(activePlan.storedTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-cream/55">New total</dt><dd className="font-semibold text-gold">{money(activePlan.newTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-cream/55">Difference</dt><dd className="text-cream">{activePlan.difference > 0 ? '+' : ''}{money(activePlan.difference)}</dd></div>
              <div className="flex justify-between"><dt className="text-cream/55">Deposit change</dt><dd className="text-cream">{activePlan.newDeposit - activePlan.storedDeposit > 0 ? '+' : ''}{money(activePlan.newDeposit - activePlan.storedDeposit)}</dd></div>
            </dl>
            <div className="flex justify-end gap-3">
              <Button autoFocus variant="ghost" onClick={() => setConfirmReason(null)}>Cancel</Button>
              <Button disabled={updateQuote.isPending} onClick={() => saveEdit(confirmReason)}>{updateQuote.isPending ? 'Saving...' : 'Confirm new price'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
