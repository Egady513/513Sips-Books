import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { calculateQuote } from './pricing/calculateQuote.ts'
import { fromFormInputs } from './pricing/fromFormInputs.ts'
import { buildQuoteRecord, toFormConfig } from './pricing/quoteRecord.ts'
import { buildQuotePdfHtml, type QuotePdfLead, type QuotePdfQuote } from './quotePdf.ts'

interface ExpectedEvent {
  total: number
  lines: Array<{ label: string; amount: number }>
  breakdown: Record<string, unknown>
}

interface Fixture {
  name: string
  input: Record<string, unknown> & { events?: Record<string, unknown>[]; changes?: Record<string, unknown>[] }
  expected: {
    total: number
    deposit: number
    balance: number
    lines?: Array<{ label: string; amount: number }>
    breakdown?: Record<string, unknown>
    events?: ExpectedEvent[]
  }
}

interface FixtureRow {
  fixture: Fixture
  lead: QuotePdfLead
  booksQuote: QuotePdfQuote
  websiteQuote: QuotePdfQuote
  lineAmounts: number[]
}

const fixtureDocument = JSON.parse(
  await readFile(new URL('../../baseline/golden-fixtures.json', import.meta.url), 'utf8'),
) as { baselineDate: string; fixtures: Fixture[] }

const selectedNames = [
  'Evers LOW, full bar for all staff',
  'Evers HIGH, four Full Bar staff',
  'Package Signature',
  'Package Premier at 100 guests',
  'Focused package at 20 guests',
  'Eight featured cocktails',
  'Multi-bar replaces volume adjustment',
  'Hour 6 long-event premium',
  'Promo FIRST10',
  'Travel at 40 one-way miles',
  'Custom add-on',
  'Procurement tier 150',
  'Two-event quote',
] as const

const todayIso = fixtureDocument.baselineDate
const today = new Date(`${todayIso}T12:00:00`)

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function finalInput(fixture: Fixture): Record<string, unknown> {
  const { changes = [], ...initial } = fixture.input
  return changes.reduce<Record<string, unknown>>((current, change) => ({ ...current, ...change }), initial)
}

function leadFor(input: ReturnType<typeof fromFormInputs>, eventCount = 1): QuotePdfLead {
  return {
    name: 'PDF Compatibility Client',
    email: 'compat@example.invalid',
    phone: '513-555-0100',
    event_date: input.eventDateIso,
    event_type: 'Compatibility Event',
    guest_count: input.guestCount,
    venue_name: 'Compatibility Venue',
    service_start_time: '18:00',
    service_end_time: '22:00',
    number_of_events: eventCount,
  }
}

function withoutEngine(quote: QuotePdfQuote): QuotePdfQuote {
  const copy = structuredClone(quote)
  if (copy.breakdown && !Array.isArray(copy.breakdown) && typeof copy.breakdown === 'object') {
    delete (copy.breakdown as Record<string, unknown>).engine
  }
  return copy
}

function pdfLineAmounts(breakdown: object): number[] {
  const record = breakdown as Record<string, unknown>
  const amount = (key: string) => typeof record[key] === 'number' ? record[key] as number : 0
  const values = [
    amount('base'),
    amount('staffing'),
    amount('extraHours') + amount('longEventPremium'),
    amount('twoHrReduction'),
    amount('package'),
    amount('cocktails'),
    amount('houseCocktails'),
    amount('cocktailProgram'),
    amount('volume'),
    amount('multiBarOperations'),
    amount('addons'),
    amount('glassware'),
    amount('travel'),
    amount('discount'),
    amount('customDiscount'),
  ]
  if (Array.isArray(record.customItems)) {
    for (const item of record.customItems) {
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).price === 'number') {
        values.push((item as Record<string, number>).price)
      }
    }
  } else {
    values.push(amount('customItemsTotal'))
  }
  return values.filter(value => value > 0)
}

