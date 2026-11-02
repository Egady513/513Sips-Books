import { DEFAULT_CONTINGENCY_PERCENT, DEFAULT_TAX_PERCENT, PAGE_DEFAULTS } from './rates.ts'
import type {
  BrandShare,
  CocktailRecipe,
  EstimateCalculation,
  EstimatorState,
  FromPageStateOptions,
  IngredientUnit,
  ManualBudgetItem,
  NonAlcoholicBeverage,
  PageSavedState,
  PageStateInput,
  Purchaser,
  RecipeIngredient,
} from './types.ts'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pageNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number.parseFloat(String(value))
  return Number.isNaN(parsed) ? fallback : parsed
}

function text(value: unknown, fallback = ''): string {
  return value === undefined || value === null ? fallback : String(value)
}

function purchaser(value: unknown): Purchaser {
  return value === 'eddie' ? 'eddie' : 'client'
}

function ingredient(value: unknown, addDefaultPurchaser: boolean): RecipeIngredient {
  const item = record(value)
  const unit = ['oz', 'ml', 'cup', 'tbsp', 'tsp', 'each'].includes(String(item.unit))
    ? item.unit as IngredientUnit
    : 'oz'
  const result: RecipeIngredient = {
    name: text(item.name),
    quantity: pageNumber(item.qty, 0),
    unit,
  }
  if (item.purchaser !== undefined || addDefaultPurchaser) result.purchaser = purchaser(item.purchaser)
  return result
}

function cocktailRows(value: unknown): CocktailRecipe[] {
  const saved = array(value).map(record)
  const evenBase = saved.length > 0 ? Math.floor(100 / saved.length) : 0
  let evenRemainder = saved.length > 0 ? 100 - evenBase * saved.length : 0
  return saved.map((item) => {
    const fallbackPercentage = evenBase + (evenRemainder > 0 ? 1 : 0)
    if (evenRemainder > 0) evenRemainder -= 1
    const hasPercentage = item.pct !== undefined && item.pct !== null && item.pct !== ''
    return {
      id: pageNumber(item.id, 0),
      name: text(item.name),
      percentage: pageNumber(item.pct, hasPercentage ? 0 : fallbackPercentage),
      ingredients: array(item.mixers).map((entry) => ingredient(entry, true)),
    }
  })
}

function beverageRows(value: unknown): NonAlcoholicBeverage[] {
  return array(value).map((entry) => {
    const item = record(entry)
    return {
      id: pageNumber(item.id, 0),
      name: text(item.name),
      drinksPerGuest: pageNumber(item.drinksPerGuest, 0),
      purchaser: purchaser(item.purchaser),
      ingredients: array(item.mixers).map((entry) => ingredient(entry, false)),
    }
  })
}

function brandRows(value: unknown): BrandShare[] {
  return array(value).map((entry) => {
    const item = record(entry)
    return {
      id: pageNumber(item.id, 0),
      name: text(item.name),
      percentage: pageNumber(item.percentage, 0),
      purchaser: purchaser(item.purchaser),
    }
  })
}

function manualRows(value: unknown): ManualBudgetItem[] {
  return array(value).map((entry) => {
    const item = record(entry)
    return {
      id: pageNumber(item.id, 0),
      name: text(item.name),
      quantity: pageNumber(item.qty, 0),
      unit: text(item.unitLabel),
      purchaser: purchaser(item.purchaser),
    }
  })
}

function numericRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(record(value)).map(([key, item]) => [key, pageNumber(item, 0)]))
}

function applyActions(state: EstimatorState, value: unknown, nowMs: number): void {
  for (const entry of array(value)) {
    const action = record(entry)
    if (action.type === 'removeBudgetItem') {
      state.removedBudgetKeys.push(text(action.key))
    } else if (action.type === 'removeManualBudgetItem') {
      const id = action.id === undefined ? null : pageNumber(action.id, 0)
      const name = action.name === undefined ? null : text(action.name)
      const match = state.manualItems.find((item) => id !== null ? item.id === id : item.name === name)
      if (match) state.manualItems = state.manualItems.filter((item) => item.id !== match.id)
    } else if (action.type === 'addManualBudgetItem') {
      const item = record(action.item)
      const added: ManualBudgetItem = {
        id: nowMs,
        name: text(item.name),
        quantity: pageNumber(item.qty, 1),
        unit: text(item.unitLabel, 'each'),
        purchaser: purchaser(item.purchaser),
      }
      state.manualItems.push(added)
      if (item.unitPrice !== undefined) state.prices[`manual|${added.name.toLowerCase().trim()}`] = pageNumber(item.unitPrice, 0)
    } else if (action.type === 'editPrice') {
      state.prices[text(action.key)] = pageNumber(action.value, 0)
    } else if (action.type === 'editTax') {
      state.settings.tax = pageNumber(action.value, 0)
      state.taxPercent = state.settings.tax
    } else if (action.type === 'editContingency') {
      state.settings.contingency = pageNumber(action.value, 0)
      state.contingencyPercent = state.settings.contingency
    }
  }
}

