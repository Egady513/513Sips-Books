import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { calculateQuote } from './calculateQuote.ts'
import { fromFormInputs } from './fromFormInputs.ts'
import { buildQuoteUpdate, inputsFromSavedQuote, planQuoteChange } from './quoteEdit.ts'
import { buildQuoteRecord } from './quoteRecord.ts'

interface Fixture {
  name: string
  input: Record<string, unknown>
  expected: { breakdown?: unknown; total: number }
}

const fixtureDocument = JSON.parse(
  await readFile(new URL('../../../baseline/golden-fixtures.json', import.meta.url), 'utf8'),
) as { fixtures: Fixture[] }
const today = '2026-10-31'
const eversCurrent = fixtureDocument.fixtures.find((fixture) => fixture.name === 'Evers HIGH, Full Bar for all staff')!

function savedEversRow() {
  const input = fromFormInputs(eversCurrent.input)
  const result = calculateQuote(input, { today })
  const record = buildQuoteRecord({ leadId: 'lead-evers', input, result, today })
  return {
    ...record,
    total: 7131,
    deposit: 3566,
    balance: 3565,
    status: 'sent' as const,
  }
}

test('engine snapshots rebuild typed inputs for every single-event golden fixture record', () => {
  for (const fixture of fixtureDocument.fixtures.filter((candidate) => candidate.expected.breakdown)) {
    const input = fromFormInputs(fixture.input)
    const result = calculateQuote(input, { today })
    const row = buildQuoteRecord({ leadId: 'golden', input, result, today })
    assert.deepEqual(inputsFromSavedQuote(row), {
      input: {
        ...input,
        eventName: row.breakdown._config.eventName,
        quoteOptionName: row.breakdown._config.quoteOptionName,
        clientNotes: row.breakdown._config.clientNotes,
      },
      reason: null,
    }, fixture.name)
  }
})

test('website records rebuild inputs from legacy breakdown _config', () => {
  const input = fromFormInputs(eversCurrent.input)
  const result = calculateQuote(input, { today })
  const built = buildQuoteRecord({ leadId: 'website', input, result, today })
  const websiteRow = {
    ...built,
    breakdown: { ...built.breakdown, engine: undefined },
  }
  assert.deepEqual(inputsFromSavedQuote(websiteRow), {
    input: fromFormInputs({ ...built.breakdown._config }),
    reason: null,
  })
})

test('very old records return a reason instead of unsafe defaults', () => {
  const rebuilt = inputsFromSavedQuote({ total: 100, deposit: 50, balance: 50, breakdown: { base: 100 } })
  assert.equal(rebuilt.input, null)
  assert.match(rebuilt.reason ?? '', /does not contain the saved calculator inputs/)
})

test('unchanged Evers inputs preserve the saved price and stored record byte for byte', () => {
  const row = savedEversRow()
  const rebuilt = inputsFromSavedQuote(row)
  assert.ok(rebuilt.input)
  assert.equal(calculateQuote(rebuilt.input, { today }).total, 7206)

  const plan = planQuoteChange({ row, newInput: rebuilt.input, today })
  assert.deepEqual(plan, {
    kind: 'details-only',
    storedTotal: 7131,
    newTotal: 7206,
    storedDeposit: 3566,
    newDeposit: 3603,
    difference: 75,
    changedFields: [],
  })

  const breakdownBefore = structuredClone(row.breakdown)
  const historyBefore = structuredClone(row.version_history)
  const update = buildQuoteUpdate({ row, plan, input: rebuilt.input, result: calculateQuote(rebuilt.input, { today }), today, reason: 'edit' })
  assert.equal('total' in update, false)
  assert.equal('version_history' in update, false)
  assert.deepEqual(update.breakdown, breakdownBefore)
  assert.deepEqual(row.version_history, historyBefore)
})

test('explicit re-quote on unchanged Evers inputs adds exactly one $75 version', () => {
  const row = savedEversRow()
  const rebuilt = inputsFromSavedQuote(row)
  assert.ok(rebuilt.input)
  const result = calculateQuote(rebuilt.input, { today })
  const plan = planQuoteChange({ row, newInput: rebuilt.input, today, requote: true })
  assert.equal(plan.kind, 'reprice')
  assert.equal(plan.difference, 75)
  const update = buildQuoteUpdate({ row, plan, input: rebuilt.input, result, today, reason: 'requote' })
  const history = update.version_history as Array<Record<string, unknown>>
  assert.equal(history.length, row.version_history.length + 1)
  assert.deepEqual(history.at(-1), {
    versionNum: row.version_history.length + 1,
    total: 7206,
    deposit: 3603,
    balance: 3603,
    edited_at: '2026-10-31T00:00:00.000Z',
    reason: 'requote',
  })
  assert.equal('status' in update, false)
  assert.equal(row.status, 'sent')
})

