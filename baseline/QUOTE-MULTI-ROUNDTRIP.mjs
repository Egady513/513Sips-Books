#!/usr/bin/env node

import assert from 'node:assert/strict'
import { runCalculator } from './run-calculator.mjs'
import {
  buildMultiEventQuoteRecord,
  calculateMultiEventQuote,
  fromFormInputs,
  inputsFromSavedQuote,
  storedEventSections,
  toFormConfig,
} from '../src/lib/pricing/index.ts'

const TODAY = '2026-10-31'
const cases = [
  {
    name: 'Welcome party and wedding',
    events: [
      { eventName: 'Welcome Party', eventDate: '2026-11-21', guestCount: 50 },
      { eventName: 'Wedding', eventDate: '2026-11-22', guestCount: 100, hours: 4, bartenderCount: 2, packageType: 'fullbar', fullBarStaffCount: 2, cocktailCount: 1 },
    ],
  },
  {
    name: 'Three-event weekend',
    events: [
      { eventName: 'Rehearsal', eventDate: '2027-04-08', guestCount: 45 },
      { eventName: 'Wedding', eventDate: '2027-04-09', guestCount: 180, hours: 6, bartenderCount: 4, packageType: 'fullbar', fullBarStaffCount: 3 },
      { eventName: 'Brunch', eventDate: '2027-04-10', guestCount: 70, hours: 2, bartenderCount: 2 },
    ],
  },
  {
    name: 'Short-notice package',
    events: [
      { eventName: 'Late event', eventDate: '2027-01-15', guestCount: 90 },
      { eventName: 'Early event', eventDate: '2026-11-05', guestCount: 30 },
    ],
  },
  {
    name: 'Cocktails and add-ons',
    events: [
      { eventName: 'Cocktail hour', eventDate: '2027-05-01', guestCount: 80, cocktailCount: 3, houseCocktailCount: 2, coffeeService: true },
      { eventName: 'Reception', eventDate: '2027-05-01', guestCount: 130, hours: 5, bartenderCount: 3, alcoholProcurement: true },
    ],
  },
  {
    name: 'Travel and formal glassware',
    events: [
      { eventName: 'Dinner', eventDate: '2027-07-10', guestCount: 60, distance: 45, glassware: 'formal', glassCount: 240 },
      { eventName: 'Wedding', eventDate: '2027-07-11', guestCount: 120, distance: 45, glassware: 'formal', glassCount: 480 },
    ],
  },
  {
    name: 'Promos and custom items',
    events: [
      { eventName: 'Launch', eventDate: '2027-08-20', guestCount: 50, promoCode: 'FIRST10', customItems: [{ name: 'Welcome sign', price: 125 }] },
      { eventName: 'After party', eventDate: '2027-08-21', guestCount: 75, promoCode: 'VENDOR50', customItems: [{ name: 'Late-night setup', price: 200 }] },
    ],
  },
]

function typedEvents(rawEvents) {
  return rawEvents.map((raw, index) => {
    const input = fromFormInputs(raw)
    return { name: input.eventName || `Event ${index + 1}`, input }
  })
}

console.log(`${'Result'.padEnd(8)} ${'Case'.padEnd(36)} Total`)
console.log(`${'-'.repeat(8)} ${'-'.repeat(36)} ${'-'.repeat(10)}`)

for (const scenario of cases) {
  const events = typedEvents(scenario.events)
  const result = calculateMultiEventQuote(events, { today: TODAY })
  const row = buildMultiEventQuoteRecord({ leadId: 'offline-multi-roundtrip', events, result, today: TODAY })

  const reopened = await runCalculator({ events: row.breakdown.map((event) => event._config) })
  assert.equal(reopened.total, row.total, `${scenario.name} total`)
  assert.equal(reopened.deposit, row.deposit, `${scenario.name} deposit`)
  assert.equal(reopened.balance, row.balance, `${scenario.name} balance`)

  const page = await runCalculator({ events: scenario.events })
  const websiteBreakdown = events.map((event, index) => ({
    name: event.name,
    total: page.events[index].total,
    guestCount: event.input.guestCount,
    hours: event.input.serviceHours,
    bartenders: event.input.bartenderCount,
    bd: page.events[index].breakdown,
    _config: toFormConfig(event.input),
  }))
  const websiteRow = {
    total: page.total,
    deposit: page.deposit,
    balance: page.balance,
    guest_count: events[0].input.guestCount,
    hours: events[0].input.serviceHours,
    bartenders: events[0].input.bartenderCount,
    breakdown: websiteBreakdown,
    promo_code: null,
    addon_notes: websiteBreakdown.map((event, index) => `Event ${index + 1} — ${event.name}: $${event.total}`).join('\n'),
  }
  const rebuilt = inputsFromSavedQuote(websiteRow)
  assert.deepEqual(rebuilt.events, events.map((event) => event.input), `${scenario.name} reverse inputs`)
  const sections = storedEventSections(websiteRow.breakdown)
  assert.deepEqual(sections.map((event) => event.total), page.events.map((event) => event.total), `${scenario.name} saved view event totals`)
  assert.equal(sections.reduce((sum, event) => sum + event.total, 0), websiteRow.total, `${scenario.name} saved view combined total`)

  console.log(`${'PASS'.padEnd(8)} ${scenario.name.padEnd(36)} $${row.total.toLocaleString()}`)
}

console.log(`\n${cases.length} multi-event records passed both round-trip directions.`)
