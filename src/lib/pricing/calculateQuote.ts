import {
  ARCH_BACKDROP_PRICE,
  COCKTAIL_PROGRAM_EXPANDED,
  COCKTAIL_PROGRAM_EXTENSIVE,
  COFFEE_SERVICE_PRICE,
  CUSTOM_LOGO_ICE_RATE,
  EXCESS_MILEAGE_RATE,
  EXPANDED_COCKTAIL_MINIMUM,
  EXTENSIVE_COCKTAIL_MINIMUM,
  FORMAL_GLASS_PRICE,
  FULL_BAR_HOURLY,
  HOURLY_RATE,
  HOUSE_COCKTAIL_RATE,
  INCLUDED_ONE_WAY_MILES,
  LONG_EVENT_PREMIUM,
  LONG_EVENT_PREMIUM_START_HOUR,
  MULTI_BAR_OPERATIONS_FEE,
  PROCUREMENT_TIERS,
  PROMO_CODES,
  QUOTE_VALIDITY_MONTHS,
  SHORT_NOTICE_DAYS,
  SIGNATURE_COCKTAIL_RATE,
  SMALL_GROUP_BASE_HOURS,
  SMALL_GROUP_BASE_PRICE,
  STANDARD_BASE_HOURS,
  STANDARD_BASE_PRICE,
  TENT_RENTAL_PRICE,
  VOLUME_ADJUSTMENT_101_PLUS,
  VOLUME_ADJUSTMENT_51_TO_100,
} from './rates.ts'
import type {
  CalculateQuoteOptions,
  PaymentTerms,
  PricingLine,
  QuoteInput,
  QuoteResult,
} from './types.ts'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseIsoDate(date: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error(`Expected an ISO date (YYYY-MM-DD), received "${date}"`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isoDateToUtc(date: string): number {
  const [year, month, day] = parseIsoDate(date)
  return Date.UTC(year, month - 1, day)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return isLeapYear ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function addCalendarMonths(date: string, months: number): string {
  const [initialYear, initialMonth, initialDay] = parseIsoDate(date)
  const targetMonthIndex = initialYear * 12 + initialMonth - 1 + months
  let year = Math.floor(targetMonthIndex / 12)
  let month = targetMonthIndex - year * 12 + 1
  let day = initialDay
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getPaymentTerms(eventDateIso: string, today: string): PaymentTerms {
  const daysUntil = eventDateIso
    ? Math.round((isoDateToUtc(eventDateIso) - isoDateToUtc(today)) / MS_PER_DAY)
    : null
  const shortNotice = daysUntil !== null && daysUntil < SHORT_NOTICE_DAYS
  return {
    depositPercent: shortNotice ? 100 : 50,
    shortNotice,
    dueDateRule: shortNotice ? 'due-at-signing' : 'fourteen-days-before-event',
  }
}

export function getQuoteValidityDate(today: string): string {
  return addCalendarMonths(today, QUOTE_VALIDITY_MONTHS)
}

function plural(value: number, singular: string): string {
  return value === 1 ? singular : `${singular}s`
}

function procurementFee(guestCount: number): number | null {
  return PROCUREMENT_TIERS.find((tier) => guestCount <= tier.maxGuests)?.fee ?? null
}

export function calculateQuote(input: QuoteInput, options: CalculateQuoteOptions): QuoteResult {
  const lines: PricingLine[] = []
  const baseHours = input.isSmallGroup ? SMALL_GROUP_BASE_HOURS : STANDARD_BASE_HOURS
  const basePrice = input.isSmallGroup ? SMALL_GROUP_BASE_PRICE : STANDARD_BASE_PRICE
  const fullBarStaff = Math.min(input.bartenderCount, input.fullBarStaffCount || input.bartenderCount)
  const featuredCocktails = input.signatureCocktailCount + input.houseCocktailCount

  const baseLabel = input.isSmallGroup
    ? 'Small Group Package (1 bartender, first 2 hrs, ≤20 guests)'
    : input.serviceHours < baseHours
      ? 'Base Package (1 bartender, first 2 hrs, ≤50 guests)'
      : 'Base Package (1 bartender, first 3 hrs, ≤50 guests)'
  lines.push({ code: 'base-package', label: baseLabel, quantity: 1, unitPrice: basePrice, amount: basePrice })

  const additionalBartenders = input.bartenderCount - 1
  if (additionalBartenders > 0) {
    const quantity = additionalBartenders * baseHours
    lines.push({
      code: 'additional-bartenders',
      label: `Additional Bartenders (${additionalBartenders} additional ${plural(additionalBartenders, 'bartender')}, first ${baseHours} hrs)`,
      quantity,
      unitPrice: HOURLY_RATE,
      amount: quantity * HOURLY_RATE,
    })
  }

  if (input.serviceHours < baseHours && !input.isSmallGroup) {
    const quantity = (baseHours - input.serviceHours) * input.bartenderCount
    lines.push({
      code: 'two-hour-reduction',
      label: '2-Hour Service Reduction',
      quantity,
      unitPrice: -HOURLY_RATE,
      amount: -quantity * HOURLY_RATE,
    })
  }

  if (input.serviceHours > baseHours) {
    const extendedHours = input.serviceHours - baseHours
    const ordinaryAmount = extendedHours * HOURLY_RATE * input.bartenderCount
    const premiumHours = Math.max(0, input.serviceHours - LONG_EVENT_PREMIUM_START_HOUR + 1)
    const premiumAmount = premiumHours * LONG_EVENT_PREMIUM * input.bartenderCount
    const hasPremium = premiumAmount > 0
    lines.push({
      code: 'extended-service-hours',
      label: `${hasPremium ? 'Extended Service Hours, including long-event premium' : 'Extended Service Hours'} (+${extendedHours} ${plural(extendedHours, 'hr')} × ${input.bartenderCount} ${plural(input.bartenderCount, 'bartender')})`,
      quantity: extendedHours * input.bartenderCount,
      amount: ordinaryAmount + premiumAmount,
    })
  }

  if (input.packageType === 'fullbar') {
    const quantity = input.serviceHours * fullBarStaff
    lines.push({
      code: 'full-bar-service',
      label: `Full Bar Service (${input.serviceHours} ${plural(input.serviceHours, 'hr')} × ${fullBarStaff} ${plural(fullBarStaff, 'bartender')})`,
      quantity,
      unitPrice: FULL_BAR_HOURLY,
      amount: quantity * FULL_BAR_HOURLY,
    })
  }

  if (input.signatureCocktailCount > 0) {
    lines.push({
      code: 'signature-cocktails',
      label: `Signature Cocktails (${input.signatureCocktailCount} @ $125)`,
      quantity: input.signatureCocktailCount,
      unitPrice: SIGNATURE_COCKTAIL_RATE,
      amount: input.signatureCocktailCount * SIGNATURE_COCKTAIL_RATE,
    })
  }

  if (input.houseCocktailCount > 0) {
    lines.push({
      code: 'house-cocktails',
      label: `House Featured Cocktails (${input.houseCocktailCount} @ $50)`,
      quantity: input.houseCocktailCount,
      unitPrice: HOUSE_COCKTAIL_RATE,
      amount: input.houseCocktailCount * HOUSE_COCKTAIL_RATE,
    })
  }

  if (featuredCocktails >= EXPANDED_COCKTAIL_MINIMUM) {
    const extensive = featuredCocktails >= EXTENSIVE_COCKTAIL_MINIMUM
    const amount = extensive ? COCKTAIL_PROGRAM_EXTENSIVE : COCKTAIL_PROGRAM_EXPANDED
    lines.push({
      code: 'cocktail-program',
      label: `${extensive ? 'Extensive' : 'Expanded'} Featured Cocktail Program (${featuredCocktails} featured cocktails)`,
      quantity: 1,
      unitPrice: amount,
      amount,
    })
  }

  if (input.hasMultiBarOperations) {
    lines.push({
      code: 'multi-bar-operations',
      label: 'Large Event & Multi-Bar Operations (replaces high-volume adjustment)',
      quantity: 1,
      unitPrice: MULTI_BAR_OPERATIONS_FEE,
      amount: MULTI_BAR_OPERATIONS_FEE,
    })
  } else if (input.guestCount > 50) {
    const amount = input.guestCount <= 100 ? VOLUME_ADJUSTMENT_51_TO_100 : VOLUME_ADJUSTMENT_101_PLUS
    const range = input.guestCount <= 100 ? '51-100 guests' : '101+ guests'
    lines.push({
      code: 'volume-adjustment',
      label: `High-Volume Event Adjustment (${range})`,
      quantity: 1,
      unitPrice: amount,
      amount,
    })
  }

  const addonNames: string[] = []
  let addonAmount = 0
  const procurement = procurementFee(input.guestCount)
  const procurementRequiresCustomQuote = input.hasAlcoholProcurement && procurement === null
  if (input.hasAlcoholProcurement && procurement !== null) {
    addonNames.push('Alcohol Procurement & Return Service')
    addonAmount += procurement
  }
  if (input.hasCoffeeService) {
    addonNames.push('Coffee Service')
    addonAmount += COFFEE_SERVICE_PRICE
  }
  if (input.hasArchBackdrop) {
    addonNames.push('Arch Backdrop')
    addonAmount += ARCH_BACKDROP_PRICE
  }
  if (input.hasCustomLogoIce && input.logoIceCubeCount > 0) {
    addonNames.push(`Custom Logo Ice (${input.logoIceCubeCount} cubes)`)
    addonAmount += input.logoIceCubeCount * CUSTOM_LOGO_ICE_RATE
  }
  if (input.hasTentRental) {
    addonNames.push('Tent Rental')
    addonAmount += TENT_RENTAL_PRICE
  }
  if (addonAmount > 0) {
    lines.push({
      code: 'premium-add-ons',
      label: `Premium Add-Ons (${addonNames.join(', ')})`,
      quantity: addonNames.length,
      amount: addonAmount,
    })
  }

  if (input.glasswareType === 'formal') {
    const amount = Math.round(input.glassCount * FORMAL_GLASS_PRICE)
    if (amount > 0) {
      lines.push({
        code: 'premium-glassware',
        label: `Premium Glassware (${input.glassCount} glasses)`,
        quantity: input.glassCount,
        unitPrice: FORMAL_GLASS_PRICE,
        amount,
      })
    }
  }

  if (input.oneWayDistanceMiles > INCLUDED_ONE_WAY_MILES) {
    const extraOneWayMiles = input.oneWayDistanceMiles - INCLUDED_ONE_WAY_MILES
    const roundTripMiles = extraOneWayMiles * 2
    lines.push({
      code: 'travel',
      label: `Travel Fee (${extraOneWayMiles} extra miles)`,
      quantity: roundTripMiles,
      unitPrice: EXCESS_MILEAGE_RATE,
      amount: Math.round(roundTripMiles * EXCESS_MILEAGE_RATE),
    })
  }

  const customItemsTotal = input.customItems.reduce((sum, item) => sum + item.price, 0)
  if (customItemsTotal > 0) {
    lines.push({
      code: 'custom-items',
      label: `Custom Items (${input.customItems.map((item) => item.name).join(', ')})`,
      quantity: input.customItems.length,
      amount: customItemsTotal,
    })
  }

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const promo = input.promoCode ? PROMO_CODES[input.promoCode] : null
  const eligiblePromo = promo && (!promo.smallGroupOnly || input.isSmallGroup) ? promo : null
  const promoDiscount = eligiblePromo
    ? eligiblePromo.type === 'percent' ? Math.round(subtotal * eligiblePromo.value) : eligiblePromo.value
    : 0
  if (promoDiscount > 0 && input.promoCode) {
    lines.push({
      code: 'promo-discount',
      label: `Promo Discount ${input.promoCode}`,
      quantity: 1,
      amount: -promoDiscount,
    })
  }

  const customDiscount = input.customDiscount
    ? input.customDiscount.type === 'percent'
      ? Math.round((subtotal - promoDiscount) * input.customDiscount.value)
      : input.customDiscount.value
    : 0
  if (customDiscount > 0) {
    lines.push({
      code: 'custom-discount',
      label: input.customDiscount?.label || 'Custom Discount',
      quantity: 1,
      amount: -customDiscount,
    })
  }

  const total = subtotal - promoDiscount - customDiscount
  const paymentTerms = getPaymentTerms(input.eventDateIso, options.today)
  const deposit = paymentTerms.shortNotice ? total : Math.round(total * 0.5)

  return {
    lines,
    subtotal,
    discounts: { promo: promoDiscount, custom: customDiscount, total: promoDiscount + customDiscount },
    total,
    deposit,
    balance: total - deposit,
    paymentTerms,
    quoteValidityDate: getQuoteValidityDate(options.today),
    quantities: {
      guests: input.guestCount,
      hours: input.serviceHours,
      bartenders: input.bartenderCount,
      fullBarStaff,
      glasses: input.glassCount,
      signatureCocktails: input.signatureCocktailCount,
      houseCocktails: input.houseCocktailCount,
      featuredCocktails,
      logoIceCubes: input.hasCustomLogoIce ? input.logoIceCubeCount : 0,
      oneWayMiles: input.oneWayDistanceMiles,
    },
    procurementRequiresCustomQuote,
  }
}
