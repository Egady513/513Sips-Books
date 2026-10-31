import { PROMO_CODES } from './rates.ts'
import type {
  CustomDiscount,
  CustomItem,
  GlasswareType,
  PackageType,
  PromoCode,
  QuoteInput,
} from './types.ts'

export type BaselineFormInput = Record<string, unknown>

function pageInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return parsed || fallback
}

function pageNumber(value: unknown, fallback = 0): number {
  const parsed = Number.parseFloat(String(value ?? ''))
  return parsed || fallback
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function promoCode(value: unknown): PromoCode | null {
  const code = text(value) as PromoCode
  return code && Object.hasOwn(PROMO_CODES, code) ? code : null
}

function customDiscount(input: BaselineFormInput): CustomDiscount | null {
  if (input.customPromo && typeof input.customPromo === 'object') {
    const promo = input.customPromo as Record<string, unknown>
    const value = pageNumber(promo.value)
    if (value > 0) {
      return {
        label: text(promo.label) || 'Custom Discount',
        type: promo.type === 'percent' ? 'percent' : 'fixed',
        value,
      }
    }
  }
  const amount = pageNumber(input.customPromoAmount)
  if (amount <= 0) return null
  const type = input.customPromoType === 'percent' ? 'percent' : 'fixed'
  return {
    label: text(input.customPromoLabel) || 'Custom Discount',
    type,
    value: type === 'percent' ? amount / 100 : amount,
  }
}

function customItems(value: unknown): CustomItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = item as Record<string, unknown>
    return { name: text(record.name), price: pageNumber(record.price) }
  })
}

export function fromFormInputs(input: BaselineFormInput = {}): QuoteInput {
  return {
    eventName: text(input.eventName),
    eventDateIso: text(input.eventDate),
    quoteOptionName: text(input.quoteOptionName),
    clientNotes: text(input.clientNotes),
    guestCount: pageInteger(input.guestCount, 50),
    isSmallGroup: Boolean(input.smallGroup),
    serviceHours: pageInteger(input.hours, 3),
    bartenderCount: pageInteger(input.bartenderCount, 1),
    packageType: (input.packageType === 'fullbar' ? 'fullbar' : 'beerwine') as PackageType,
    fullBarStaffCount: pageInteger(input.fullBarStaffCount, 1),
    glasswareType: (['formal', 'none'].includes(String(input.glassware))
      ? input.glassware
      : 'plastic_at_cost') as GlasswareType,
    glassCount: pageInteger(input.glassCount, 0),
    oneWayDistanceMiles: pageInteger(input.distance, 0),
    signatureCocktailCount: pageInteger(input.cocktailCount, 0),
    houseCocktailCount: pageInteger(input.houseCocktailCount, 0),
    signatureCocktailNames: text(input.signatureCocktailNames),
    houseCocktailNames: text(input.houseCocktailNames),
    hasMultiBarOperations: Boolean(input.multiBarOperations),
    hasAlcoholProcurement: Boolean(input.alcoholProcurement),
    hasCoffeeService: Boolean(input.coffeeService),
    hasArchBackdrop: Boolean(input.archBackdrop),
    hasCustomLogoIce: Boolean(input.drinkBigIce),
    logoIceCubeCount: pageInteger(input.iceCount, 100),
    hasTentRental: Boolean(input.tentRental),
    promoCode: promoCode(input.promoCode),
    customDiscount: customDiscount(input),
    customItems: customItems(input.customItems),
  }
}
