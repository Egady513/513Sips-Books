import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateQuote } from '../src/lib/pricing/calculateQuote.ts'
import { fromFormInputs } from '../src/lib/pricing/fromFormInputs.ts'
import { buildQuoteRecord, toFormConfig, toLegacyBreakdown } from '../src/lib/pricing/quoteRecord.ts'

const require = createRequire(import.meta.url)
let JSDOM
let VirtualConsole
try {
  ;({ JSDOM, VirtualConsole } = require('jsdom'))
} catch (error) {
  throw new Error('jsdom was not found. Set NODE_PATH to <folder that contains jsdom>/node_modules.', { cause: error })
}

const here = path.dirname(fileURLToPath(import.meta.url))
const contractHtml = await readFile(path.join(here, 'source', 'contract.html'), 'utf8')
const calculatorFixtures = JSON.parse(await readFile(path.join(here, '..', 'baseline', 'golden-fixtures.json'), 'utf8'))
const captureDate = '2026-11-01'
const fixedNow = '2026-11-01T12:00:00-05:00'
const pdfStubBase64 = Buffer.alloc(256, 0x51).toString('base64')

const scenarioNames = [
  'Evers LOW, full bar for all staff',
  'Evers HIGH, four Full Bar staff',
  'Package Signature',
  'Package Premier at 100 guests',
  'Focused package at 20 guests',
  'Multi-bar replaces volume adjustment',
  'Hour 6 long-event premium',
  'Procurement tier 100',
  'Glass count survives guest change',
  'Promo FIRST10',
  'Travel at 40 one-way miles',
  'Event less than 14 days away',
  'Eight featured cocktails',
  'Two-event quote',
  'Custom add-on',
]

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function finalInput(fixture) {
  const { changes = [], ...initial } = fixture.input
  return changes.reduce((current, change) => ({ ...current, ...change }), initial)
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function fixtureNamed(name) {
  const fixture = calculatorFixtures.fixtures.find(candidate => candidate.name === name)
  assert.ok(fixture, `Calculator fixture not found: ${name}`)
  return fixture
}

function leadFor(name, input, eventCount = 1, overrides = {}) {
  const id = `lead-${slug(name)}`
  return {
    id,
    name: `Synthetic Client: ${name}`,
    email: `${slug(name)}@example.invalid`,
    phone: '513-555-0100',
    event_date: input.eventDateIso,
    event_type: eventCount > 1 ? 'Multi-Event Package' : 'Synthetic Event',
    guest_count: input.guestCount,
    venue_name: 'Synthetic Venue',
    venue_contact_name: 'Synthetic Venue Contact',
    venue_contact_phone: '513-555-0101',
    venue_address: '100 Test Avenue, Cincinnati, OH 45202',
    service_start_time: '18:00',
    service_end_time: '22:00',
    number_of_events: eventCount,
    ...overrides,
  }
}

function singleScenario(name, options = {}) {
  const fixture = fixtureNamed(options.sourceName || name)
  const input = fromFormInputs(finalInput(fixture))
  const result = calculateQuote(input, { today: calculatorFixtures.baselineDate })
  const lead = leadFor(name, input, 1, options.leadOverrides)
  const quote = {
    id: `quote-${slug(name)}`,
    ...buildQuoteRecord({ leadId: lead.id, input, result, today: calculatorFixtures.baselineDate }),
  }
  return { name, lead, quote }
}

function multiScenario(name, sourceEvents) {
  const inputs = sourceEvents.map(event => fromFormInputs(event))
  const rows = inputs.map((input, index) => {
    const result = calculateQuote(input, { today: calculatorFixtures.baselineDate })
    return {
      name: input.eventName || `Event ${index + 1}`,
      total: result.total,
      guestCount: input.guestCount,
      hours: input.serviceHours,
      bartenders: input.bartenderCount,
      bd: toLegacyBreakdown(result, input),
      _config: toFormConfig(input),
    }
  })
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const deposit = Math.round(total * 0.5)
  const lead = leadFor(name, inputs[0], rows.length)
  return {
    name,
    lead,
    quote: {
      id: `quote-${slug(name)}`,
      lead_id: lead.id,
      total,
      deposit,
      balance: total - deposit,
      guest_count: inputs[0].guestCount,
      hours: inputs[0].serviceHours,
      bartenders: inputs[0].bartenderCount,
      event_date: inputs[0].eventDateIso,
      breakdown: rows,
      promo_code: null,
      addon_notes: rows.map((row, index) => `Event ${index + 1}: ${row.name}: $${row.total}`).join('\n'),
      valid_until: '2027-01-31',
      status: 'draft',
    },
  }
}

function buildScenarios() {
  const scenarios = scenarioNames
    .filter(name => name !== 'Two-event quote')
    .map(name => singleScenario(name))

  const twoEvent = fixtureNamed('Two-event quote').input.events
  scenarios.push(multiScenario('Two-event quote', twoEvent))
  scenarios.push(multiScenario('Three-event quote', [
    { eventName: 'Welcome Reception', eventDate: '2026-11-21', guestCount: 50 },
    { eventName: 'Wedding', eventDate: '2026-11-22', guestCount: 100, hours: 4, bartenderCount: 2, packageType: 'fullbar', fullBarStaffCount: 2, cocktailCount: 1 },
    { eventName: 'Farewell Brunch', eventDate: '2026-11-23', guestCount: 20, smallGroup: true, hours: 2 },
  ]))
  scenarios.push(singleScenario('Lead missing venue and time fields', {
    sourceName: 'Package Base line',
    leadOverrides: {
      venue_name: null,
      venue_contact_name: null,
      venue_contact_phone: null,
      venue_address: null,
      service_start_time: null,
      service_end_time: null,
    },
  }))
  return scenarios
}

function response(rows, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => rows }
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 3000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function isVisible(window, element) {
  for (let current = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current)
    if (current.hidden || style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}

function visibleText(window) {
  const walker = window.document.createTreeWalker(window.document.body, window.NodeFilter.SHOW_TEXT)
  const chunks = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement && isVisible(window, node.parentElement) && normalize(node.textContent)) {
      chunks.push(normalize(node.textContent))
    }
  }
  return normalize(chunks.join(' '))
}

