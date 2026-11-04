import { toPageState } from './fromPageState.ts'
import type { CalculateEstimateOptions, EstimateCalculation, EstimatorState, SavePayload } from './types.ts'

/** Mirrors sendToBooks(), including its misleading `total_bottles` name. */
export function toSavePayload(
  state: EstimatorState,
  result: EstimateCalculation,
  options: CalculateEstimateOptions,
): SavePayload {
  // QUIRK: total-bottles-is-buffered-drinks.
  return {
    total_bottles: result.bufferedTotal,
    breakdown: {
      // QUIRK: save-ignores-category-toggles.
      beer: Math.round(result.bufferedTotal * (Math.trunc(state.mix.beer) / 100)),
      wine: Math.round(result.bufferedTotal * (Math.trunc(state.mix.wine) / 100)),
      champagne: Math.round(result.bufferedTotal * (Math.trunc(state.mix.champagne) / 100)),
      // QUIRK: spirits-means-signature-cocktail-drinks.
      spirits: Math.round(result.bufferedTotal * (Math.trunc(state.mix.cocktails) / 100)),
      seltzer: Math.round(result.bufferedTotal * (Math.trunc(state.mix.seltzer) / 100)),
      // QUIRK: full-bar-and-na-omitted-from-save-breakdown.
      _state: toPageState(state, result, options.savedAt),
    },
    lead_id: state.leadId,
    event_id: state.eventId,
  }
}
