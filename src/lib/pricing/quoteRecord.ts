import {
  ARCH_BACKDROP_PRICE,
  COCKTAIL_PROGRAM_EXPANDED,
  COCKTAIL_PROGRAM_EXTENSIVE,
  COFFEE_SERVICE_PRICE,
  CUSTOM_LOGO_ICE_RATE,
  FORMAL_GLASS_PRICE,
  FULL_BAR_HOURLY,
  HOURLY_RATE,
  HOUSE_COCKTAIL_RATE,
  LONG_EVENT_PREMIUM,
  LONG_EVENT_PREMIUM_START_HOUR,
  MULTI_BAR_OPERATIONS_FEE,
  PROCUREMENT_TIERS,
  SIGNATURE_COCKTAIL_RATE,
  SMALL_GROUP_BASE_HOURS,
  SMALL_GROUP_BASE_PRICE,
  STANDARD_BASE_HOURS,
  STANDARD_BASE_PRICE,
  TENT_RENTAL_PRICE,
  VOLUME_ADJUSTMENT_101_PLUS,
  VOLUME_ADJUSTMENT_51_TO_100,
} from './rates.ts'
import type { QuoteInput, QuoteResult } from './types.ts'

export interface LegacyAddonItem {
  name: string
  amount: number
}

export interface LegacyBreakdown {
  base: number
  hours: number
  bartenders: number
  fullBarStaffCount: number
  quoteOptionName: string
  clientNotes: string
  staffing: number
  volume: number
  multiBarOperations: number
  twoHrReduction: number
  extraHours: number
  longEventPremium: number
  travel: number
  package: number
  glassware: number
  glasswareAtCost: boolean
  cocktails: number
  signatureCocktailCount: number
  signatureCocktailNames: string
  houseCocktails: number
  houseCocktailCount: number
  houseCocktailNames: string
  cocktailProgram: number
  featuredCocktailCount: number
  addons: number
  addonsList: string[]
  addonItems: LegacyAddonItem[]
  discount: number
  procurementCustom?: boolean
  customItems: QuoteInput['customItems']
  customItemsTotal: number
  customItemsList: string[]
  customDiscount: number
  customDiscountLabel: string
}

export interface FormConfig {
  eventName: string
  quoteOptionName: string
  clientNotes: string
  eventDate: string
  guestCount: string
  hours: string
  packageType: QuoteInput['packageType']
  glassware: QuoteInput['glasswareType']
  glassCount: string
  distance: string
  cocktailCount: string
  houseCocktailCount: string
  signatureCocktailNames: string
  houseCocktailNames: string
  bartenderCount: string
  fullBarStaffCount: string
  smallGroup: boolean
  multiBarOperations: boolean
  alcoholProcurement: boolean
  coffeeService: boolean
  archBackdrop: boolean
  drinkBigIce: boolean
  iceCount: string
  tentRental: boolean
  promoCode: string
  customItems: QuoteInput['customItems']
  customPromo: ({ label: string; type: 'fixed' | 'percent'; value: number; raw: number } | null)
  customPromoLabel: string
  customPromoAmount: string
  customPromoType: 'fixed' | 'percent'
}

export interface QuoteRecord {
  lead_id: string
  total: number
  deposit: number
  balance: number
  guest_count: number
  hours: number
  bartenders: number
  event_date: string
  breakdown: LegacyBreakdown & {
    _config: FormConfig
    engine: { schemaVersion: 1; rulesChecked: string; inputs: QuoteInput; result: QuoteResult }
  }
  promo_code: string | null
  addon_notes: string | null
  valid_until: string
  status: 'draft'
  version_history: Array<{
    versionNum: 1
    total: number
    deposit: number
    balance: number
    status: 'draft'
    created_at: string
  }>
}

function lineAmount(result: QuoteResult, code: QuoteResult['lines'][number]['code']): number {
  return result.lines.find((line) => line.code === code)?.amount ?? 0
}

