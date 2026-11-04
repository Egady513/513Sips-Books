import type { BudgetKind, IngredientUnit } from './types.ts'

// Pinned page lines 1495-1502.
export const FIRST_RATE_HOURS = 2
export const DRINK_BUFFER_MULTIPLIER = 1.125

// Pinned page lines 1130-1138.
export const DRINKS_PER_WINE_BOTTLE = 5
export const DRINKS_PER_KEG = 55
export const BEER_PACK_SIZE = 24
export const SELTZER_PACK_SIZE = 12
export const OUNCES_PER_750ML_BOTTLE = 25.4
export const TOAST_POURS_PER_BOTTLE = 5
export const ICE_BAG_POUNDS = 20
export const FULL_BAR_LIQUOR_OUNCES = 1.5
export const FULL_BAR_MIXER_OUNCES = 4
export const UNIT_TO_OUNCES: Readonly<Record<IngredientUnit, number>> = {
  oz: 1,
  ml: 0.033814,
  cup: 8,
  tbsp: 0.5,
  tsp: 0.1667,
  each: 0,
}

// Pinned page lines 1158-1165. QUIRK: mixer-package-at-256.
export const MIXER_GALLON_THRESHOLD_OUNCES = 256
export const GALLON_OUNCES = 128
export const QUART_BOTTLE_OUNCES = 32

// Pinned page line 2020.
export const NON_ALCOHOLIC_DRINKS_PER_2L = 8

// Pinned page lines 1139-1149. QUIRK: name-based-ingredient-classification.
export const CHAMPAGNE_WORDS = ['champagne', 'prosecco', 'sparkling wine', 'cava', 'brut', 'spumante'] as const
export const SPIRIT_WORDS = [
  'vodka', 'tequila', 'rum', 'gin', 'whiskey', 'whisky', 'bourbon', 'scotch', 'brandy',
  'cognac', 'mezcal', 'triple sec', 'cointreau', 'curacao', 'liqueur', 'amaretto',
  'kahlua', 'baileys', 'vermouth', 'aperol', 'campari', 'cello', 'schnapps', 'soju',
  'absinthe', 'chambord', 'frangelico', 'midori', 'st germain', 'st-germain',
] as const
export const WHOLE_WORD_SPIRITS = ['gin', 'rum'] as const

// Pinned page lines 1243-1260.
export const DEFAULT_PRICES: Readonly<Record<BudgetKind, number>> = {
  champagne: 9,
  cider: 4,
  wine: 9,
  'beer-case': 23,
  keg: 90,
  'seltzer-case': 15,
  spirit: 22,
  soda2l: 2.5,
  ice: 6,
  'mixer-gal': 4.5,
  'mixer-qt': 4,
  each: 0.5,
  manual: 0,
}

// Pinned page lines 1413-1418.
export const DEFAULT_TAX_PERCENT = 7.8
export const DEFAULT_CONTINGENCY_PERCENT = 10

// Pinned page lines 1502, 1534-1539, 1122-1125, 1170-1173 and 1206-1210.
// Drink demand is rounded independently at every one of these stages.
export function roundDrinkCount(value: number): number {
  return Math.round(value)
}

// Pinned page lines 1159-1165 and purchase construction at lines 1920-2030.
export function roundPurchaseUnits(value: number): number {
  return Math.ceil(value)
}

// Pinned page lines 1692-1695, 1721-1727 and 2008-2010.
export function roundDisplayOunces(value: number): number {
  return Math.round(value)
}

// Pinned page line 1268. Totals are computed at full precision, then displayed to cents.
export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

// Pinned page defaults at lines 324-484 and 718-725. QUIRK: default-mix-110.
export const PAGE_DEFAULTS = {
  guests: 50,
  durationHours: 3,
  drinksFirst: 1.5,
  drinksAfter: 1,
  mix: { beer: 35, wine: 30, champagne: 10, cocktails: 25, seltzer: 10, fullBar: 0, redWine: 50, whiteWine: 50, ciderToast: 15 },
  enabled: { beer: true, wine: true, champagne: false, champagneToast: false, cocktails: true, seltzer: false, fullBar: false, procurement: false, nonAlcoholic: false },
  beerPackaging: 'cans',
  icePoundsPerGuest: 1.5,
  icePurchaser: 'client',
} as const