test('guest or hour changes require a new price', () => {
  const row = savedEversRow()
  const rebuilt = inputsFromSavedQuote(row)
  assert.ok(rebuilt.input)
  assert.equal(planQuoteChange({ row, newInput: { ...rebuilt.input, guestCount: 201 }, today }).kind, 'reprice')
  assert.equal(planQuoteChange({ row, newInput: { ...rebuilt.input, serviceHours: 6 }, today }).kind, 'reprice')
})

test('option-name-only edits keep the stored price', () => {
  const row = savedEversRow()
  const rebuilt = inputsFromSavedQuote(row)
  assert.ok(rebuilt.input)
  const edited = { ...rebuilt.input, quoteOptionName: 'High service option' }
  const plan = planQuoteChange({ row, newInput: edited, today })
  assert.equal(plan.kind, 'details-only')
  assert.deepEqual(plan.changedFields, ['quoteOptionName'])
  const result = calculateQuote(edited, { today })
  const update = buildQuoteUpdate({ row, plan, input: edited, result, today, reason: 'edit' })
  const updatedRow = { ...row, ...update }
  assert.equal(inputsFromSavedQuote(updatedRow).input?.quoteOptionName, 'High service option')
  assert.deepEqual(
    (update.breakdown as typeof row.breakdown).engine,
    row.breakdown.engine,
    'detail saves must not replace the stored pricing snapshot',
  )
})

const eversLow = fixtureDocument.fixtures.find((fixture) => fixture.name === 'Evers LOW, full bar for all staff')!

// An older website save: the stored _config has no fullBarStaffCount. The website restores it
// from the bartender count, so a rebuilt quote must price the same way.
function legacyRowWithoutFullBarStaffCount(fixture: Fixture, total: number) {
  const input = fromFormInputs(fixture.input)
  const result = calculateQuote(input, { today })
  const built = buildQuoteRecord({ leadId: 'website-legacy', input, result, today })
  const { fullBarStaffCount: _omitted, ...config } = built.breakdown._config
  void _omitted
  return {
    ...built,
    total,
    deposit: Math.round(total / 2),
    balance: total - Math.round(total / 2),
    breakdown: { ...built.breakdown, engine: undefined, _config: config },
  }
}

test('legacy _config with Full Bar and no fullBarStaffCount covers every bartender', () => {
  const row = legacyRowWithoutFullBarStaffCount(eversLow, 4321)
  assert.equal('fullBarStaffCount' in row.breakdown._config, false)
  const rebuilt = inputsFromSavedQuote(row)
  assert.ok(rebuilt.input)
  assert.equal(rebuilt.input.packageType, 'fullbar')
  assert.equal(rebuilt.input.serviceHours, 4)
  assert.equal(rebuilt.input.bartenderCount, 4)
  assert.equal(rebuilt.input.fullBarStaffCount, 4)
  const result = calculateQuote(rebuilt.input, { today })
  const fullBarLine = result.lines.find((line) => line.label.startsWith('Full Bar Service'))
  assert.equal(fullBarLine?.label, 'Full Bar Service (4 hrs × 4 bartenders)')
  assert.equal(fullBarLine?.amount, 240)
})

test('Evers LOW shape stored without fullBarStaffCount reprices to $4,321 with no difference', () => {
  const row = legacyRowWithoutFullBarStaffCount(eversLow, 4321)
  const rebuilt = inputsFromSavedQuote(row)
  assert.ok(rebuilt.input)
  assert.equal(calculateQuote(rebuilt.input, { today }).total, 4321)
  const plan = planQuoteChange({ row, newInput: rebuilt.input, today })
  assert.equal(plan.newTotal, 4321)
  assert.equal(plan.difference, 0)
  assert.deepEqual(plan.changedFields, [])
})

test('an explicit fullBarStaffCount of 2 with 4 bartenders stays 2', () => {
  const input = fromFormInputs({ ...eversLow.input, bartenderCount: 4, fullBarStaffCount: '2' })
  const result = calculateQuote(input, { today })
  const row = buildQuoteRecord({ leadId: 'website-explicit', input, result, today })
  const websiteRow = { ...row, breakdown: { ...row.breakdown, engine: undefined } }
  const rebuilt = inputsFromSavedQuote(websiteRow)
  assert.ok(rebuilt.input)
  assert.equal(rebuilt.input.fullBarStaffCount, 2)
  const fullBarLine = calculateQuote(rebuilt.input, { today }).lines.find((line) => line.label.startsWith('Full Bar Service'))
  assert.equal(fullBarLine?.label, 'Full Bar Service (4 hrs × 2 bartenders)')
  assert.equal(fullBarLine?.amount, 120)
})
