import { calculateQuote, getPaymentTerms, getQuoteValidityDate } from './calculateQuote.ts'
import type {
  CalculateQuoteOptions,
  MultiEventQuoteResult,
  NamedQuoteInput,
  QuoteDiscounts,
} from './types.ts'

export function calculateMultiEventQuote(
  events: NamedQuoteInput[],
  options: CalculateQuoteOptions,
): MultiEventQuoteResult {
  const calculatedEvents = events.map((event) => ({
    name: event.name,
    result: calculateQuote(event.input, options),
  }))
  const total = calculatedEvents.reduce((sum, event) => sum + event.result.total, 0)
  const subtotal = calculatedEvents.reduce((sum, event) => sum + event.result.subtotal, 0)
  const discounts = calculatedEvents.reduce<QuoteDiscounts>(
    (sum, event) => ({
      promo: sum.promo + event.result.discounts.promo,
      custom: sum.custom + event.result.discounts.custom,
      total: sum.total + event.result.discounts.total,
    }),
    { promo: 0, custom: 0, total: 0 },
  )
  const earliestEventDate = events
    .map((event) => event.input.eventDateIso)
    .filter(Boolean)
    .sort()[0] ?? ''
  const paymentTerms = getPaymentTerms(earliestEventDate, options.today)
  const deposit = paymentTerms.shortNotice ? total : Math.round(total * 0.5)

  return {
    events: calculatedEvents,
    subtotal,
    discounts,
    total,
    deposit,
    balance: total - deposit,
    paymentTerms,
    quoteValidityDate: getQuoteValidityDate(options.today),
  }
}
