export type PackageType = 'beerwine' | 'fullbar'

export type GlasswareType = 'plastic_at_cost' | 'formal' | 'none'

export type PromoCode =
  | 'FIRST10'
  | 'WEDDING2024'
  | 'REFERRAL'
  | 'VENDOR50'
  | 'LAUNCH50'
  | 'RECURRING1'
  | 'RECURRING3'
  | 'RECURRING6'

export type DiscountType = 'fixed' | 'percent'

export interface CustomItem {
  name: string
  price: number
}

export interface CustomDiscount {
  label: string
  type: DiscountType
  /** Fixed dollars or a decimal fraction such as 0.1 for 10%. */
  value: number
}

export interface QuoteInput {
  eventName: string
  eventDateIso: string
  quoteOptionName: string
  clientNotes: string
  guestCount: number
  isSmallGroup: boolean
  serviceHours: number
  bartenderCount: number
  packageType: PackageType
  fullBarStaffCount: number
  glasswareType: GlasswareType
  glassCount: number
  oneWayDistanceMiles: number
  signatureCocktailCount: number
  houseCocktailCount: number
  signatureCocktailNames: string
  houseCocktailNames: string
  hasMultiBarOperations: boolean
  hasAlcoholProcurement: boolean
  hasCoffeeService: boolean
  hasArchBackdrop: boolean
  hasCustomLogoIce: boolean
  logoIceCubeCount: number
  hasTentRental: boolean
  promoCode: PromoCode | null
  customDiscount: CustomDiscount | null
  customItems: CustomItem[]
}

export type PricingLineCode =
  | 'base-package'
  | 'additional-bartenders'
  | 'two-hour-reduction'
  | 'extended-service-hours'
  | 'full-bar-service'
  | 'signature-cocktails'
  | 'house-cocktails'
  | 'cocktail-program'
  | 'volume-adjustment'
  | 'multi-bar-operations'
  | 'premium-add-ons'
  | 'premium-glassware'
  | 'travel'
  | 'custom-items'
  | 'promo-discount'
  | 'custom-discount'

export interface PricingLine {
  code: PricingLineCode
  label: string
  quantity: number
  unitPrice?: number
  amount: number
}

export interface QuoteQuantities {
  guests: number
  hours: number
  bartenders: number
  fullBarStaff: number
  glasses: number
  signatureCocktails: number
  houseCocktails: number
  featuredCocktails: number
  logoIceCubes: number
  oneWayMiles: number
}

export type BalanceDueDateRule = 'due-at-signing' | 'fourteen-days-before-event'

export interface PaymentTerms {
  depositPercent: 50 | 100
  shortNotice: boolean
  dueDateRule: BalanceDueDateRule
}

export interface QuoteDiscounts {
  promo: number
  custom: number
  total: number
}

export interface QuoteResult {
  lines: PricingLine[]
  subtotal: number
  discounts: QuoteDiscounts
  total: number
  deposit: number
  balance: number
  paymentTerms: PaymentTerms
  quoteValidityDate: string
  quantities: QuoteQuantities
  procurementRequiresCustomQuote: boolean
}

export interface CalculateQuoteOptions {
  /** Current local calendar date in YYYY-MM-DD form. */
  today: string
}

export interface NamedQuoteInput {
  name: string
  input: QuoteInput
}

export interface MultiEventQuoteResult {
  events: Array<{ name: string; result: QuoteResult }>
  subtotal: number
  discounts: QuoteDiscounts
  total: number
  deposit: number
  balance: number
  paymentTerms: PaymentTerms
  quoteValidityDate: string
}