function editableFields(document) {
  return Array.from(document.querySelectorAll('.container.no-print input, .container.no-print textarea')).map(field => {
    const label = field.previousElementSibling?.tagName === 'LABEL'
      ? field.previousElementSibling
      : field.parentElement?.querySelector(':scope > label')
    return {
      id: field.id,
      label: normalize(label?.textContent),
      type: field.tagName === 'TEXTAREA' ? 'textarea' : field.type,
      defaultValue: field.value,
      placeholder: field.getAttribute('placeholder') || '',
    }
  })
}

function sectionCapture(document) {
  const clone = document.getElementById('contractPreview').cloneNode(true)
  clone.querySelectorAll('.no-print').forEach(node => node.remove())
  const sections = []
  let current = null
  const walker = document.createTreeWalker(clone, 0x1 | 0x4)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === 1 && node.tagName === 'H3') {
      current = { heading: normalize(node.textContent), text: '' }
      sections.push(current)
    } else if (node.nodeType === 3 && current && node.parentElement?.tagName !== 'H3') {
      const value = normalize(node.textContent)
      if (value) current.text = normalize(`${current.text} ${value}`)
    }
  }
  return sections
}

function labeledRows(root, selector, category) {
  return Array.from(root.querySelectorAll(selector))
    .map(element => ({ category, text: normalize(element.textContent) }))
    .filter(row => row.text.includes('$'))
    .map(row => ({ ...row, amounts: row.text.match(/[-+]?\$[\d,.]+(?:\/hour)?/g) || [] }))
}

