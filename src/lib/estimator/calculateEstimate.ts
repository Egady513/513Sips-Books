import {
  BEER_PACK_SIZE,
  CHAMPAGNE_WORDS,
  DEFAULT_PRICES,
  DRINK_BUFFER_MULTIPLIER,
  DRINKS_PER_KEG,
  DRINKS_PER_WINE_BOTTLE,
  FIRST_RATE_HOURS,
  FULL_BAR_LIQUOR_OUNCES,
  FULL_BAR_MIXER_OUNCES,
  GALLON_OUNCES,
  ICE_BAG_POUNDS,
  MIXER_GALLON_THRESHOLD_OUNCES,
  NON_ALCOHOLIC_DRINKS_PER_2L,
  OUNCES_PER_750ML_BOTTLE,
  QUART_BOTTLE_OUNCES,
  SELTZER_PACK_SIZE,
  SPIRIT_WORDS,
  TOAST_POURS_PER_BOTTLE,
  UNIT_TO_OUNCES,
  WHOLE_WORD_SPIRITS,
  roundCurrency,
  roundDisplayOunces,
  roundDrinkCount,
  roundPurchaseUnits,
} from './rates.ts'
import { toSavePayload } from './savePayload.ts'
import type {
  AlcoholRecipeTotal,
  BrandShare,
  BudgetKind,
  BudgetLine,
  CalculateEstimateOptions,
  DisplayRow,
  EstimateCalculation,
  EstimateResult,
  EstimatorState,
  MixerRecipeTotal,
  PurchaseQuantities,
  Purchaser,
  RecipeTotals,
} from './types.ts'

interface BrandBreakdown extends BrandShare {
  drinks: number
}

interface MixerPurchase {
  quantity: number
  unit: string
  kind: 'mixer-gal' | 'mixer-qt'
}

function pageInteger(value: number, fallback: number): number {
  return Number.parseInt(String(value), 10) || fallback
}

function pageNumber(value: number, fallback: number): number {
  return Number.parseFloat(String(value)) || fallback
}

function percentage(value: number): number {
  return Number.parseInt(String(value), 10) || 0
}

function normalized(value: string): string {
  return value.toLowerCase().trim()
}

function getBrandBreakdown(brands: BrandShare[], totalDrinks: number): BrandBreakdown[] {
  if (brands.length === 0) return []
  const totalPercentage = brands.reduce((sum, brand) => sum + (Number.parseFloat(String(brand.percentage)) || 0), 0)
  if (totalPercentage !== 100) return []
  // QUIRK: brand-drinks-round-independently.
  return brands.map((brand) => ({ ...brand, name: brand.name || 'Unnamed Brand', drinks: roundDrinkCount(totalDrinks * (brand.percentage / 100)) }))
}

function classifyIngredient(name: string): 'champagne' | 'spirit' | 'mixer' {
  const value = name.toLowerCase()
  if (CHAMPAGNE_WORDS.some((word) => value.includes(word))) return 'champagne'
  const spirit = SPIRIT_WORDS.some((word) => {
    if (!(WHOLE_WORD_SPIRITS as readonly string[]).includes(word)) return value.includes(word)
    return new RegExp(`\\b${word}\\b`).test(value)
  })
  return spirit ? 'spirit' : 'mixer'
}

function toOunces(quantity: number, unit: keyof typeof UNIT_TO_OUNCES): number {
  return (Number.parseFloat(String(quantity)) || 0) * (UNIT_TO_OUNCES[unit] ?? 1)
}

function mixerPurchase(totalOunces: number): MixerPurchase {
  if (totalOunces >= MIXER_GALLON_THRESHOLD_OUNCES) {
    const quantity = roundPurchaseUnits(totalOunces / GALLON_OUNCES)
    return { quantity, unit: `1 gal jug${quantity > 1 ? 's' : ''}`, kind: 'mixer-gal' }
  }
  const quantity = roundPurchaseUnits(totalOunces / QUART_BOTTLE_OUNCES)
  return { quantity, unit: `32oz bottle${quantity > 1 ? 's' : ''}`, kind: 'mixer-qt' }
}

