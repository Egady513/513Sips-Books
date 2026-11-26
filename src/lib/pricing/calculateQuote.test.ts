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
  assert.equal(result.total, 754)
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
  assert.equal(result.subtotal, 754)
  assert.equal(result.discounts.promo, 75)
  assert.equal(result.total, 679)
  assert.equal(result.deposit, 340)
})

test('2026 pricing: Huffman case totals $4,410', () => {
  const result = calculateQuote(fromFormInputs({
    guestCount: 175,
    hours: 5,
    bartenderCount: 4,
    fullBarStaffCount: 4,
    barCount: 2,
    packageType: 'fullbar',
    glassware: 'formal',
    glassCount: 400,
  }), { today: TODAY })
  assert.equal(result.total, 4410)
})

test('2026 pricing: standard and small-group base prices', () => {
  assert.equal(calculateQuote(fromFormInputs({ guestCount: 50 }), { today: TODAY }).total, 750)
  assert.equal(calculateQuote(fromFormInputs({ guestCount: 20, smallGroup: true, hours: 2 }), { today: TODAY }).total, 395)
})

test('2026 pricing: additional bar charges', () => {
  for (const [barCount, amount] of [[1, 0], [2, 225], [3, 375], [4, 525]] as const) {
    const result = calculateQuote(fromFormInputs({ barCount }), { today: TODAY })
    assert.equal(result.lines.find((line) => line.code === 'multi-bar-operations')?.amount ?? 0, amount)
  }
})

test('2026 pricing: volume tiers and bar charges stack', () => {
  for (const [guestCount, amount] of [[50, 0], [51, 175], [100, 175], [101, 300], [150, 300], [151, 400]] as const) {
    const result = calculateQuote(fromFormInputs({ guestCount }), { today: TODAY })
    assert.equal(result.lines.find((line) => line.code === 'volume-adjustment')?.amount ?? 0, amount)
  }
  const stacked = calculateQuote(fromFormInputs({ guestCount: 120, barCount: 3 }), { today: TODAY })
  assert.equal(stacked.lines.find((line) => line.code === 'volume-adjustment')?.amount, 300)
  assert.equal(stacked.lines.find((line) => line.code === 'multi-bar-operations')?.amount, 375)
})

test('2026 pricing: signature rates, house cocktails and featured program', () => {
  for (const [guestCount, amount] of [[75, 250], [76, 300], [150, 300], [151, 350]] as const) {
    const result = calculateQuote(fromFormInputs({ guestCount, cocktailCount: 2 }), { today: TODAY })
    assert.equal(result.lines.find((line) => line.code === 'signature-cocktails')?.amount, amount)
  }
  const house = calculateQuote(fromFormInputs({ houseCocktailCount: 2 }), { today: TODAY })
  assert.equal(house.lines.find((line) => line.code === 'house-cocktails')?.amount, 100)
  const featured = calculateQuote(fromFormInputs({ cocktailCount: 3, houseCocktailCount: 2 }), { today: TODAY })
  assert.equal(featured.lines.find((line) => line.code === 'cocktail-program')?.amount, 250)
})

test('2026 pricing: logo ice is $3 per cube', () => {
  const result = calculateQuote(fromFormInputs({ drinkBigIce: true, iceCount: 100 }), { today: TODAY })
  assert.equal(result.lines.find((line) => line.code === 'premium-add-ons')?.amount, 300)
})

test('legacy multi-bar values map to two bars', () => {
  assert.equal(fromFormInputs({ multiBarOperations: true }).barCount, 2)
  assert.equal(fromFormInputs({ multiBarOperations: 500 }).barCount, 2)
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