/** Converts collectFullState-compatible JSON, including baseline harness actions, to typed state. */
export function fromPageState(input: PageStateInput = {}, options: FromPageStateOptions = {}): EstimatorState {
  const inputs = record(input.inputs)
  const toggles = record(input.toggles)
  const settings = numericRecord(input.settings)
  const state: EstimatorState = {
    guests: pageNumber(inputs.guestCount, PAGE_DEFAULTS.guests),
    durationHours: pageNumber(inputs.duration, PAGE_DEFAULTS.durationHours),
    drinksPerPersonFirstTwoHours: pageNumber(inputs.drinksPerPersonFirst, PAGE_DEFAULTS.drinksFirst),
    drinksPerPersonAfterTwoHours: pageNumber(inputs.drinksPerPersonAfter, PAGE_DEFAULTS.drinksAfter),
    mix: {
      beer: pageNumber(inputs.pctBeer, PAGE_DEFAULTS.mix.beer),
      wine: pageNumber(inputs.pctWine, PAGE_DEFAULTS.mix.wine),
      champagne: pageNumber(inputs.pctChampagne, PAGE_DEFAULTS.mix.champagne),
      cocktails: pageNumber(inputs.pctCocktails, PAGE_DEFAULTS.mix.cocktails),
      seltzer: pageNumber(inputs.pctSeltzer, PAGE_DEFAULTS.mix.seltzer),
      fullBar: pageNumber(inputs.pctFullBar, PAGE_DEFAULTS.mix.fullBar),
      redWine: pageNumber(inputs.pctRed, PAGE_DEFAULTS.mix.redWine),
      whiteWine: pageNumber(inputs.pctWhite, PAGE_DEFAULTS.mix.whiteWine),
      ciderToast: pageNumber(inputs.pctCiderToast, PAGE_DEFAULTS.mix.ciderToast),
    },
    enabled: {
      beer: toggles.enableBeer === undefined ? PAGE_DEFAULTS.enabled.beer : Boolean(toggles.enableBeer),
      wine: toggles.enableWine === undefined ? PAGE_DEFAULTS.enabled.wine : Boolean(toggles.enableWine),
      champagne: toggles.enableChampagne === undefined ? PAGE_DEFAULTS.enabled.champagne : Boolean(toggles.enableChampagne),
      champagneToast: toggles.enableChampagneToast === undefined ? PAGE_DEFAULTS.enabled.champagneToast : Boolean(toggles.enableChampagneToast),
      cocktails: toggles.enableCocktails === undefined ? PAGE_DEFAULTS.enabled.cocktails : Boolean(toggles.enableCocktails),
      seltzer: toggles.enableSeltzer === undefined ? PAGE_DEFAULTS.enabled.seltzer : Boolean(toggles.enableSeltzer),
      fullBar: toggles.enableFullBar === undefined ? PAGE_DEFAULTS.enabled.fullBar : Boolean(toggles.enableFullBar),
      procurement: toggles.enableProcurement === undefined ? PAGE_DEFAULTS.enabled.procurement : Boolean(toggles.enableProcurement),
      nonAlcoholic: toggles.enableNA === undefined ? PAGE_DEFAULTS.enabled.nonAlcoholic : Boolean(toggles.enableNA),
    },
    beerPackaging: ['bottles', 'keg'].includes(String(inputs.beerPackaging)) ? inputs.beerPackaging as 'bottles' | 'keg' : 'cans',
    beerBrands: brandRows(input.beerBrands),
    seltzerBrands: brandRows(input.seltzerBrands),
    fullBarLiquors: brandRows(input.fullBarLiquors),
    fullBarMixers: brandRows(input.fullBarMixers),
    cocktails: cocktailRows(input.cocktails),
    nonAlcoholicBeverages: beverageRows(input.naBeverages),
    icePoundsPerGuest: pageNumber(inputs.iceLbsPerGuest, PAGE_DEFAULTS.icePoundsPerGuest),
    icePurchaser: purchaser(inputs.icePurchaser),
    prices: numericRecord(input.prices),
    taxPercent: settings.tax === undefined ? DEFAULT_TAX_PERCENT : settings.tax,
    contingencyPercent: settings.contingency === undefined ? DEFAULT_CONTINGENCY_PERCENT : settings.contingency,
    settings,
    manualItems: manualRows(input.manualBudgetItems),
    removedBudgetKeys: array(input.removedBudgetKeys).map(String),
    leadId: input.leadId === undefined ? null : text(input.leadId) || null,
    eventId: input.eventId === undefined ? null : text(input.eventId) || null,
  }
  applyActions(state, input.actions, options.nowMs ?? 0)
  return state
}

