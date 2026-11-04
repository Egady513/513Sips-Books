# Estimator engine notes

The engine in `src/lib/estimator/` reproduces the pinned website Alcohol Estimator, including its oddities, so a later change is a deliberate decision by Eddie and one line in the code. No oddity was fixed.

## Run the checks

```text
npm test
node baseline-estimator/run-estimator.mjs baseline-estimator/golden-fixtures.json
```

The second command needs jsdom installed outside the repository. Set `NODE_PATH` to the folder that contains it, for example `<folder that contains jsdom>/node_modules`.

## Quirks reproduced on purpose

Each one is tagged `QUIRK: <name>` in the code. The descriptions of the page behavior are in `REPORT.md` in this folder.

| Tag | Where | Page behavior kept |
|---|---|---|
| `default-mix-110` | `rates.ts` | The default drink mix percentages add up to 110. |
| `total-bottles-is-buffered-drinks` | `savePayload.ts` | `total_bottles` in the saved row holds buffered drinks, not bottles. |
| `save-ignores-category-toggles` | `savePayload.ts` | The saved counts include categories that are switched off. |
| `spirits-means-signature-cocktail-drinks` | `savePayload.ts` | `breakdown.spirits` holds signature cocktail drinks. |
| `full-bar-and-na-omitted-from-save-breakdown` | `savePayload.ts` | Full Bar and non-alcoholic drinks are not in the saved numeric breakdown. |
| `category-counts-round-independently` | `calculateEstimate.ts` | Category counts round one by one, so they may not add up to the buffered total. |
| `brand-drinks-round-independently` | `calculateEstimate.ts` | Brand counts round before they become cases, which can buy extra cases. |
| `zero-wine-split-falls-back-to-50` | `calculateEstimate.ts` | A red or white share of 0 becomes 50. |
| `zero-core-inputs-fall-back-to-page-defaults` | `calculateEstimate.ts` | Zero guests, hours or rates fall back to defaults. |
| `recipe-percentages-need-not-total-100` | `calculateEstimate.ts` | Recipes that add up to less or more than 100 change demand to match. |
| `each-and-liquid-create-two-lines` | `calculateEstimate.ts` | An ingredient with both unit and liquid demand gets two budget lines. |
| `merge-after-source-level-rounding` | `calculateEstimate.ts` | Quantities from different sources merge after each has already rounded up. |
| `mixer-package-at-256` | `rates.ts` | A mixer switches from a bottle line to a gallon line at 256 ounces. |
| `name-based-ingredient-classification` | `rates.ts` | Whether an ingredient counts as alcohol depends on words in its name. |

Page oddities that live only in the browser screen (the reset button, the 12-pack tooltip, the Add item button's list) are not part of the calculation and are not in this engine.
