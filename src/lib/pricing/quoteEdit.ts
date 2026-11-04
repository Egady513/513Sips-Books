import { calculateQuote, getQuoteValidityDate } from './calculateQuote.ts'
import { fromFormInputs } from './fromFormInputs.ts'
import { toFormConfig, toLegacyBreakdown } from './quoteRecord.ts'
import type { QuoteInput, QuoteResult } from './types.ts'

export interface SavedQuoteRow {
  total: number
  deposit: number
  balance: number
  breakdown?: unknown
  version_history?: unknown
  status?: string
}

export type SavedQuoteInputs =
  | { input: QuoteInput; reason: null }
  | { input: null; reason: string }

export interface QuoteChangePlan {
  kind: 'details-only' | 'reprice'
  storedTotal: number
  newTotal: number
  storedDeposit: number
  newDeposit: number
  difference: number
  changedFields: Array<keyof QuoteInput>
}

interface PlanQuoteChangeOptions {
  row: SavedQuoteRow
  newInput: QuoteInput
  today: string
  requote?: boolean
}

interface BuildQuoteUpdateOptions {
  row: SavedQuoteRow
  plan: QuoteChangePlan
  input: QuoteInput
  result: QuoteResult
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
  if (!saved.input) throw new Error(saved.reason)

  const changedFields = inputFields.filter((field) => !sameValue(saved.input[field], newInput[field]))
  const hasPriceRelevantChange = changedFields.some((field) => !detailFields.has(field))
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
  if (!inputsFromSavedQuote(options.row).input) return null
  return planQuoteChange(options)
}

export function buildQuoteUpdate({ row, plan, input, result, today, reason }: BuildQuoteUpdateOptions): Record<string, unknown> {
  const breakdown = object(row.breakdown)
  if (!breakdown) throw new Error('The saved quote breakdown is missing.')

  if (plan.kind === 'details-only') {
    const config = object(breakdown._config)
    if (!config) throw new Error('The saved quote calculator configuration is missing.')
    const saved = inputsFromSavedQuote(row)
    if (!saved.input) throw new Error(saved.reason)
    const detailChanges = Object.fromEntries(
      (['eventName', 'quoteOptionName', 'clientNotes'] as const)
        .filter((field) => saved.input[field] !== input[field])
        .map((field) => [field, input[field]]),
    )
    return {
      addon_notes: input.quoteOptionName || null,
      breakdown: {
        ...breakdown,
        _config: {
          ...config,
          ...detailChanges,
        },
      },
    }
  }

  const history = Array.isArray(row.version_history) ? row.version_history : []
  return {
    total: result.total,
    deposit: result.deposit,
    balance: result.balance,
    guest_count: input.guestCount,
    hours: input.serviceHours,
    bartenders: input.bartenderCount,
    breakdown: {
      ...toLegacyBreakdown(result, input),
      _config: toFormConfig(input),
      engine: { schemaVersion: 1, rulesChecked: today, inputs: input, result },
    },
    promo_code: input.promoCode,
    addon_notes: input.quoteOptionName || null,
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
