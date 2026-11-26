#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { runCalculator } from './run-calculator.mjs'
import {
  buildQuoteRecord,
  buildQuoteUpdate,
  calculateQuote,
  fromFormInputs,
  planQuoteChange,
} from '../src/lib/pricing/index.ts'

const TODAY = '2026-10-31'
const fixtureDocument = JSON.parse(await fs.readFile(new URL('./golden-fixtures.json', import.meta.url), 'utf8'))
const fixtures = fixtureDocument.fixtures.filter((fixture) => !fixture.input.events).slice(0, 10)

function finalInput(input) {
  const { changes = [], ...initial } = input
  return changes.reduce((current, change) => ({ ...current, ...change }), initial)
}

console.log(`${'Result'.padEnd(8)} ${'Fixture'.padEnd(44)} Updated total`)
console.log(`${'-'.repeat(8)} ${'-'.repeat(44)} ${'-'.repeat(13)}`)
for (const fixture of fixtures) {
  const originalInput = fromFormInputs(finalInput(fixture.input))
  const originalResult = calculateQuote(originalInput, { today: TODAY })
  const row = buildQuoteRecord({ leadId: 'offline-edit-roundtrip', input: originalInput, result: originalResult, today: TODAY })
  const editedInput = { ...originalInput, guestCount: originalInput.guestCount + 1 }
  const editedResult = calculateQuote(editedInput, { today: TODAY })
  const plan = planQuoteChange({ row, newInput: editedInput, today: TODAY })
  assert.equal(plan.kind, 'reprice', `${fixture.name} should require re-pricing`)
  const update = buildQuoteUpdate({ row, plan, input: editedInput, result: editedResult, today: TODAY, reason: 'edit' })
  const updatedBreakdown = update.breakdown
  assert.ok(updatedBreakdown && typeof updatedBreakdown === 'object' && '_config' in updatedBreakdown)
  const pageResult = await runCalculator(updatedBreakdown._config)
  assert.equal(pageResult.total, update.total, `${fixture.name} updated total`)
  console.log(`${'PASS'.padEnd(8)} ${fixture.name.padEnd(44)} $${pageResult.total.toLocaleString()}`)
}

console.log(`\n${fixtures.length} re-priced quote edits reopened with the same calculator total.`)
