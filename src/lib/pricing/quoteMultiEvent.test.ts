import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
// @ts-expect-error The pinned JavaScript harness does not ship TypeScript declarations.
import { runCalculator } from '../../../baseline/run-calculator.mjs'
import { calculateMultiEventQuote } from './calculateMultiEventQuote.ts'
import { fromFormInputs } from './fromFormInputs.ts'
import { buildQuoteUpdate, inputsFromSavedQuote, planQuoteChange } from './quoteEdit.ts'
import { buildMultiEventQuoteRecord, toFormConfig } from './quoteRecord.ts'
import type { NamedQuoteInput, QuoteInput } from './types.ts'

interface Fixture {
  name: string
  input: { events?: Array<Record<string, unknown>> }
  expected: { total: number; deposit: number; balance: number }
}

const fixtureDocument = JSON.parse(
  await readFile(new URL('../../../baseline/golden-fixtures.json', import.meta.url), 'utf8'),
) as { fixtures: Fixture[] }
const golden = fixtureDocument.fixtures.find((fixture) => fixture.name === 'Two-event quote')!
const today = '2026-10-31'

const cases: Array<{ name: string; events: Array<Record<string, unknown>> }> = [
  { name: golden.name, events: golden.input.events! },
  {
    name: 'Three-event weekend',
    events: [
      { eventName: 'Welcome', eventDate: '2027-06-10', guestCount: 40 },
      { eventName: 'Wedding', eventDate: '2027-06-11', guestCount: 140, hours: 5, bartenderCount: 3, packageType: 'fullbar', fullBarStaffCount: 3 },
      { eventName: 'Brunch', eventDate: '2027-06-12', guestCount: 65, hours: 2, bartenderCount: 2 },
    ],
  },
  {
    name: 'Earliest date controls package deposit',
    events: [
      { eventName: 'Later reception', eventDate: '2027-02-20', guestCount: 90, hours: 4 },
      { eventName: 'Earlier rehearsal', eventDate: '2027-02-18', guestCount: 45, hours: 3 },
    ],
  },
  {
    name: 'Short-notice earliest event',
    events: [
      { eventName: 'Wedding', eventDate: '2027-01-15', guestCount: 120, hours: 5, bartenderCount: 2 },
      { eventName: 'Last-minute welcome', eventDate: '2026-11-05', guestCount: 35 },
    ],
  },
]

function typedEvents(events: Array<Record<string, unknown>>): NamedQuoteInput[] {
  return events.map((raw, index) => {
    const input = fromFormInputs(raw)
    return { name: input.eventName || `Event ${index + 1}`, input }
  })
}

for (const scenario of cases) {
  test(`multi-event record matches pinned calculator: ${scenario.name}`, async () => {
    const events = typedEvents(scenario.events)
    const result = calculateMultiEventQuote(events, { today })
    const page = await runCalculator({ events: scenario.events })
    assert.equal(result.total, page.total)
    assert.equal(result.deposit, page.deposit)
    assert.equal(result.balance, page.balance)
    assert.deepEqual(result.events.map((event) => event.result.total), page.events.map((event: { total: number }) => event.total))

    const row = buildMultiEventQuoteRecord({ leadId: 'multi-lead', events, result, today })
    assert.equal(row.total, page.total)
    assert.equal(row.deposit, page.deposit)
    assert.equal(row.balance, page.balance)
    assert.equal(row.guest_count, events[0].input.guestCount)
    assert.equal(row.hours, events[0].input.serviceHours)
    assert.equal(row.bartenders, events[0].input.bartenderCount)
    assert.equal(row.promo_code, null)
    assert.deepEqual(row.breakdown.map((event) => event._config), events.map((event) => toFormConfig(event.input)))
    assert.ok(row.breakdown[0].engine)
    assert.equal(row.breakdown.slice(1).some((event) => event.engine), false)
  })
}

test('golden two-event combined amounts match the pinned fixture', () => {
  const events = typedEvents(golden.input.events!)
  const result = calculateMultiEventQuote(events, { today })
  assert.deepEqual(
    { total: result.total, deposit: result.deposit, balance: result.balance },
    { total: golden.expected.total, deposit: golden.expected.deposit, balance: golden.expected.balance },
  )
})