function recipeTotals(state: EstimatorState, cocktailDrinks: number): RecipeTotals {
  const alcohol: Record<string, AlcoholRecipeTotal> = {}
  const mixers: Record<string, MixerRecipeTotal> = {}
  const drinksByCocktailId: Record<string, number> = {}
  if (state.cocktails.length === 0 || cocktailDrinks <= 0) return { alcohol, mixers, drinksByCocktailId }
  for (const cocktail of state.cocktails) {
    // QUIRK: recipe-percentages-need-not-total-100.
    const drinks = roundDrinkCount(cocktailDrinks * (cocktail.percentage / 100))
    drinksByCocktailId[String(cocktail.id)] = drinks
    for (const ingredient of cocktail.ingredients) {
      if (!ingredient.name || !ingredient.quantity) continue
      const key = normalized(ingredient.name)
      const type = classifyIngredient(ingredient.name)
      if (type === 'mixer') {
        if (!mixers[key]) mixers[key] = { name: ingredient.name, oz: 0, each: 0, purchaser: ingredient.purchaser === 'eddie' ? 'eddie' : 'client' }
        if (ingredient.unit === 'each') mixers[key].each += ingredient.quantity * drinks
        else mixers[key].oz += toOunces(ingredient.quantity, ingredient.unit) * drinks
      } else {
        if (!alcohol[key]) alcohol[key] = { name: ingredient.name, oz: 0, type, purchaser: state.enabled.procurement ? 'eddie' : 'client' }
        alcohol[key].oz += toOunces(ingredient.quantity, ingredient.unit) * drinks
      }
    }
  }
  return { alcohol, mixers, drinksByCocktailId }
}

function nonAlcoholicMixers(state: EstimatorState, guests: number): Record<string, MixerRecipeTotal> {
  const mixers: Record<string, MixerRecipeTotal> = {}
  for (const beverage of state.nonAlcoholicBeverages) {
    const drinks = roundDrinkCount(guests * (Number.parseFloat(String(beverage.drinksPerGuest)) || 0))
    if (drinks <= 0) continue
    for (const ingredient of beverage.ingredients) {
      if (!ingredient.name || !ingredient.quantity) continue
      const key = normalized(ingredient.name)
      if (!mixers[key]) mixers[key] = { name: ingredient.name, oz: 0, each: 0, purchaser: beverage.purchaser }
      if (ingredient.unit === 'each') mixers[key].each += ingredient.quantity * drinks
      else mixers[key].oz += toOunces(ingredient.quantity, ingredient.unit) * drinks
    }
  }
  return mixers
}

function mixerDisplayRows(mixers: Record<string, MixerRecipeTotal>, naStyle = false): DisplayRow[] {
  return Object.values(mixers).map((mixer) => {
    if (mixer.each > 0 && (!naStyle || mixer.oz === 0)) return { label: mixer.name, quantity: `${roundPurchaseUnits(mixer.each)} each` }
    const purchase = mixerPurchase(mixer.oz)
    return { label: mixer.name, quantity: `${roundDisplayOunces(mixer.oz)} oz ≈ ${purchase.quantity} × ${purchase.unit}` }
  })
}

function addBudgetLine(lines: Omit<BudgetLine, 'unitPrice' | 'amount'>[], line: Omit<BudgetLine, 'unitPrice' | 'amount'>): void {
  lines.push(line)
}

function quantityFor(lines: BudgetLine[], predicate: (line: BudgetLine) => boolean): number {
  return lines.filter(predicate).reduce((sum, line) => sum + line.quantity, 0)
}

