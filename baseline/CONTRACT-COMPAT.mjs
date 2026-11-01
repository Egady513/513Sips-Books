import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateQuote } from '../src/lib/pricing/calculateQuote.ts'
import { fromFormInputs } from '../src/lib/pricing/fromFormInputs.ts'
import { buildQuoteRecord, toFormConfig } from '../src/lib/pricing/quoteRecord.ts'

const require = createRequire(import.meta.url)
const { JSDOM, VirtualConsole } = require('jsdom')
const here = path.dirname(fileURLToPath(import.meta.url))
const fixtureDocument = JSON.parse(await readFile(path.join(here, 'golden-fixtures.json'), 'utf8'))
const contractHtml = await readFile(path.join(here, 'source/contract.html'), 'utf8')
const today = fixtureDocument.baselineDate

const fixtureNames = [
  'Evers LOW, full bar for all staff',
  'Evers HIGH, four Full Bar staff',
  'Package Signature',
  'Package Premier at 100 guests',
  'Focused package at 20 guests',
  'Multi-bar replaces volume adjustment',
  'Promo FIRST10',
  'Two-event quote',
]

function finalInput(fixture) {
  const { changes = [], ...initial } = fixture.input
  return changes.reduce((current, change) => ({ ...current, ...change }), initial)
}

function leadFor(input, eventCount = 1) {
  return {
    id: 'lead-contract-compat',
    name: 'Contract Compatibility Client',
    email: 'compat@example.invalid',
    phone: '513-555-0100',
    event_date: input.eventDateIso,
    event_type: eventCount > 1 ? 'Multi-Event Package' : 'Compatibility Event',
    guest_count: input.guestCount,
    venue_name: 'Compatibility Venue',
    venue_contact_name: 'Venue Contact',
    venue_contact_phone: '513-555-0101',
    venue_address: '100 Test Avenue, Cincinnati, OH',
    service_start_time: '18:00',
    service_end_time: '22:00',
    number_of_events: eventCount,
  }
}

function singleEventRows(fixture) {
  const input = fromFormInputs(finalInput(fixture))
  const result = calculateQuote(input, { today })
  const books = buildQuoteRecord({ leadId: 'lead-contract-compat', input, result, today })
  const website = structuredClone(books)
  delete website.breakdown.engine
  return { lead: leadFor(input), books, website }
}

function multiEventRows(fixture) {
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
  const quote = {
    id: 'quote-contract-compat',
    lead_id: 'lead-contract-compat',
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
  }
  return { lead: leadFor(first, entries.length), books: quote, website: structuredClone(quote) }
}

function response(rows) {
  return { ok: true, status: 200, json: async () => rows }
}

async function waitForRender(window, expectedTotal) {
  const target = `$${expectedTotal.toLocaleString()}`
  const deadline = Date.now() + 2000
  while (window.document.getElementById('displayTotal')?.textContent !== target) {
    if (Date.now() >= deadline) throw new Error(`Contract did not render ${target}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

function visibleText(window) {
  const document = window.document
  const walker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_TEXT)
  const chunks = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let element = node.parentElement
    let hidden = false
    while (element) {
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || element.hidden) {
        hidden = true
        break
      }
      element = element.parentElement
    }
    if (!hidden && node.textContent.trim()) chunks.push(node.textContent.trim())
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

async function renderContract(lead, quote) {
  const requested = []
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error.message))
  virtualConsole.on('error', error => errors.push(String(error)))
  const dom = new JSDOM(contractHtml, {
    url: 'https://baseline.invalid/contract.html?lead_id=lead-contract-compat&quote_id=quote-contract-compat',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = async url => {
        const value = String(url)
        requested.push(value)
        if (/\/rest\/v1\/leads\?id=eq\.lead-contract-compat&select=\*$/.test(value)) return response([lead])
        if (/\/rest\/v1\/quotes\?id=eq\.quote-contract-compat&select=\*$/.test(value)) return response([quote])
        throw new Error(`Network blocked by contract harness: ${value}`)
      }
      window.open = () => null
      window.alert = () => {}
      window.confirm = () => false
    },
  })
  await waitForRender(dom.window, quote.total)
  assert.equal(requested.length, 2, `expected two REST calls, received ${requested.length}`)
  assert.equal(errors.length, 0, errors.join('\n'))
  const text = visibleText(dom.window)
  dom.window.close()
  return text
}

let passed = 0
for (const name of fixtureNames) {
  const fixture = fixtureDocument.fixtures.find(candidate => candidate.name === name)
  assert.ok(fixture, `Fixture not found: ${name}`)
  const rows = fixture.input.events ? multiEventRows(fixture) : singleEventRows(fixture)
  const booksText = await renderContract(rows.lead, rows.books)
  const websiteText = await renderContract(rows.lead, rows.website)
  assert.equal(booksText, websiteText, `${name}: visible contract text differs`)
  for (const value of [rows.books.total, rows.books.deposit, rows.books.balance]) {
    assert.ok(booksText.includes(`$${value.toLocaleString()}`), `${name}: $${value.toLocaleString()} is missing`)
  }
  passed += 1
  console.log(`PASS ${name}`)
}

console.log(`Contract compatibility: ${passed}/${fixtureNames.length} fixtures passed`)