function procurementFee(guestCount: number): number | null {
  return PROCUREMENT_TIERS.find((tier) => guestCount <= tier.maxGuests)?.fee ?? null
}

export function toLegacyBreakdown(result: QuoteResult, input: QuoteInput): LegacyBreakdown {
  const baseHours = input.isSmallGroup ? SMALL_GROUP_BASE_HOURS : STANDARD_BASE_HOURS
  const fullBarStaffCount = Math.min(input.bartenderCount, input.fullBarStaffCount || input.bartenderCount)
  const featuredCocktailCount = input.signatureCocktailCount + input.houseCocktailCount
  const addonItems: LegacyAddonItem[] = []
  const addAddon = (name: string, amount: number) => addonItems.push({ name, amount })
  const procurement = procurementFee(input.guestCount)

  if (input.hasAlcoholProcurement && procurement !== null) addAddon('Alcohol Procurement & Return Service', procurement)
  if (input.hasCoffeeService) addAddon('Coffee Service', COFFEE_SERVICE_PRICE)
  if (input.hasArchBackdrop) addAddon('Arch Backdrop', ARCH_BACKDROP_PRICE)
  if (input.hasCustomLogoIce && input.logoIceCubeCount > 0) {
    addAddon(`Custom Logo Ice (${input.logoIceCubeCount} cubes)`, input.logoIceCubeCount * CUSTOM_LOGO_ICE_RATE)
  }
  if (input.hasTentRental) addAddon('Tent Rental', TENT_RENTAL_PRICE)

  const longEventPremiumHours = Math.max(0, input.serviceHours - LONG_EVENT_PREMIUM_START_HOUR + 1)
  const legacy: LegacyBreakdown = {
    base: input.isSmallGroup ? SMALL_GROUP_BASE_PRICE : STANDARD_BASE_PRICE,
    hours: input.serviceHours,
    bartenders: input.bartenderCount,
    fullBarStaffCount,
    quoteOptionName: input.quoteOptionName,
    clientNotes: input.clientNotes,
    staffing: Math.max(0, input.bartenderCount - 1) * HOURLY_RATE * baseHours,
    volume: input.hasMultiBarOperations
      ? 0
      : input.guestCount > 100
        ? VOLUME_ADJUSTMENT_101_PLUS
        : input.guestCount > 50
          ? VOLUME_ADJUSTMENT_51_TO_100
          : 0,
    multiBarOperations: input.hasMultiBarOperations ? MULTI_BAR_OPERATIONS_FEE : 0,
    twoHrReduction: input.serviceHours < baseHours && !input.isSmallGroup
      ? (baseHours - input.serviceHours) * HOURLY_RATE * input.bartenderCount
      : 0,
    extraHours: input.serviceHours > baseHours
      ? (input.serviceHours - baseHours) * HOURLY_RATE * input.bartenderCount
      : 0,
    longEventPremium: longEventPremiumHours * LONG_EVENT_PREMIUM * input.bartenderCount,
    travel: lineAmount(result, 'travel'),
    package: input.packageType === 'fullbar' ? FULL_BAR_HOURLY * input.serviceHours * fullBarStaffCount : 0,
    glassware: input.glasswareType === 'formal' ? Math.round(input.glassCount * FORMAL_GLASS_PRICE) : 0,
    glasswareAtCost: input.glasswareType === 'plastic_at_cost',
    cocktails: input.signatureCocktailCount * SIGNATURE_COCKTAIL_RATE,
    signatureCocktailCount: input.signatureCocktailCount,
    signatureCocktailNames: input.signatureCocktailNames,
    houseCocktails: input.houseCocktailCount * HOUSE_COCKTAIL_RATE,
    houseCocktailCount: input.houseCocktailCount,
    houseCocktailNames: input.houseCocktailNames,
    cocktailProgram: featuredCocktailCount >= 8
      ? COCKTAIL_PROGRAM_EXTENSIVE
      : featuredCocktailCount >= 5
        ? COCKTAIL_PROGRAM_EXPANDED
        : 0,
    featuredCocktailCount,
    addons: addonItems.reduce((sum, item) => sum + item.amount, 0),
    addonsList: addonItems.map((item) => item.name),
    addonItems,
    discount: result.discounts.promo,
    customItems: input.customItems.map((item) => ({ ...item })),
    customItemsTotal: input.customItems.reduce((sum, item) => sum + item.price, 0),
    customItemsList: input.customItems.map((item) => item.name),
    customDiscount: result.discounts.custom,
    customDiscountLabel: input.customDiscount?.label ?? '',
  }
  if (result.procurementRequiresCustomQuote) legacy.procurementCustom = true
  return legacy
}