function dollarCapture(document, summaryRows) {
  const preview = document.getElementById('contractPreview')
  const payment = preview.querySelector('h3:nth-of-type(4) + ul')
  const breakdown = document.getElementById('contractBreakdown')
  const captured = [
    ...summaryRows,
    ...labeledRows(payment, ':scope > li', 'contract payment'),
    ...labeledRows(breakdown, 'li, p', 'contract pricing breakdown'),
  ]
  const excluded = new Set([...payment.querySelectorAll('li'), ...breakdown.querySelectorAll('li, p')])
  for (const element of preview.querySelectorAll('p, li')) {
    if (!excluded.has(element) && normalize(element.textContent).includes('$')) {
      const text = normalize(element.textContent)
      captured.push({ category: 'hard-coded policy', text, amounts: text.match(/[-+]?\$[\d,.]+(?:\/hour)?/g) || [] })
    }
  }
  return captured
}

function dateCapture(document, quote) {
  return [
    { label: 'Agreement entered on', value: normalize(document.getElementById('contractDate').textContent), visible: true },
    { label: 'Event Date', value: normalize(document.getElementById('contractEventDate').textContent), visible: true },
    { label: 'Deposit due', value: 'at signing', visible: true },
    { label: 'Balance due', value: '14 days prior to the event', visible: true },
    { label: 'Quote validity', value: quote.valid_until || '', visible: false, note: 'Present on the quote record but not rendered by contract.html.' },
    { label: 'Client signature date', value: '___________', visible: true },
    { label: 'Service Provider signature date', value: '___________', visible: true },
  ]
}

function lengthClass(length) {
  if (length < 256) return 'under 256 characters'
  if (length < 1024) return '256 to 1023 characters'
  if (length < 10240) return '1 KiB to under 10 KiB'
  return '10 KiB or more'
}