function calculate(state: EstimatorState): EstimateCalculation {
  // QUIRK: zero-core-inputs-fall-back-to-page-defaults.
  const guests = pageInteger(state.guests, 50)
  const duration = pageInteger(state.durationHours, 3)
  const drinksFirst = pageNumber(state.drinksPerPersonFirstTwoHours, 1.5)
  const drinksAfter = pageNumber(state.drinksPerPersonAfterTwoHours, 1)
  const totalDrinks = duration <= FIRST_RATE_HOURS
    ? guests * duration * drinksFirst
    : guests * FIRST_RATE_HOURS * drinksFirst + guests * (duration - FIRST_RATE_HOURS) * drinksAfter
  const bufferedTotal = roundDrinkCount(totalDrinks * DRINK_BUFFER_MULTIPLIER)

  // QUIRK: category-counts-round-independently.
  const categoryCounts = {
    beer: roundDrinkCount(bufferedTotal * (percentage(state.mix.beer) / 100)),
    wine: roundDrinkCount(bufferedTotal * (percentage(state.mix.wine) / 100)),
    champagne: roundDrinkCount(bufferedTotal * (percentage(state.mix.champagne) / 100)),
    cocktails: roundDrinkCount(bufferedTotal * (percentage(state.mix.cocktails) / 100)),
    seltzer: roundDrinkCount(bufferedTotal * (percentage(state.mix.seltzer) / 100)),
    fullBar: roundDrinkCount(bufferedTotal * (percentage(state.mix.fullBar) / 100)),
    nonAlcoholic: 0,
  }
  if (state.enabled.nonAlcoholic && state.nonAlcoholicBeverages.length > 0) {
    categoryCounts.nonAlcoholic = state.nonAlcoholicBeverages.reduce(
      (sum, beverage) => sum + roundDrinkCount(guests * (beverage.drinksPerGuest || 0)), 0,
    )
  }

  const ciderPercentage = state.enabled.champagneToast ? Math.min(100, Math.max(0, pageNumber(state.mix.ciderToast, 0))) : 0
  const champagneToastBottles = state.enabled.champagneToast
    ? roundPurchaseUnits((guests * (100 - ciderPercentage) / 100) / TOAST_POURS_PER_BOTTLE) : 0
  const ciderToastBottles = state.enabled.champagneToast && ciderPercentage > 0
    ? roundPurchaseUnits((guests * ciderPercentage / 100) / TOAST_POURS_PER_BOTTLE) : 0
  const champagneBarBottles = state.enabled.champagne && categoryCounts.champagne > 0
    ? roundPurchaseUnits(categoryCounts.champagne / DRINKS_PER_WINE_BOTTLE) : 0

  const recipes = recipeTotals(state, state.enabled.cocktails ? categoryCounts.cocktails : 0)
  const recipeChampagneBottles = Object.values(recipes.alcohol)
    .filter((item) => item.type === 'champagne')
    .reduce((sum, item) => sum + roundPurchaseUnits(item.oz / OUNCES_PER_750ML_BOTTLE), 0)
  const champagneSources = [
    recipeChampagneBottles > 0 ? { label: 'In signature cocktails', quantity: recipeChampagneBottles } : null,
    champagneBarBottles > 0 ? { label: 'Bar service', quantity: champagneBarBottles } : null,
    champagneToastBottles > 0 ? { label: 'Toast', quantity: champagneToastBottles } : null,
  ].filter((item): item is { label: string; quantity: number } => item !== null)

  const beerBreakdown = getBrandBreakdown(state.beerBrands, categoryCounts.beer)
  const seltzerBreakdown = getBrandBreakdown(state.seltzerBrands, categoryCounts.seltzer)
  const fullBarLiquorBreakdown = state.enabled.fullBar && categoryCounts.fullBar > 0
    ? getBrandBreakdown(state.fullBarLiquors, categoryCounts.fullBar) : []
  const fullBarMixerBreakdown = state.enabled.fullBar && categoryCounts.fullBar > 0
    ? getBrandBreakdown(state.fullBarMixers, categoryCounts.fullBar) : []
  const alcoholPurchaser: Purchaser = state.enabled.procurement ? 'eddie' : 'client'
  const rawLines: Omit<BudgetLine, 'unitPrice' | 'amount'>[] = []

  if (state.enabled.beer && categoryCounts.beer > 0) {
    if (state.beerPackaging === 'keg') {
      addBudgetLine(rawLines, { key: 'keg|beer', label: 'Beer \u2014 1/6 barrel keg', quantity: Math.ceil(categoryCounts.beer / DRINKS_PER_KEG), unit: 'keg(s)', kind: 'keg', purchaser: alcoholPurchaser })
    } else if (beerBreakdown.length > 0) {
      for (const brand of beerBreakdown) addBudgetLine(rawLines, { key: `beer-case|${brand.name.toLowerCase()}`, label: `Beer \u2014 ${brand.name}`, quantity: Math.ceil(brand.drinks / BEER_PACK_SIZE), unit: '24-packs', kind: 'beer-case', purchaser: alcoholPurchaser })
    } else {
      addBudgetLine(rawLines, { key: 'beer-case|beer', label: 'Beer', quantity: Math.ceil(categoryCounts.beer / BEER_PACK_SIZE), unit: '24-packs', kind: 'beer-case', purchaser: alcoholPurchaser })
    }
  }

  if (state.enabled.wine && categoryCounts.wine > 0) {
    // QUIRK: zero-wine-split-falls-back-to-50.
    const redPercentage = pageInteger(state.mix.redWine, 50)
    const whitePercentage = pageInteger(state.mix.whiteWine, 50)
    const red = roundPurchaseUnits(roundDrinkCount(categoryCounts.wine * (redPercentage / 100)) / DRINKS_PER_WINE_BOTTLE)
    const white = roundPurchaseUnits(roundDrinkCount(categoryCounts.wine * (whitePercentage / 100)) / DRINKS_PER_WINE_BOTTLE)
    if (red > 0) addBudgetLine(rawLines, { key: 'wine|red', label: 'Red Wine (750ml)', quantity: red, unit: 'bottles', kind: 'wine', purchaser: alcoholPurchaser })
    if (white > 0) addBudgetLine(rawLines, { key: 'wine|white', label: 'White Wine (750ml)', quantity: white, unit: 'bottles', kind: 'wine', purchaser: alcoholPurchaser })
  }

  for (const item of Object.values(recipes.alcohol)) {
    const bottles = roundPurchaseUnits(item.oz / OUNCES_PER_750ML_BOTTLE)
    if (bottles > 0) addBudgetLine(rawLines, { key: `${item.type === 'champagne' ? 'champagne' : 'spirit'}|${normalized(item.name)}`, label: `${item.name} (750ml)`, quantity: bottles, unit: 'bottles', kind: item.type, purchaser: alcoholPurchaser })
  }
  if (champagneBarBottles > 0) addBudgetLine(rawLines, { key: 'champagne|champagne', label: 'Champagne (750ml)', quantity: champagneBarBottles, unit: 'bottles', kind: 'champagne', purchaser: alcoholPurchaser })
  if (champagneToastBottles > 0) addBudgetLine(rawLines, { key: 'champagne|champagne', label: 'Champagne (750ml)', quantity: champagneToastBottles, unit: 'bottles', kind: 'champagne', purchaser: alcoholPurchaser })
  if (ciderToastBottles > 0) addBudgetLine(rawLines, { key: 'cider|cider', label: 'Sparkling Cider (750ml)', quantity: ciderToastBottles, unit: 'bottles', kind: 'cider', purchaser: alcoholPurchaser })

  if (state.enabled.seltzer && categoryCounts.seltzer > 0) {
    if (seltzerBreakdown.length > 0) {
      for (const brand of seltzerBreakdown) addBudgetLine(rawLines, { key: `seltzer-case|${brand.name.toLowerCase()}`, label: `Seltzer \u2014 ${brand.name}`, quantity: Math.ceil(brand.drinks / SELTZER_PACK_SIZE), unit: '12-packs', kind: 'seltzer-case', purchaser: alcoholPurchaser })
    } else addBudgetLine(rawLines, { key: 'seltzer-case|seltzer', label: 'Hard Seltzer', quantity: Math.ceil(categoryCounts.seltzer / SELTZER_PACK_SIZE), unit: '12-packs', kind: 'seltzer-case', purchaser: alcoholPurchaser })
  }

  for (const brand of fullBarLiquorBreakdown) {
    const bottles = Math.ceil((brand.drinks * FULL_BAR_LIQUOR_OUNCES) / OUNCES_PER_750ML_BOTTLE)
    if (bottles > 0) addBudgetLine(rawLines, { key: `spirit|${normalized(brand.name)}`, label: `${brand.name} (750ml)`, quantity: bottles, unit: 'bottles', kind: 'spirit', purchaser: alcoholPurchaser })
  }

  const naMixers = state.enabled.nonAlcoholic ? nonAlcoholicMixers(state, guests) : {}
  const budgetMixers: Record<string, MixerRecipeTotal> = {}
  for (const source of [recipes.mixers, naMixers]) {
    for (const [key, item] of Object.entries(source)) {
      if (!budgetMixers[key]) budgetMixers[key] = { name: item.name, oz: 0, each: 0, purchaser: item.purchaser || 'client' }
      budgetMixers[key].oz += item.oz
      budgetMixers[key].each += item.each
    }
  }
  for (const brand of fullBarMixerBreakdown) {
    const oz = brand.drinks * FULL_BAR_MIXER_OUNCES
    if (oz <= 0) continue
    const key = normalized(brand.name)
    if (!budgetMixers[key]) budgetMixers[key] = { name: brand.name, oz: 0, each: 0, purchaser: brand.purchaser || 'client' }
    budgetMixers[key].oz += oz
  }
  for (const [key, mixer] of Object.entries(budgetMixers)) {
    // QUIRK: each-and-liquid-create-two-lines.
    if (mixer.each > 0) addBudgetLine(rawLines, { key: `each|${key}`, label: mixer.name, quantity: roundPurchaseUnits(mixer.each), unit: 'each', kind: 'each', purchaser: mixer.purchaser })
    if (mixer.oz > 0) {
      const purchase = mixerPurchase(mixer.oz)
      addBudgetLine(rawLines, { key: `${purchase.kind}|${key}`, label: `${mixer.name} (${roundDisplayOunces(mixer.oz)} oz)`, quantity: purchase.quantity, unit: purchase.unit, kind: purchase.kind, purchaser: mixer.purchaser })
    }
  }

  if (state.enabled.nonAlcoholic) {
    for (const beverage of state.nonAlcoholicBeverages) {
      const hasRecipe = beverage.ingredients.some((item) => item.name && item.quantity)
      const drinks = roundDrinkCount(guests * (Number.parseFloat(String(beverage.drinksPerGuest)) || 0))
      if (!hasRecipe && drinks > 0) addBudgetLine(rawLines, { key: `soda2l|${normalized(beverage.name || 'na beverage')}`, label: `${beverage.name || 'NA Beverage'} (2L)`, quantity: Math.ceil(drinks / NON_ALCOHOLIC_DRINKS_PER_2L), unit: 'bottles', kind: 'soda2l', purchaser: beverage.purchaser })
    }
  }

  const icePounds = Number.parseFloat(String(state.icePoundsPerGuest)) || 0
  const iceBags = roundPurchaseUnits((guests * icePounds) / ICE_BAG_POUNDS)
  if (iceBags > 0) addBudgetLine(rawLines, { key: 'ice|bags', label: `Ice (${guests} guests × ${icePounds} lbs)`, quantity: iceBags, unit: '20 lb bags', kind: 'ice', purchaser: state.icePurchaser })

  // QUIRK: merge-after-source-level-rounding.
  const merged = new Map<string, Omit<BudgetLine, 'unitPrice' | 'amount'>>()
  for (const line of rawLines) {
    const prior = merged.get(line.key)
    if (prior) prior.quantity += line.quantity
    else merged.set(line.key, { ...line })
  }
  const removed = new Set(state.removedBudgetKeys)
  const automaticLines = [...merged.values()].filter((line) => !removed.has(line.key))
  const allLines = [
    ...automaticLines,
    ...state.manualItems.map((item): Omit<BudgetLine, 'unitPrice' | 'amount'> => ({ key: `manual|${normalized(item.name)}`, label: item.name, quantity: item.quantity, unit: item.unit, kind: 'manual', purchaser: item.purchaser })),
  ]
  const budgetLines: BudgetLine[] = allLines.map((line) => {
    if (line.purchaser === 'client') return { ...line, unitPrice: null, amount: null }
    const unitPrice = state.prices[line.key] !== undefined ? state.prices[line.key] : DEFAULT_PRICES[line.kind as BudgetKind]
    return { ...line, unitPrice, amount: unitPrice * line.quantity }
  })
  const rawSubtotal = budgetLines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
  const rawTax = rawSubtotal * state.taxPercent / 100
  const rawContingency = (rawSubtotal + rawTax) * state.contingencyPercent / 100
  const rawGrandTotal = rawSubtotal + rawTax + rawContingency

  const combinedNaMixers: Record<string, MixerRecipeTotal> = {}
  for (const source of [recipes.mixers, nonAlcoholicMixers(state, guests)]) {
    for (const [key, item] of Object.entries(source)) {
      if (!combinedNaMixers[key]) combinedNaMixers[key] = { name: item.name, oz: 0, each: 0, purchaser: item.purchaser }
      combinedNaMixers[key].oz += item.oz
      combinedNaMixers[key].each += item.each
    }
  }
  const purchaseQuantities: PurchaseQuantities = {
    beerCases: quantityFor(budgetLines, (line) => line.kind === 'beer-case'),
    kegs: quantityFor(budgetLines, (line) => line.kind === 'keg'),
    redWineBottles: quantityFor(budgetLines, (line) => line.key === 'wine|red'),
    whiteWineBottles: quantityFor(budgetLines, (line) => line.key === 'wine|white'),
    champagneBarBottles,
    champagneToastBottles,
    ciderToastBottles,
    seltzerCases: quantityFor(budgetLines, (line) => line.kind === 'seltzer-case'),
    nonAlcoholicBottles: quantityFor(budgetLines, (line) => line.kind === 'soda2l'),
    beerBrands: state.enabled.beer && categoryCounts.beer > 0 ? beerBreakdown.map((brand) => ({ label: `${brand.name} (${brand.percentage}%)`, quantity: `${Math.ceil(brand.drinks / BEER_PACK_SIZE)} cases` })) : [],
    seltzerBrands: state.enabled.seltzer && categoryCounts.seltzer > 0 ? seltzerBreakdown.map((brand) => ({ label: `${brand.name} (${brand.percentage}%)`, quantity: `${Math.ceil(brand.drinks / SELTZER_PACK_SIZE)} cases` })) : [],
    recipeAlcohol: state.enabled.cocktails && categoryCounts.cocktails > 0 ? Object.values(recipes.alcohol).map((item) => ({ label: `${item.name} (750ml)`, quantity: `${roundPurchaseUnits(item.oz / OUNCES_PER_750ML_BOTTLE)} bottles · ${roundDisplayOunces(item.oz)} oz` })) : [],
    recipeTotals: recipes,
    recipes: state.enabled.cocktails && categoryCounts.cocktails > 0 ? state.cocktails.map((item) => ({ label: `🍸 ${item.name || 'Unnamed'} (${item.percentage}%)`, quantity: `~${recipes.drinksByCocktailId[String(item.id)] || 0} drinks` })) : [],
    mixers: state.enabled.cocktails && categoryCounts.cocktails > 0 ? mixerDisplayRows(recipes.mixers) : [],
    champagneRollup: { recipeBottles: recipeChampagneBottles, barBottles: champagneBarBottles, toastBottles: champagneToastBottles, totalBottles: recipeChampagneBottles + champagneBarBottles + champagneToastBottles, sources: champagneSources },
    fullBarLiquor: fullBarLiquorBreakdown.map((brand) => ({ label: `🥃 ${brand.name} (${brand.percentage}%) ${alcoholPurchaser === 'eddie' ? '513Sips' : 'Client'}`, quantity: `${Math.ceil((brand.drinks * FULL_BAR_LIQUOR_OUNCES) / OUNCES_PER_750ML_BOTTLE)} bottles (750ml)` })),
    fullBarMixers: fullBarMixerBreakdown.map((brand) => { const purchase = mixerPurchase(brand.drinks * FULL_BAR_MIXER_OUNCES); return { label: `🥤 ${brand.name} (${brand.percentage}%) ${brand.purchaser === 'eddie' ? '513Sips' : 'Client'}`, quantity: `${purchase.quantity} × ${purchase.unit}` } }),
    nonAlcoholic: state.enabled.nonAlcoholic && categoryCounts.nonAlcoholic > 0 ? state.nonAlcoholicBeverages.map((item) => ({ label: `🥤 ${item.name || 'Unnamed'}`, quantity: `~${roundDrinkCount(guests * (item.drinksPerGuest || 0))} drinks (${item.drinksPerGuest}/guest)` })) : [],
    nonAlcoholicMixers: state.enabled.nonAlcoholic && categoryCounts.nonAlcoholic > 0 ? mixerDisplayRows(combinedNaMixers, true) : [],
    iceBags: quantityFor(budgetLines, (line) => line.key === 'ice|bags'),
  }

  return {
    totalDrinks,
    bufferedTotal,
    categoryCounts,
    purchaseQuantities,
    budgetLines,
    subtotal: roundCurrency(rawSubtotal),
    taxPercent: state.taxPercent,
    tax: roundCurrency(rawTax),
    contingencyPercent: state.contingencyPercent,
    contingency: roundCurrency(rawContingency),
    grandTotal: roundCurrency(rawGrandTotal),
  }
}

/** Pure, page-compatible alcohol estimate calculation. */
export function calculateEstimate(state: EstimatorState, options: CalculateEstimateOptions): EstimateResult {
  const result = calculate(state)
  return { ...result, savePayload: toSavePayload(state, result, options) }
}
