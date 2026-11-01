/// <reference types="node" />

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { calculateEstimate } from './calculateEstimate.ts'
import { fromPageState } from './fromPageState.ts'
import type { EstimateResult, PageStateInput } from './types.ts'

const SAVED_AT = '2026-11-01T16:00:00.000Z'
const NOW_MS = Date.parse(SAVED_AT)

interface Fixture {
  name: string
  input: PageStateInput
  expected: Record<string, unknown>
}

interface FixtureDocument {
  fixtures: Fixture[]
}

const fixtureDocument = JSON.parse(
  readFileSync(new URL('../../../baseline-estimator/golden-fixtures.json', import.meta.url), 'utf8'),
) as FixtureDocument

function pageComparable(result: EstimateResult): Record<string, unknown> {
  const purchases = result.purchaseQuantities
  return {
    totalDrinks: result.totalDrinks,
    bufferedDrinks: result.bufferedTotal,
    categoryDrinks: result.categoryCounts,
    purchases: {
      beerCases: purchases.beerCases,
      kegs: purchases.kegs,
      redWineBottles: purchases.redWineBottles,
      whiteWineBottles: purchases.whiteWineBottles,
      champagneBarBottles: purchases.champagneBarBottles,
      champagneToastBottles: purchases.champagneToastBottles,
      ciderToastBottles: purchases.ciderToastBottles,
      seltzerCases: purchases.seltzerCases,
      naBottles: purchases.nonAlcoholicBottles,
      beerBrands: purchases.beerBrands,
      seltzerBrands: purchases.seltzerBrands,
      recipeAlcohol: purchases.recipeAlcohol,
      recipeTotals: purchases.recipeTotals,
      recipes: purchases.recipes,
      mixers: purchases.mixers,
      champagneRollup: {
        recipeBottles: purchases.champagneRollup.recipeBottles,
        barBottles: purchases.champagneRollup.barBottles,
        toastBottles: purchases.champagneRollup.toastBottles,
        totalBottles: purchases.champagneRollup.totalBottles,
        sources: purchases.champagneRollup.sources.map(({ label, quantity }) => ({ label, qty: quantity })),
      },
      fullBarLiquor: purchases.fullBarLiquor,
      fullBarMixers: purchases.fullBarMixers,
      nonAlcoholic: purchases.nonAlcoholic,
      nonAlcoholicMixers: purchases.nonAlcoholicMixers,
      iceBags: purchases.iceBags,
    },
    budget: {
      lines: result.budgetLines.map((line) => ({
        key: line.key,
        label: line.label,
        qty: line.quantity,
        unitLabel: line.unit,
        kind: line.kind,
        purchaser: line.purchaser,
        unitPrice: line.unitPrice,
        amount: line.amount,
      })),
      subtotal: result.subtotal,
      taxPct: result.taxPercent,
      tax: result.tax,
      contingencyPct: result.contingencyPercent,
      contingency: result.contingency,
      grandTotal: result.grandTotal,
    },
    estimateData: result.savePayload,
  }
}

function estimate(input: PageStateInput): EstimateResult {
  const state = fromPageState(input, { nowMs: NOW_MS })
  return calculateEstimate(state, { savedAt: SAVED_AT })
}

for (const fixture of fixtureDocument.fixtures) {
  test(`golden fixture: ${fixture.name}`, () => {
    assert.deepEqual(pageComparable(estimate(fixture.input)), fixture.expected)
  })
}

test('rounding: buffered and category drink counts round independently', () => {
  const result = estimate({
    inputs: { guestCount: 1, duration: 1, drinksPerPersonFirst: 1, pctBeer: 50, pctWine: 50, pctChampagne: 0, pctCocktails: 0, pctSeltzer: 0 },
    toggles: { enableCocktails: false },
  })
  assert.equal(result.bufferedTotal, 1)
  assert.deepEqual({ beer: result.categoryCounts.beer, wine: result.categoryCounts.wine }, { beer: 1, wine: 1 })
})

