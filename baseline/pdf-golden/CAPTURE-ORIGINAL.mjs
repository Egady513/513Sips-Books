import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { calculateQuote } from '../../src/lib/pricing/calculateQuote.ts'
import { fromFormInputs } from '../../src/lib/pricing/fromFormInputs.ts'
import { buildQuoteRecord, toFormConfig } from '../../src/lib/pricing/quoteRecord.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const fixtureDocument = JSON.parse(await readFile(path.join(repo, 'baseline/golden-fixtures.json'), 'utf8'))
const todayIso = fixtureDocument.baselineDate
const today = new Date(`${todayIso}T12:00:00`)

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
]

function originalBuilder() {
  const source = execFileSync('git', ['show', 'HEAD:src/pages/LeadsPage.tsx'], {
    cwd: repo,
    encoding: 'utf8',
  })
  const start = source.indexOf('  function handleDownloadQuotePDF')
  const end = source.indexOf('  // Open calculator with lead pre-loaded', start)
  if (start < 0 || end < 0) throw new Error('Original PDF builder was not found in HEAD')
  let fn = source.slice(start, end).trimEnd()
    .split(/\r?\n/)
    .map(line => line.startsWith('  ') ? line.slice(2) : line)
    .join('\n')
  fn = fn.replace(
    'function handleDownloadQuotePDF(lead: Lead, quote: Quote) {',
    'function legacyBuildQuotePdfHtml(lead: unknown, quote: unknown, today: Date): string {',
  )
  fn = fn.replace(
    "const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })",
    "const preparedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })",
  )
  fn = fn.replace('`Prepared ${today}${validUntilStr', '`Prepared ${preparedDate}${validUntilStr')
  fn = fn.replaceAll('Date.now()', 'today.getTime()')
  fn = fn.replace(
    /  const win = window\.open\('', '_blank'\)\n  if \(win\) \{ win\.document\.write\(html\); win\.document\.close\(\) \}\n\}$/,
    '  return html\n}',
  )
  const javascript = ts.transpileModule(fn, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  return new Function(`${javascript}\nreturn legacyBuildQuotePdfHtml`)()
}

function finalInput(fixture) {
  const { changes = [], ...initial } = fixture.input
  return changes.reduce((current, change) => ({ ...current, ...change }), initial)
}

function leadFor(input, eventCount = 1) {
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

function rowFor(fixture) {
  const input = fromFormInputs(finalInput(fixture))
  const result = calculateQuote(input, { today: todayIso })
  return { lead: leadFor(input), quote: buildQuoteRecord({ leadId: 'lead-compat', input, result, today: todayIso }) }
}

function multiEventRow(fixture) {
  const inputs = fixture.input.events.map(event => fromFormInputs(event))
  const entries = inputs.map((input, index) => ({
    name: input.eventName || `Event ${index + 1}`,
    total: fixture.expected.events[index].total,
    guestCount: input.guestCount,
    hours: input.serviceHours,
    bartenders: input.bartenderCount,
    bd: fixture.expected.events[index].breakdown,
    _config: toFormConfig(input),
  }))
  const first = inputs[0]
  return {
    lead: leadFor(first, entries.length),
    quote: {
      lead_id: 'lead-compat',
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
      status: 'draft',
    },
  }
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const buildOriginal = originalBuilder()
await mkdir(here, { recursive: true })
for (const name of selectedNames) {
  const fixture = fixtureDocument.fixtures.find(candidate => candidate.name === name)
  if (!fixture) throw new Error(`Fixture not found: ${name}`)
  const row = fixture.input.events ? multiEventRow(fixture) : rowFor(fixture)
  const html = buildOriginal(row.lead, row.quote, today)
  await writeFile(path.join(here, `${slug(name)}.html`), html)
  console.log(`captured ${name}`)
}