function singleEventRow(fixture: Fixture): FixtureRow {
  const input = fromFormInputs(finalInput(fixture))
  const result = calculateQuote(input, { today: todayIso })
  const booksQuote = buildQuoteRecord({ leadId: 'lead-compat', input, result, today: todayIso })
  return {
    fixture,
    lead: leadFor(input),
    booksQuote,
    websiteQuote: withoutEngine(booksQuote),
    lineAmounts: pdfLineAmounts(booksQuote.breakdown),
  }
}

function multiEventRow(fixture: Fixture): FixtureRow {
  assert.ok(fixture.input.events)
  assert.ok(fixture.expected.events)
  const inputs = fixture.input.events.map(event => fromFormInputs(event))
  const entries = inputs.map((input, index) => ({
    name: input.eventName || `Event ${index + 1}`,
    total: fixture.expected.events![index].total,
    guestCount: input.guestCount,
    hours: input.serviceHours,
    bartenders: input.bartenderCount,
    bd: fixture.expected.events![index].breakdown,
    _config: toFormConfig(input),
  }))
  const first = inputs[0]
  const quote: QuotePdfQuote = {
    total: fixture.expected.total,
    deposit: fixture.expected.deposit,
    balance: fixture.expected.balance,
    guest_count: first.guestCount,
    hours: first.serviceHours,
    bartenders: first.bartenderCount,
    breakdown: entries,
    promo_code: null,
    addon_notes: entries.map((entry, index) => `Event ${index + 1} — ${entry.name}: $${entry.total}`).join('\n'),
    valid_until: '2027-01-31',
  }
  return {
    fixture,
    lead: leadFor(first, entries.length),
    booksQuote: quote,
    websiteQuote: structuredClone(quote),
    lineAmounts: fixture.expected.events.flatMap(event => pdfLineAmounts(event.breakdown)),
  }
}

function money(value: number): string {
  return '$' + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formattedDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

const rows = selectedNames.map(name => {
  const fixture = fixtureDocument.fixtures.find(candidate => candidate.name === name)
  assert.ok(fixture, `Fixture not found: ${name}`)
  return fixture.input.events ? multiEventRow(fixture) : singleEventRow(fixture)
})

for (const row of rows) {
  test(`PDF golden: ${row.fixture.name}`, async () => {
    const actual = buildQuotePdfHtml({ lead: row.lead, quote: row.booksQuote, today })
    const expected = await readFile(
      new URL(`../../baseline/pdf-golden/${slug(row.fixture.name)}.html`, import.meta.url),
      'utf8',
    )
    assert.equal(actual, expected)
  })

  test(`Books and website PDF shapes match: ${row.fixture.name}`, () => {
    const books = buildQuotePdfHtml({ lead: row.lead, quote: row.booksQuote, today })
    const website = buildQuotePdfHtml({ lead: row.lead, quote: row.websiteQuote, today })
    assert.equal(books, website)
  })

  test(`PDF values and quantity labels: ${row.fixture.name}`, () => {
    const html = buildQuotePdfHtml({ lead: row.lead, quote: row.booksQuote, today })
    assert.ok(html.includes(money(row.booksQuote.total)), 'total is missing')
    assert.ok(html.includes(money(row.booksQuote.deposit)), 'deposit is missing')
    assert.ok(html.includes(money(row.booksQuote.balance)), 'balance is missing')
    assert.ok(row.booksQuote.valid_until)
    assert.ok(html.includes(`Valid until ${formattedDate(row.booksQuote.valid_until)}`), 'validity date is missing')
    for (const amount of row.lineAmounts) {
      assert.ok(html.includes(money(amount)), `line amount ${money(amount)} is missing`)
    }
    assert.doesNotMatch(html, /@\s*\$\d/)
    assert.doesNotMatch(html, /\$\d+(?:\.\d+)?\/(?:hr|hour|glass|guest|cube)/i)
  })
}