async function renderScenario(scenario) {
  const requested = []
  const saveRequests = []
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error.message))
  virtualConsole.on('error', error => errors.push(String(error)))
  const dom = new JSDOM(contractHtml, {
    url: `https://baseline.invalid/contract.html?lead_id=${encodeURIComponent(scenario.lead.id)}&quote_id=${encodeURIComponent(scenario.quote.id)}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      const NativeDate = window.Date
      const fixedMilliseconds = new NativeDate(fixedNow).getTime()
      class FixedDate extends NativeDate {
        constructor(...args) {
          super(...(args.length ? args : [fixedNow]))
        }
        static now() { return fixedMilliseconds }
      }
      window.Date = FixedDate
      window.scrollTo = () => {}
      window.open = () => null
      window.alert = () => {}
      window.confirm = () => false
      window.html2pdf = () => ({
        set() { return this },
        from() { return this },
        async outputPdf(format) {
          assert.equal(format, 'datauristring')
          return `data:application/pdf;base64,${pdfStubBase64}`
        },
      })
      window.fetch = async (url, options = {}) => {
        const value = String(url)
        requested.push(value)
        if (value.includes('/rest/v1/leads?')) return response([scenario.lead])
        if (value.includes('/rest/v1/quotes?')) return response([scenario.quote])
        if (value.endsWith('/functions/v1/save-contract')) {
          saveRequests.push({ url: value, options })
          return response({ success: true, contractUrl: 'https://example.invalid/unsigned.pdf', contractId: 'stubbed' }, 201)
        }
        throw new Error(`Network blocked by contract baseline: ${value}`)
      }
    },
  })

  const { document } = dom.window
  await waitFor(
    () => document.getElementById('displayTotal')?.textContent === `$${scenario.quote.total.toLocaleString()}`,
    `${scenario.name}: contract did not render the quote total`,
  )

  const fields = editableFields(document)
  const summaryRows = labeledRows(document.getElementById('quoteSummary'), '.quote-row, .breakdown-item', 'quote summary')
  const generateButton = Array.from(document.querySelectorAll('button')).find(button => normalize(button.textContent) === 'Generate Contract')
  assert.ok(generateButton, 'Generate Contract button not found')
  generateButton.click()
  await waitFor(() => document.getElementById('contractPreview').style.display === 'block', `${scenario.name}: contract preview did not open`)

  const sections = sectionCapture(document)
  const dollars = dollarCapture(document, summaryRows)
  const dates = dateCapture(document, scenario.quote)
  const text = visibleText(dom.window)

  const saveButton = Array.from(document.querySelectorAll('button')).find(button => normalize(button.textContent).includes('Save to Books'))
  assert.ok(saveButton, 'Save to Books button not found')
  saveButton.click()
  await waitFor(() => saveRequests.length === 1, `${scenario.name}: save-contract request was not sent`)
  const saveRequest = saveRequests[0]
  const rawBody = JSON.parse(saveRequest.options.body)
  const saveToBooks = {
    url: saveRequest.url,
    method: saveRequest.options.method,
    headers: saveRequest.options.headers,
    fieldNames: Object.keys(rawBody),
    leadId: rawBody.leadId,
    isUnsigned: rawBody.isUnsigned,
    contractPDF: {
      present: typeof rawBody.contractPDF === 'string' && rawBody.contractPDF.length > 0,
      encoding: 'base64',
      length: rawBody.contractPDF.length,
      lengthClass: lengthClass(rawBody.contractPDF.length),
      stubbed: true,
      stubDescription: 'html2pdf was replaced with a chain-compatible stub returning 256 bytes of ASCII Q as a base64 data URI. The page extracted and sent the base64 portion through its real Save to Books handler.',
    },
  }

  assert.equal(requested.filter(url => url.includes('/rest/v1/')).length, 2)
  assert.equal(saveRequests.length, 1)
  assert.deepEqual(saveToBooks.fieldNames, ['leadId', 'contractPDF', 'isUnsigned'])
  assert.equal(saveToBooks.leadId, scenario.lead.id)
  assert.equal(saveToBooks.isUnsigned, true)
  assert.equal(errors.length, 0, errors.join('\n'))
  dom.window.close()
  return JSON.parse(JSON.stringify({ sections, dollars, dates, editableFields: fields, saveToBooks, visibleText: text }))
}

async function captureAll() {
  const fixtures = await Promise.all(buildScenarios().map(async scenario => ({
    ...scenario,
    expected: await renderScenario(scenario),
  })))
  return {
    schemaVersion: 1,
    captureDate,
    fixedClock: fixedNow,
    sourceSha256: '285967e3e65212e3af276da5e5031d631b3eb56da14b457d17b5c44aa1ddc38b',
    pdfStub: 'html2pdf output is a deterministic 256-byte placeholder encoded as a base64 data URI. No PDF rendering claim is made.',
    fixtures,
  }
}

const args = process.argv.slice(2)
const update = args.includes('--update')
const fixturePathArg = args.find(arg => arg !== '--update')
const fixturePath = path.resolve(fixturePathArg || path.join(here, 'golden-fixtures.json'))

if (update) {
  const captured = await captureAll()
  await writeFile(fixturePath, `${JSON.stringify(captured, null, 2)}\n`, 'utf8')
  console.log(`Captured ${captured.fixtures.length} contract fixtures to ${fixturePath}`)
} else {
  const golden = JSON.parse(await readFile(fixturePath, 'utf8'))
  console.log('| Scenario | Result |')
  console.log('|---|---|')
  const results = await Promise.all(golden.fixtures.map(async fixture => {
    try {
      const actual = await renderScenario(fixture)
      assert.deepEqual(actual, fixture.expected)
      return { name: fixture.name, passed: true }
    } catch (error) {
      return { name: fixture.name, passed: false, error }
    }
  }))
  const failures = results.filter(result => !result.passed)
  for (const result of results) console.log(`| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} |`)
  for (const result of failures) console.error(result.error.stack || result.error)
  console.log(`\nContract baseline: ${golden.fixtures.length - failures.length}/${golden.fixtures.length} passed`)
  if (failures.length) process.exitCode = 1
}
