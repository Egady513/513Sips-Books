import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { calculateQuote } from './calculateQuote.ts'
import { fromFormInputs } from './fromFormInputs.ts'
import { buildQuoteRecord, toFormConfig, toLegacyBreakdown } from './quoteRecord.ts'

interface Fixture {
  name: string
  input: Record<string, unknown> & { events?: unknown[]; changes?: Array<Record<string, unknown>> }
  expected: { breakdown?: unknown; total: number }
}

const fixtureDocument = JSON.parse(
  await readFile(new URL('../../../baseline/golden-fixtures.json', import.meta.url), 'utf8'),
) as { fixtures: Fixture[] }
const singleEventFixtures = fixtureDocument.fixtures.filter((fixture) => fixture.expected.breakdown)
const today = '2026-10-31'

function finalFixtureInput(fixture: Fixture): Record<string, unknown> {
  const { changes = [], ...initial } = fixture.input
  return changes.reduce<Record<string, unknown>>((current, change) => ({ ...current, ...change }), initial)
}

for (const fixture of singleEventFixtures) {
  test(`legacy breakdown: ${fixture.name}`, () => {
    const input = fromFormInputs(finalFixtureInput(fixture))
    const result = calculateQuote(input, { today })
    assert.deepEqual(toLegacyBreakdown(result, input), fixture.expected.breakdown)
  })
}

test('toFormConfig returns the calculator getCurrentConfig shape', () => {
  const input = fromFormInputs({
    eventName: 'Launch Party', eventDate: '2027-02-10', guestCount: 80, hours: 5,
    packageType: 'fullbar', bartenderCount: 3, fullBarStaffCount: 2,
    customPromoLabel: 'Partner', customPromoAmount: 10, customPromoType: 'percent',
  })
  assert.deepEqual(toFormConfig(input), {
    eventName: 'Launch Party', quoteOptionName: '', clientNotes: '', eventDate: '2027-02-10',
    guestCount: '80', hours: '5', packageType: 'fullbar', glassware: 'plastic_at_cost',
    glassCount: '0', distance: '0', cocktailCount: '0', houseCocktailCount: '0',
    signatureCocktailNames: '', houseCocktailNames: '', bartenderCount: '3',
    fullBarStaffCount: '2', smallGroup: false, multiBarOperations: false,
    alcoholProcurement: false, coffeeService: false, archBackdrop: false,
    drinkBigIce: false, iceCount: '100', tentRental: false, promoCode: '', customItems: [],
    customPromo: { label: 'Partner', type: 'percent', value: 0.1, raw: 10 },
    customPromoLabel: 'Partner', customPromoAmount: '10', customPromoType: 'percent',
  })
})

test('buildQuoteRecord creates a website-compatible draft row', () => {
  const fixture = singleEventFixtures[0]
  const input = fromFormInputs(fixture.input)
  const result = calculateQuote(input, { today })
  const record = buildQuoteRecord({ leadId: 'lead-123', input, result, today, statusDefault: 'draft' })
  assert.equal(record.total, fixture.expected.total)
  assert.equal(record.event_date, input.eventDateIso)
  assert.equal(record.breakdown.engine.result.total, fixture.expected.total)
  assert.deepEqual(record.breakdown._config, toFormConfig(input))
  assert.deepEqual(record.version_history, [{
    versionNum: 1, total: result.total, deposit: result.deposit, balance: result.balance,
    status: 'draft', created_at: '2026-10-31T00:00:00.000Z',
  }])
})

test('buildQuoteRecord refuses multi-event input', () => {
  const input = fromFormInputs({}) as ReturnType<typeof fromFormInputs> & { events: unknown[] }
  input.events = [{}, {}]
  const result = calculateQuote(input, { today })
  assert.throws(
    () => buildQuoteRecord({ leadId: 'lead-123', input, result, today }),
    /Multi-event quotes are not supported/,
  )
})
