export type Purchaser = 'client' | 'eddie'
export type BeerPackaging = 'bottles' | 'cans' | 'keg'
export type IngredientUnit = 'oz' | 'ml' | 'cup' | 'tbsp' | 'tsp' | 'each'

export interface CategoryToggles {
  beer: boolean
  wine: boolean
  champagne: boolean
  champagneToast: boolean
  cocktails: boolean
  seltzer: boolean
  fullBar: boolean
  procurement: boolean
  nonAlcoholic: boolean
}

export interface DrinkMix {
  beer: number
  wine: number
  champagne: number
  cocktails: number
  seltzer: number
  fullBar: number
  redWine: number
  whiteWine: number
  ciderToast: number
}

export interface BrandShare {
  id: number
  name: string
  percentage: number
  purchaser: Purchaser
}

export interface RecipeIngredient {
  name: string
  quantity: number
  unit: IngredientUnit
  /** Present for cocktail mixers. NA ingredients inherit the beverage purchaser. */
  purchaser?: Purchaser
}

export interface CocktailRecipe {
  id: number
  name: string
  percentage: number
  ingredients: RecipeIngredient[]
}

export interface NonAlcoholicBeverage {
  id: number
  name: string
  drinksPerGuest: number
  purchaser: Purchaser
  ingredients: RecipeIngredient[]
}

export interface ManualBudgetItem {
  id: number
  name: string
  quantity: number
  unit: string
  purchaser: Purchaser
}

export interface EstimatorState {
  guests: number
  durationHours: number
  drinksPerPersonFirstTwoHours: number
  drinksPerPersonAfterTwoHours: number
  mix: DrinkMix
  enabled: CategoryToggles
  beerPackaging: BeerPackaging
  beerBrands: BrandShare[]
  seltzerBrands: BrandShare[]
  fullBarLiquors: BrandShare[]
  fullBarMixers: BrandShare[]
  cocktails: CocktailRecipe[]
  nonAlcoholicBeverages: NonAlcoholicBeverage[]
  icePoundsPerGuest: number
  icePurchaser: Purchaser
  prices: Record<string, number>
  taxPercent: number
  contingencyPercent: number
  settings: Record<string, number>
  manualItems: ManualBudgetItem[]
  removedBudgetKeys: string[]
  leadId: string | null
  eventId: string | null
}

export type BudgetKind =
  | 'champagne' | 'cider' | 'wine' | 'beer-case' | 'keg' | 'seltzer-case'
  | 'spirit' | 'soda2l' | 'ice' | 'mixer-gal' | 'mixer-qt' | 'each' | 'manual'

export interface BudgetLine {
  key: string
  label: string
  quantity: number
  unit: string
  kind: BudgetKind
  purchaser: Purchaser
  unitPrice: number | null
  amount: number | null
}

export interface CategoryCounts {
  beer: number
  wine: number
  champagne: number
  cocktails: number
  seltzer: number
  fullBar: number
  nonAlcoholic: number
}

export interface DisplayRow {
  label: string
  quantity: string
}

export interface AlcoholRecipeTotal {
  name: string
  oz: number
  type: 'spirit' | 'champagne'
  purchaser: Purchaser
}

export interface MixerRecipeTotal {
  name: string
  oz: number
  each: number
  purchaser: Purchaser
}

export interface RecipeTotals {
  alcohol: Record<string, AlcoholRecipeTotal>
  mixers: Record<string, MixerRecipeTotal>
  drinksByCocktailId: Record<string, number>
}

export interface PurchaseQuantities {
  beerCases: number
  kegs: number
  redWineBottles: number
  whiteWineBottles: number
  champagneBarBottles: number
  champagneToastBottles: number
  ciderToastBottles: number
  seltzerCases: number
  nonAlcoholicBottles: number
  beerBrands: DisplayRow[]
  seltzerBrands: DisplayRow[]
  recipeAlcohol: DisplayRow[]
  recipeTotals: RecipeTotals
  recipes: DisplayRow[]
  mixers: DisplayRow[]
  champagneRollup: {
    recipeBottles: number
    barBottles: number
    toastBottles: number
    totalBottles: number
    sources: Array<{ label: string; quantity: number }>
  }
  fullBarLiquor: DisplayRow[]
  fullBarMixers: DisplayRow[]
  nonAlcoholic: DisplayRow[]
  nonAlcoholicMixers: DisplayRow[]
  iceBags: number
}

export interface PageInputs {
  guestCount: string
  duration: string
  drinksPerPersonFirst: string
  drinksPerPersonAfter: string
  pctBeer: string
  pctWine: string
  pctChampagne: string
  pctCocktails: string
  pctSeltzer: string
  pctFullBar: string
  pctRed: string
  pctWhite: string
  beerPackaging: string
  pctCiderToast: string
  iceLbsPerGuest: string
  icePurchaser: string
}

export interface PageSavedState {
  version: 2
  savedAt: string
  inputs: PageInputs
  toggles: Record<string, boolean>
  cocktails: unknown[]
  naBeverages: unknown[]
  beerBrands: unknown[]
  seltzerBrands: unknown[]
  fullBarLiquors: unknown[]
  fullBarMixers: unknown[]
  manualBudgetItems: unknown[]
  removedBudgetKeys: string[]
  prices: Record<string, number>
  settings: Record<string, number>
  prepayTotal: number | null
}

export interface SavePayload {
  total_bottles: number
  breakdown: {
    beer: number
    wine: number
    champagne: number
    spirits: number
    seltzer: number
    _state: PageSavedState
  }
  lead_id: string | null
  event_id: string | null
}

export interface EstimateCalculation {
  totalDrinks: number
  bufferedTotal: number
  categoryCounts: CategoryCounts
  purchaseQuantities: PurchaseQuantities
  budgetLines: BudgetLine[]
  subtotal: number
  taxPercent: number
  tax: number
  contingencyPercent: number
  contingency: number
  grandTotal: number
}

export interface EstimateResult extends EstimateCalculation {
  savePayload: SavePayload
}

export interface CalculateEstimateOptions {
  /** ISO timestamp used by the page-compatible saved state. */
  savedAt: string
}

export type PageStateInput = Record<string, unknown>

export interface FromPageStateOptions {
  /** Timestamp used when replaying the page's add-manual-item action. */
  nowMs?: number
}
