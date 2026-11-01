#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { runCalculator } from './run-calculator.mjs'
import { buildQuoteRecord, calculateQuote, fromFormInputs } from '../src/lib/pricing/index.ts'

const TODAY = '2026-10-31'
const fixtureDocument = JSON.parse(await fs.readFile(new URL('./golden-fixtures.json', import.meta.url), 'utf8'))
const fixtures = fixtureDocument.fixtures.filter((fixture) => !fixture.input.events).slice(0, 10)

function finalInput(input) {
  const { changes = [], ...initial } = input
  return changes.reduce((current, change) => ({ ...current, ...change }), initial)
}

console.log(`${'Result'.padEnd(8)} ${'Fixture'.padEnd(44)} Total`)
console.log(`${'-'.repeat(8)} ${'-'.repeat(44)} ${'-'.repeat(10)}`)
for (const fixture of fixtures) {
  const input = fromFormInputs(finalInput(fixture.input))
  const result = calculateQuote(input, { today: TODAY })
  const record = buildQuoteRecord({ leadId: 'offline-roundtrip', input, result, today: TODAY })
  const pageResult = await runCalculator(record.breakdown._config)
  assert.equal(pageResult.total, result.total, `${fixture.name} total`)
  console.log(`${'PASS'.padEnd(8)} ${fixture.name.padEnd(44)} $${pageResult.total.toLocaleString()}`)
}

console.log(`\n${fixtures.length} quote records reopened with the same calculator total.`)