export function toFormConfig(input: QuoteInput): FormConfig {
  const discount = input.customDiscount
  const rawDiscount = discount?.type === 'percent' ? discount.value * 100 : discount?.value ?? 0
  return {
    eventName: input.eventName || 'Event 1',
    quoteOptionName: input.quoteOptionName,
    clientNotes: input.clientNotes,
    eventDate: input.eventDateIso,
    guestCount: String(input.guestCount),
    hours: String(input.serviceHours),
    packageType: input.packageType,
    glassware: input.glasswareType,
    glassCount: String(input.glassCount),
    distance: String(input.oneWayDistanceMiles),
    cocktailCount: String(input.signatureCocktailCount),
    houseCocktailCount: String(input.houseCocktailCount),
    signatureCocktailNames: input.signatureCocktailNames,
    houseCocktailNames: input.houseCocktailNames,
    bartenderCount: String(input.bartenderCount),
    fullBarStaffCount: String(input.fullBarStaffCount),
    smallGroup: input.isSmallGroup,
    multiBarOperations: input.hasMultiBarOperations,
    alcoholProcurement: input.hasAlcoholProcurement,
    coffeeService: input.hasCoffeeService,
    archBackdrop: input.hasArchBackdrop,
    drinkBigIce: input.hasCustomLogoIce,
    iceCount: String(input.logoIceCubeCount),
    tentRental: input.hasTentRental,
    promoCode: input.promoCode ?? '',
    customItems: input.customItems.map((item) => ({ ...item })),
    customPromo: discount
      ? { label: discount.label, type: discount.type, value: discount.value, raw: rawDiscount }
      : null,
    customPromoLabel: discount?.label ?? '',
    customPromoAmount: discount ? String(rawDiscount) : '',
    customPromoType: discount?.type ?? 'fixed',
  }
}

interface BuildQuoteRecordOptions {
  leadId: string
  input: QuoteInput
  result: QuoteResult
  today: string
  statusDefault?: 'draft'
}

export function buildQuoteRecord({
  leadId,
  input,
  result,
  today,
  statusDefault = 'draft',
}: BuildQuoteRecordOptions): QuoteRecord {
  const possibleMultiEvent = input as QuoteInput & { events?: unknown }
  if (Array.isArray(possibleMultiEvent.events) && possibleMultiEvent.events.length > 1) {
    throw new Error('Multi-event quotes are not supported in this screen yet.')
  }
  if (!leadId) throw new Error('A lead is required before this quote can be saved.')
  const createdAt = `${today}T00:00:00.000Z`
  return {
    lead_id: leadId,
    total: result.total,
    deposit: result.deposit,
    balance: result.balance,
    guest_count: input.guestCount,
    hours: input.serviceHours,
    bartenders: input.bartenderCount,
    event_date: input.eventDateIso,
    breakdown: {
      ...toLegacyBreakdown(result, input),
      _config: toFormConfig(input),
      engine: { schemaVersion: 1, rulesChecked: today, inputs: input, result },
    },
    promo_code: input.promoCode,
    addon_notes: input.quoteOptionName || null,
    valid_until: result.quoteValidityDate,
    status: statusDefault,
    version_history: [{
      versionNum: 1,
      total: result.total,
      deposit: result.deposit,
      balance: result.balance,
      status: statusDefault,
      created_at: createdAt,
    }],
  }
}