function pageIngredient(item: RecipeIngredient): UnknownRecord {
  const result: UnknownRecord = { name: item.name, qty: item.quantity, unit: item.unit }
  if (item.purchaser !== undefined) result.purchaser = item.purchaser
  return result
}

/** Recreates the page's version 2 `_state` object so the pinned website can reopen it. */
export function toPageState(
  state: EstimatorState,
  result: EstimateCalculation,
  savedAt: string,
): PageSavedState {
  return {
    version: 2,
    savedAt,
    inputs: {
      guestCount: String(state.guests), duration: String(state.durationHours),
      drinksPerPersonFirst: String(state.drinksPerPersonFirstTwoHours),
      // The HTML default is the literal "1.0", and collectFullState preserves that formatting.
      drinksPerPersonAfter: state.drinksPerPersonAfterTwoHours === 1 ? '1.0' : String(state.drinksPerPersonAfterTwoHours),
      pctBeer: String(state.mix.beer), pctWine: String(state.mix.wine),
      pctChampagne: String(state.mix.champagne), pctCocktails: String(state.mix.cocktails),
      pctSeltzer: String(state.mix.seltzer), pctFullBar: String(state.mix.fullBar),
      pctRed: String(state.mix.redWine), pctWhite: String(state.mix.whiteWine),
      beerPackaging: state.beerPackaging, pctCiderToast: String(state.mix.ciderToast),
      iceLbsPerGuest: String(state.icePoundsPerGuest), icePurchaser: state.icePurchaser,
    },
    toggles: {
      enableBeer: state.enabled.beer, enableWine: state.enabled.wine,
      enableChampagne: state.enabled.champagne, enableChampagneToast: state.enabled.champagneToast,
      enableCocktails: state.enabled.cocktails, enableSeltzer: state.enabled.seltzer,
      enableFullBar: state.enabled.fullBar, enableProcurement: state.enabled.procurement,
      enableNA: state.enabled.nonAlcoholic,
    },
    cocktails: state.cocktails.map((item) => ({ id: item.id, name: item.name, pct: item.percentage, mixers: item.ingredients.map(pageIngredient) })),
    naBeverages: state.nonAlcoholicBeverages.map((item) => ({ id: item.id, name: item.name, drinksPerGuest: item.drinksPerGuest, purchaser: item.purchaser, mixers: item.ingredients.map(pageIngredient) })),
    beerBrands: state.beerBrands.map((item) => ({ id: item.id, name: item.name, percentage: item.percentage, purchaser: item.purchaser })),
    seltzerBrands: state.seltzerBrands.map((item) => ({ id: item.id, name: item.name, percentage: item.percentage, purchaser: item.purchaser })),
    fullBarLiquors: state.fullBarLiquors.map((item) => ({ id: item.id, name: item.name, percentage: item.percentage, purchaser: item.purchaser })),
    fullBarMixers: state.fullBarMixers.map((item) => ({ id: item.id, name: item.name, percentage: item.percentage, purchaser: item.purchaser })),
    manualBudgetItems: state.manualItems.map((item) => ({ id: item.id, name: item.name, qty: item.quantity, unitLabel: item.unit, purchaser: item.purchaser })),
    removedBudgetKeys: [...state.removedBudgetKeys],
    prices: { ...state.prices },
    settings: { ...state.settings },
    prepayTotal: result.subtotal === 0 ? null : result.grandTotal,
  }
}
