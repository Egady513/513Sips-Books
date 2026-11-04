import { calculateQuote, getQuoteValidityDate } from './calculateQuote.ts'
import { calculateMultiEventQuote } from './calculateMultiEventQuote.ts'
import { fromFormInputs } from './fromFormInputs.ts'
import { buildMultiEventQuoteRecord, toFormConfig, toLegacyBreakdown } from './quoteRecord.ts'
import type { MultiEventQuoteResult, NamedQuoteInput, QuoteInput, QuoteResult } from './types.ts'

export interface SavedQuoteRow {
  total: number
  deposit: number
  balance: number
  breakdown?: unknown
  version_history?: unknown
  status?: string
}

export type SavedQuoteInputs =
  | { input: QuoteInput; events?: never; reason: null }
  | { events: QuoteInput[]; input?: never; reason: null }
  | { input: null; events?: never; reason: string }

export interface QuoteChangePlan {
  kind: 'details-only' | 'reprice'
  storedTotal: number
  newTotal: number
  storedDeposit: number
  newDeposit: number
  difference: number
  changedFields: string[]
}

interface PlanQuoteChangeOptions {
  row: SavedQuoteRow
  newInput: QuoteInput | QuoteInput[]
  today: string
  requote?: boolean
}

interface BuildQuoteUpdateOptions {
  row: SavedQuoteRow
  plan: QuoteChangePlan
  input: QuoteInput | QuoteInput[]
  result: QuoteResult | MultiEventQuoteResult
  today: string
  reason: 'edit' | 'requote'
}

const detailFields = new Set<keyof QuoteInput>(['eventName', 'quoteOptionName', 'clientNotes'])
const inputFields: Array<keyof QuoteInput> = [
  'eventName',
  'eventDateIso',
  'quoteOptionName',
  'clientNotes',
  'guestCount',
  'isSmallGroup',
  'serviceHours',
  'bartenderCount',
  'packageType',
  'fullBarStaffCount',
  'glasswareType',
  'glassCount',
  'oneWayDistanceMiles',
  'signatureCocktailCount',
  'houseCocktailCount',
  'signatureCocktailNames',
  'houseCocktailNames',
  'hasMultiBarOperations',
  'hasAlcoholProcurement',
  'hasCoffeeService',
  'hasArchBackdrop',
  'hasCustomLogoIce',
  'logoIceCubeCount',
  'hasTentRental',
  'promoCode',
  'customDiscount',
  'customItems',
]

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function isUsableInput(value: unknown): value is QuoteInput {
  const input = object(value)
  return Boolean(
    input
    && typeof input.eventName === 'string'
    && typeof input.eventDateIso === 'string'
    && typeof input.guestCount === 'number'
    && typeof input.serviceHours === 'number'
    && typeof input.bartenderCount === 'number'
    && (input.packageType === 'beerwine' || input.packageType === 'fullbar')
    && Array.isArray(input.customItems),
  )
}