test('website-shaped multi-event rows rebuild every event input', () => {
  const events = typedEvents(cases[1].events)
  const result = calculateMultiEventQuote(events, { today })
  const built = buildMultiEventQuoteRecord({ leadId: 'website', events, result, today })
  const websiteRow = {
    ...built,
    breakdown: built.breakdown.map((value) => {
      const event = { ...value }
      delete event.engine
      return event
    }),
  }
  const rebuilt = inputsFromSavedQuote(websiteRow)
  assert.ok('events' in rebuilt)
  assert.deepEqual(rebuilt.events, events.map((event) => event.input))
})

test('unchanged multi-event inputs preserve a deliberately different saved price', () => {
  const events = typedEvents(golden.input.events!)
  const current = calculateMultiEventQuote(events, { today })
  const built = buildMultiEventQuoteRecord({ leadId: 'sent', events, result: current, today })
  const row = { ...built, total: current.total + 321, deposit: 1200, balance: current.total - 879, status: 'sent' }
  const inputs = events.map((event) => event.input)
  const plan = planQuoteChange({ row, newInput: inputs, today })
  assert.equal(plan.kind, 'details-only')
  assert.equal(plan.newTotal, current.total)
  const update = buildQuoteUpdate({ row, plan, input: inputs, result: current, today, reason: 'edit' })
  assert.equal('total' in update, false)
  assert.equal('version_history' in update, false)
})

test('multi-event price changes, event count changes and explicit re-quotes require repricing', () => {
  const events = typedEvents(golden.input.events!)
  const result = calculateMultiEventQuote(events, { today })
  const row = buildMultiEventQuoteRecord({ leadId: 'edit', events, result, today })
  const inputs = events.map((event) => event.input)
  const guestChange = inputs.map((input, index) => index === 1 ? { ...input, guestCount: input.guestCount + 1 } : input)
  assert.equal(planQuoteChange({ row, newInput: guestChange, today }).kind, 'reprice')
  assert.equal(planQuoteChange({ row, newInput: [...inputs, structuredClone(inputs[0])], today }).kind, 'reprice')
  assert.equal(planQuoteChange({ row, newInput: inputs.slice(0, 1), today }).kind, 'reprice')
  assert.equal(planQuoteChange({ row, newInput: inputs, today, requote: true }).kind, 'reprice')
})

test('multi-event detail saves preserve stored values and repricing appends one history entry', () => {
  const events = typedEvents(golden.input.events!)
  const result = calculateMultiEventQuote(events, { today })
  const row = { ...buildMultiEventQuoteRecord({ leadId: 'edit', events, result, today }), status: 'sent' }
  const changed: QuoteInput[] = events.map((event, index) => index === 0
    ? { ...event.input, eventName: 'Updated welcome', clientNotes: 'Rain plan included' }
    : event.input)
  const detailsPlan = planQuoteChange({ row, newInput: changed, today })
  assert.equal(detailsPlan.kind, 'details-only')
  const details = buildQuoteUpdate({ row, plan: detailsPlan, input: changed, result: calculateMultiEventQuote(changed.map((input) => ({ name: input.eventName, input })), { today }), today, reason: 'edit' })
  assert.equal('total' in details, false)
  assert.equal((details.breakdown as Array<{ total: number }>)[0].total, row.breakdown[0].total)

  const repricedInputs = changed.map((input, index) => index === 1 ? { ...input, serviceHours: 5 } : input)
  const repriced = calculateMultiEventQuote(repricedInputs.map((input) => ({ name: input.eventName, input })), { today })
  const repricePlan = planQuoteChange({ row, newInput: repricedInputs, today })
  const update = buildQuoteUpdate({ row, plan: repricePlan, input: repricedInputs, result: repriced, today, reason: 'edit' })
  assert.equal((update.version_history as unknown[]).length, row.version_history.length + 1)
  assert.equal('status' in update, false)
})
