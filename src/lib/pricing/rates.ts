import type { PromoCode } from './types.ts'

// Page lines 1974-1975.
export const STANDARD_BASE_PRICE = 650
export const SMALL_GROUP_BASE_PRICE = 395

// Page lines 2013-2017.
export const STANDARD_BASE_HOURS = 3
export const SMALL_GROUP_BASE_HOURS = 2

// Page lines 1841-1843. Used for staffing, extended hours and the reduction.
export const HOURLY_RATE = 75

// Page lines 1832-1835. Per service hour per assigned bartender.
export const FULL_BAR_HOURLY = 15

// Page lines 1845-1848. The first premium hour is service hour five.
export const LONG_EVENT_PREMIUM = 15
export const LONG_EVENT_PREMIUM_START_HOUR = 5

// Page lines 1867-1874. Internal cost rates, not client pricing.
export const STAFF_WAGE = 35
export const STAFF_WAGE_5_PLUS = 50

// Page lines 2023-2026.
export const VOLUME_ADJUSTMENT_51_TO_100 = 175
export const VOLUME_ADJUSTMENT_101_PLUS = 250

// Page line 1839 and lines 2019-2027.
export const MULTI_BAR_OPERATIONS_FEE = 500

// Page lines 2045-2048.
export const INCLUDED_ONE_WAY_MILES = 30
export const EXCESS_MILEAGE_RATE = 0.67

// Page lines 2057-2068.
export const FORMAL_GLASS_PRICE = 3.5
export const SIGNATURE_COCKTAIL_RATE = 125

// Page lines 1836-1838 and 2069-2076.
export const HOUSE_COCKTAIL_RATE = 50
export const COCKTAIL_PROGRAM_EXPANDED = 250
export const COCKTAIL_PROGRAM_EXTENSIVE = 500
export const EXPANDED_COCKTAIL_MINIMUM = 5
export const EXTENSIVE_COCKTAIL_MINIMUM = 8

// Page lines 2090-2104.
export const COFFEE_SERVICE_PRICE = 100
export const ARCH_BACKDROP_PRICE = 350
export const CUSTOM_LOGO_ICE_RATE = 2.5
export const TENT_RENTAL_PRICE = 250

// Page lines 1850-1865. null means a custom quote is required.
export const PROCUREMENT_TIERS: ReadonlyArray<{ maxGuests: number; fee: number | null }> = [
  { maxGuests: 99, fee: 175 },
  { maxGuests: 150, fee: 275 },
  { maxGuests: 199, fee: 350 },
  { maxGuests: 250, fee: 400 },
  { maxGuests: Number.POSITIVE_INFINITY, fee: null },
]

export interface PromoDefinition {
  type: 'fixed' | 'percent'
  value: number
  description: string
  smallGroupOnly?: true
}

// Page lines 1107-1117.
export const PROMO_CODES: Readonly<Record<PromoCode, PromoDefinition>> = {
  FIRST10: { type: 'percent', value: 0.1, description: '10% Off First Event' },
  WEDDING2024: { type: 'percent', value: 0.05, description: '5% Off Wedding' },
  REFERRAL: { type: 'percent', value: 0.05, description: '5% Off Referral' },
  VENDOR50: { type: 'fixed', value: 50, description: '$50 Off' },
  LAUNCH50: { type: 'fixed', value: 50, description: '$50 Off Launch Special' },
  RECURRING1: { type: 'fixed', value: 10, description: '$10 Off: Repeat Booking', smallGroupOnly: true },
  RECURRING3: { type: 'fixed', value: 20, description: '$20 Off: 3-Event Commitment', smallGroupOnly: true },
  RECURRING6: { type: 'fixed', value: 35, description: '$35 Off: 6-Event Commitment', smallGroupOnly: true },
}

// Page lines 1946-1953.
export const NORMAL_DEPOSIT_PERCENT = 50
export const SHORT_NOTICE_DEPOSIT_PERCENT = 100
export const SHORT_NOTICE_DAYS = 14

// Page lines 2482-2488.
export const QUOTE_VALIDITY_MONTHS = 3