function isUsableConfig(value: unknown): value is Record<string, unknown> {
  const config = object(value)
  return Boolean(
    config
    && ('guestCount' in config || 'hours' in config)
    && ('packageType' in config || 'bartenderCount' in config),
  )
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

// Older website saves have no fullBarStaffCount. The website restores such a record with
// `cfg.fullBarStaffCount || cfg.bartenderCount`, so a rebuilt quote must do the same or Full Bar
// is priced for one bartender. A fresh page (fromFormInputs alone) still defaults to 1.
function inputsFromSavedConfig(config: Record<string, unknown>): QuoteInput {
  return fromFormInputs({
    ...config,
    fullBarStaffCount: config.fullBarStaffCount || config.bartenderCount,
  })
}

export function inputsFromSavedQuote(row: SavedQuoteRow): SavedQuoteInputs {
  if (Array.isArray(row.breakdown) && row.breakdown.length > 1) {
    const entries = row.breakdown.map(object)
    if (entries.some((entry) => !entry)) {
      return { input: null, reason: 'This multi-event quote has an invalid saved breakdown.' }
    }

    const firstEngine = object(entries[0]?.engine)
    const engineEvents = firstEngine?.events
    if (Array.isArray(engineEvents) && engineEvents.every((event) => {
      const named = object(event)
      return named && isUsableInput(named.input)
    })) {
      const events = engineEvents.map((event, index) => {
        const named = object(event)!
        const input = structuredClone(named.input) as QuoteInput
        const config = object(entries[index]?._config)
        if (config) {
          if (typeof config.eventName === 'string') input.eventName = config.eventName
          if (typeof config.quoteOptionName === 'string') input.quoteOptionName = config.quoteOptionName
          if (typeof config.clientNotes === 'string') input.clientNotes = config.clientNotes
        }
        return input
      })
      return { events, reason: null }
    }

    const configs = entries.map((entry) => entry?._config)
    if (configs.every(isUsableConfig)) {
      return { events: configs.map((config) => inputsFromSavedConfig(config)), reason: null }
    }
    return {
      input: null,
      reason: 'This multi-event quote does not contain the saved calculator inputs needed for safe editing. View the stored quote instead.',
    }
  }

  const breakdown = object(row.breakdown)
  const engine = breakdown ? object(breakdown.engine) : null
  if (engine && isUsableInput(engine.inputs)) {
    const input = structuredClone(engine.inputs)
    const config = breakdown ? object(breakdown._config) : null
    if (config) {
      if (typeof config.eventName === 'string') input.eventName = config.eventName
      if (typeof config.quoteOptionName === 'string') input.quoteOptionName = config.quoteOptionName
      if (typeof config.clientNotes === 'string') input.clientNotes = config.clientNotes
    }
    return { input, reason: null }
  }

  const config = breakdown ? breakdown._config : null
  if (isUsableConfig(config)) {
    return { input: inputsFromSavedConfig(config), reason: null }
  }

  return {
    input: null,
    reason: 'This quote does not contain the saved calculator inputs needed for safe editing. View the stored quote instead.',
  }
}

export function planQuoteChange({ row, newInput, today, requote = false }: PlanQuoteChangeOptions): QuoteChangePlan {
  const saved = inputsFromSavedQuote(row)
  if (saved.events) {
    if (!Array.isArray(newInput)) throw new Error('This saved quote requires multiple event inputs.')
    const changedFields: string[] = []
    if (saved.events.length !== newInput.length) changedFields.push('events.length')
    for (let index = 0; index < Math.max(saved.events.length, newInput.length); index += 1) {
      const previous = saved.events[index]
      const next = newInput[index]
      if (!previous || !next) continue
      for (const field of inputFields) {
        if (!sameValue(previous[field], next[field])) changedFields.push(`events.${index}.${field}`)
      }
    }
    const hasPriceRelevantChange = changedFields.some((path) => {
      const field = path.split('.').at(-1) as keyof QuoteInput
      return path === 'events.length' || !detailFields.has(field)
    })
    const result = newInput.length === 1
      ? calculateQuote(newInput[0], { today })
      : calculateMultiEventQuote(
          newInput.map((input, index) => ({ name: input.eventName || `Event ${index + 1}`, input })),
          { today },
        )
    const kind = requote || hasPriceRelevantChange ? 'reprice' : 'details-only'
    return {
      kind,
      storedTotal: row.total,
      newTotal: result.total,
      storedDeposit: row.deposit,
      newDeposit: result.deposit,
      difference: result.total - row.total,
      changedFields,
    }
  }
  if (!saved.input) throw new Error(saved.reason)
  if (Array.isArray(newInput)) {
    const result = newInput.length === 1
      ? calculateQuote(newInput[0], { today })
      : calculateMultiEventQuote(
          newInput.map((input, index) => ({ name: input.eventName || `Event ${index + 1}`, input })),
          { today },
        )
    return {
      kind: 'reprice',
      storedTotal: row.total,
      newTotal: result.total,
      storedDeposit: row.deposit,
      newDeposit: result.deposit,
      difference: result.total - row.total,
      changedFields: ['events.length'],
    }
  }

  const changedFields = inputFields.filter((field) => !sameValue(saved.input[field], newInput[field]))
  const hasPriceRelevantChange = changedFields.some((field) => !detailFields.has(field as keyof QuoteInput))
  const result = calculateQuote(newInput, { today })
  const kind = requote || hasPriceRelevantChange ? 'reprice' : 'details-only'

  return {
    kind,
    storedTotal: row.total,
    newTotal: result.total,
    storedDeposit: row.deposit,
    newDeposit: result.deposit,
    difference: result.total - row.total,
    changedFields,
  }
}

// The edit screen calls this instead of planQuoteChange: a quote that cannot be edited returns
// null (the screen shows "View the stored quote instead") rather than throwing and blanking the page.
export function planQuoteChangeIfEditable(options: PlanQuoteChangeOptions): QuoteChangePlan | null {
  const saved = inputsFromSavedQuote(options.row)
  if (!saved.events && !saved.input) return null
  return planQuoteChange(options)
}

export function buildQuoteUpdate({ row, plan, input, result, today, reason }: BuildQuoteUpdateOptions): Record<string, unknown> {
  if (plan.kind === 'details-only' && Array.isArray(row.breakdown)) {
    if (!Array.isArray(input)) throw new Error('The multi-event quote update does not match its saved breakdown.')
    if (row.breakdown.length !== input.length) throw new Error('A detail-only save cannot add or remove an event.')
    const breakdown = row.breakdown.map((value, index) => {
      const entry = object(value)
      const config = object(entry?._config)
      if (!entry || !config) throw new Error('A saved event calculator configuration is missing.')
      return {
        ...entry,
        _config: {
          ...config,
          eventName: input[index].eventName,
          quoteOptionName: input[index].quoteOptionName,
          clientNotes: input[index].clientNotes,
        },
        name: input[index].eventName || `Event ${index + 1}`,
        total: typeof entry.total === 'number' ? entry.total : 0,
      }
    })
    return {
      breakdown,
      addon_notes: breakdown
        .map((event, index) => `Event ${index + 1} — ${String(event.name)}: $${String(event.total)}`)
        .join('\n'),
    }
  }

  const history = Array.isArray(row.version_history) ? row.version_history : []
  if (plan.kind === 'reprice' && Array.isArray(input) && input.length > 1) {
    if (!('events' in result)) throw new Error('The multi-event calculation result is missing.')
    const events: NamedQuoteInput[] = input.map((eventInput, index) => ({
      name: eventInput.eventName || `Event ${index + 1}`,
      input: eventInput,
    }))
    const rebuilt = buildMultiEventQuoteRecord({ leadId: 'saved-quote', events, result, today })
    return {
      total: rebuilt.total,
      deposit: rebuilt.deposit,
      balance: rebuilt.balance,
      guest_count: rebuilt.guest_count,
      hours: rebuilt.hours,
      bartenders: rebuilt.bartenders,
      breakdown: rebuilt.breakdown,
      promo_code: null,
      addon_notes: rebuilt.addon_notes,
      valid_until: getQuoteValidityDate(today),
      version_history: [
        ...history,
        {
          versionNum: history.length + 1,
          total: rebuilt.total,
          deposit: rebuilt.deposit,
          balance: rebuilt.balance,
          edited_at: `${today}T00:00:00.000Z`,
          reason,
        },
      ],
    }
  }

  const singleInput = Array.isArray(input) ? input[0] : input
  if (!singleInput || 'events' in result) throw new Error('The single-event calculation result is missing.')
  const breakdown = object(row.breakdown)

  if (plan.kind === 'details-only') {
    if (!breakdown) throw new Error('The saved quote breakdown is missing.')
    const config = object(breakdown._config)
    if (!config) throw new Error('The saved quote calculator configuration is missing.')
    const saved = inputsFromSavedQuote(row)
    if (!('input' in saved) || !saved.input) throw new Error(saved.reason ?? 'The saved quote inputs are missing.')
    const detailChanges = Object.fromEntries(
      (['eventName', 'quoteOptionName', 'clientNotes'] as const)
        .filter((field) => saved.input[field] !== singleInput[field])
        .map((field) => [field, singleInput[field]]),
    )
    return {
      addon_notes: singleInput.quoteOptionName || null,
      breakdown: {
        ...breakdown,
        _config: {
          ...config,
          ...detailChanges,
        },
      },
    }
  }

  return {
    total: result.total,
    deposit: result.deposit,
    balance: result.balance,
    guest_count: singleInput.guestCount,
    hours: singleInput.serviceHours,
    bartenders: singleInput.bartenderCount,
    event_date: singleInput.eventDateIso,
    breakdown: {
      ...toLegacyBreakdown(result, singleInput),
      _config: toFormConfig(singleInput),
      engine: { schemaVersion: 1, rulesChecked: today, inputs: singleInput, result },
    },
    promo_code: singleInput.promoCode,
    addon_notes: singleInput.quoteOptionName || null,
    valid_until: getQuoteValidityDate(today),
    version_history: [
      ...history,
      {
        versionNum: history.length + 1,
        total: result.total,
        deposit: result.deposit,
        balance: result.balance,
        edited_at: `${today}T00:00:00.000Z`,
        reason,
      },
    ],
  }
}
