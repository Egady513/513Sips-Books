/// <reference types="node" />

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { calculateMultiEventQuote } from './calculateMultiEventQuote.ts'
import { calculateQuote } from './calculateQuote.ts'
import { fromFormInputs, type BaselineFormInput } from './fromFormInputs.ts'
import type { QuoteQuantities, QuoteResult } from './types.ts'

const TODAY = '2026-10-31'

interface ExpectedLine {
  label: string
  amount: number
}

interface ExpectedEvent {
  total: number
  deposit: number
  balance: number
  lines: ExpectedLine[]
  quantities: QuoteQuantities
}

interface ExpectedMultiEvent {
  events: ExpectedEvent[]
  total: number
  deposit: number
  balance: number
}

interface Fixture {
  name: string
  input: BaselineFormInput & { events?: BaselineFormInput[]; changes?: BaselineFormInput[] }
  expected: ExpectedEvent | ExpectedMultiEvent
}

interface FixtureDocument {
  fixtures: Fixture[]
}

const fixtureDocument = JSON.parse(
  readFileSync(new URL('../../../baseline/golden-fixtures.json', import.meta.url), 'utf8'),
) as FixtureDocument

function comparableLines(result: QuoteResult): ExpectedLine[] {
  return result.lines.map(({ label, amount }) => ({ label, amount }))
}

function assertEvent(actual: QuoteResult, expected: ExpectedEvent): void {
  assert.equal(actual.total, expected.total, 'total')
  assert.equal(actual.deposit, expected.deposit, 'deposit')
  assert.equal(actual.balance, expected.balance, 'balance')
  assert.deepEqual(comparableLines(actual), expected.lines, 'ordered lines')
  assert.deepEqual(actual.quantities, expected.quantities, 'stored quantities')
}

function finalFormInput(input: Fixture['input']): BaselineFormInput {
  const { changes = [], ...initial } = input
  return changes.reduce<BaselineFormInput>((current, change) => ({ ...current, ...change }), initial)
}

// FLAG: Evers HIGH saved record is $7,131; today's rules give $7,206 (hour-five premium). Owner decision pending. Do not change the saved quote.
// Both Evers HIGH fixtures below exercise today's rules. The engine has no customer-specific branch.
for (const fixture of fixtureDocument.fixtures) {
  test(`golden fixture: ${fixture.name}`, () => {
    if (fixture.input.events) {
      const expected = fixture.expected as ExpectedMultiEvent
      const actual = calculateMultiEventQuote(
        fixture.input.events.map((event, index) => ({
          name: typeof event.eventName === 'string' && event.eventName ? event.eventName : `Event ${index + 1}`,
          input: fromFormInputs(event),
        })),
        { today: TODAY },
      )
      assert.equal(actual.total, expected.total, 'combined total')
      assert.equal(actual.deposit, expected.deposit, 'combined deposit')
      assert.equal(actual.balance, expected.balance, 'combined balance')
      assert.equal(actual.events.length, expected.events.length)
      actual.events.forEach((event, index) => assertEvent(event.result, expected.events[index]))
      return
    }

    assertEvent(calculateQuote(fromFormInputs(finalFormInput(fixture.input)), { today: TODAY }), fixture.expected as ExpectedEvent)
  })
}

test('rounding: formal glassware rounds $3.50 up to $4', () => {
  const result = calculateQuote(fromFormInputs({ glassware: 'formal', glassCount: 1 }), { today: TODAY })
  assert.equal(result.lines.find((line) => line.code === 'premium-glassware')?.amount, 4)
  assert.equal(result.total, 654)
})

test('rounding: travel rounds after multiplying excess roundtrip miles', () => {
  const result = calculateQuote(fromFormInputs({ distance: 31 }), { today: TODAY })
  assert.equal(result.lines.find((line) => line.code === 'travel')?.amount, 1)
})

test('rounding: percent promo rounds its discount before deposit', () => {
  const result = calculateQuote(
    fromFormInputs({ glassware: 'formal', glassCount: 1, promoCode: 'FIRST10' }),
    { today: TODAY },
  )
  assert.equal(result.subtotal, 654)
  assert.equal(result.discounts.promo, 65)
  assert.equal(result.total, 589)
  assert.equal(result.deposit, 295)
})

test('quote validity preserves page calendar-month overflow', () => {
  const result = calculateQuote(fromFormInputs(), { today: '2026-01-31' })
  assert.equal(result.quoteValidityDate, '2026-05-01')
})

const procurementEdges = [
  { name: '99 to 100', belowGuests: 99, belowFee: 175, aboveGuests: 100, aboveFee: 275 },
  { name: '150 to 151', belowGuests: 150, belowFee: 275, aboveGuests: 151, aboveFee: 350 },
  { name: '199 to 200', belowGuests: 199, belowFee: 350, aboveGuests: 200, aboveFee: 400 },
  { name: '250 to 251', belowGuests: 250, belowFee: 400, aboveGuests: 251, aboveFee: null },
] as const

for (const edge of procurementEdges) {
  test(`procurement tier edge: ${edge.name}`, () => {
    const below = calculateQuote(fromFormInputs({ guestCount: edge.belowGuests, alcoholProcurement: true }), { today: TODAY })
    const above = calculateQuote(fromFormInputs({ guestCount: edge.aboveGuests, alcoholProcurement: true }), { today: TODAY })
    assert.equal(below.lines.find((line) => line.code === 'premium-add-ons')?.amount, edge.belowFee)
    if (edge.aboveFee === null) {
      assert.equal(above.lines.find((line) => line.code === 'premium-add-ons'), undefined)
      assert.equal(above.procurementRequiresCustomQuote, true)
    } else {
      assert.equal(above.lines.find((line) => line.code === 'premium-add-ons')?.amount, edge.aboveFee)
    }
  })
}