test('rounding: red and white wine drinks round before bottles', () => {
  const result = estimate({
    inputs: { guestCount: 3, duration: 1, drinksPerPersonFirst: 1, pctBeer: 0, pctWine: 100, pctChampagne: 0, pctCocktails: 0, pctSeltzer: 0, pctRed: 50, pctWhite: 50 },
    toggles: { enableBeer: false, enableCocktails: false },
  })
  assert.equal(result.categoryCounts.wine, 3)
  assert.equal(result.purchaseQuantities.redWineBottles, 1)
  assert.equal(result.purchaseQuantities.whiteWineBottles, 1)
})

test('rounding: named brand demand rounds before case conversion', () => {
  const result = estimate({
    inputs: { guestCount: 3, duration: 1, drinksPerPersonFirst: 1, pctBeer: 100, pctWine: 0, pctChampagne: 0, pctCocktails: 0, pctSeltzer: 0 },
    toggles: { enableWine: false, enableCocktails: false },
    beerBrands: [{ id: 1, name: 'A', percentage: 50 }, { id: 2, name: 'B', percentage: 50 }],
  })
  assert.equal(result.categoryCounts.beer, 3)
  assert.equal(result.purchaseQuantities.beerCases, 2)
})

for (const [unit, quantity, expectedOunces] of [
  ['oz', 1, 1], ['ml', 1, 0.033814], ['cup', 1, 8], ['tbsp', 1, 0.5], ['tsp', 1, 0.1667],
] as const) {
  test(`unit conversion: ${unit} converts at the page rate`, () => {
    const result = estimate({
      inputs: { guestCount: 1, duration: 1, drinksPerPersonFirst: 1, pctBeer: 0, pctWine: 0, pctChampagne: 0, pctCocktails: 100, pctSeltzer: 0 },
      toggles: { enableBeer: false, enableWine: false },
      cocktails: [{ id: 1, name: 'Test', pct: 100, mixers: [{ name: 'Test Mixer', qty: quantity, unit }] }],
    })
    assert.equal(result.purchaseQuantities.recipeTotals.mixers['test mixer'].oz, expectedOunces)
  })
}

test('unit conversion: each demand rounds into its own purchase line', () => {
  const result = estimate({
    inputs: { guestCount: 1, duration: 1, drinksPerPersonFirst: 1, pctBeer: 0, pctWine: 0, pctChampagne: 0, pctCocktails: 100, pctSeltzer: 0 },
    toggles: { enableBeer: false, enableWine: false },
    cocktails: [{ id: 1, name: 'Test', pct: 100, mixers: [{ name: 'Cherry', qty: 1.25, unit: 'each' }] }],
  })
  assert.equal(result.budgetLines.find((line) => line.key === 'each|cherry')?.quantity, 2)
})

test('package boundary: 255 ounces uses 32-ounce bottles', () => {
  const result = estimate({
    inputs: { guestCount: 1, duration: 1, drinksPerPersonFirst: 1, pctBeer: 0, pctWine: 0, pctChampagne: 0, pctCocktails: 100, pctSeltzer: 0 },
    toggles: { enableBeer: false, enableWine: false },
    cocktails: [{ id: 1, name: 'Test', pct: 100, mixers: [{ name: 'Mixer', qty: 255, unit: 'oz' }] }],
  })
  assert.equal(result.budgetLines.find((line) => line.label.startsWith('Mixer'))?.kind, 'mixer-qt')
})

test('package boundary: 256 ounces switches to gallon jugs', () => {
  const result = estimate({
    inputs: { guestCount: 1, duration: 1, drinksPerPersonFirst: 1, pctBeer: 0, pctWine: 0, pctChampagne: 0, pctCocktails: 100, pctSeltzer: 0 },
    toggles: { enableBeer: false, enableWine: false },
    cocktails: [{ id: 1, name: 'Test', pct: 100, mixers: [{ name: 'Mixer', qty: 256, unit: 'oz' }] }],
  })
  assert.equal(result.budgetLines.find((line) => line.label.startsWith('Mixer'))?.kind, 'mixer-gal')
})
