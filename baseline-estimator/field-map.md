# Alcohol Estimator field map

Line references are to `source/alcohol-estimator.html`.

## Static event and mix inputs

| ID or key | Label | Type | Default | Min | Max | Notes |
|---|---|---:|---:|---:|---:|---|
| `guestCount` | Number of Guests | number | 50 | 1 | 500 | Lines 324 to 327. Parsed as an integer. A blank or zero value falls back to 50 in `calculate()` at line 1490. |
| `duration` | Event Duration (hours) | number | 3 | 1 | 12 | Lines 329 to 332. Parsed as an integer. A blank or zero value falls back to 3 at line 1491. |
| `drinksPerPersonFirst` | Drinks Per Person Per Hour (First 2 Hours) | number, step 0.1 | 1.5 | 0.5 | 5 | Lines 334 to 337. |
| `drinksPerPersonAfter` | Drinks Per Person Per Hour (After 2 Hours) | number, step 0.1 | 1.0 | 0.5 | 5 | Lines 339 to 342. |
| `enableProcurement` | Alcohol Procurement Service active | checkbox | false | n/a | n/a | Lines 344 to 350. Controls the purchaser of every alcohol line through `defaultAlcoholPurchaser()` at lines 773 to 776. |
| profile | Quick Select Profile | button | `cocktail` button appears active | n/a | n/a | `setProfile()` at lines 1433 to 1456 applies the profile constants and category toggles. |
| `enableBeer` | Beer | checkbox | true | n/a | n/a | Lines 373 to 377. |
| `pctBeer` | Beer percentage | number | 35 | 0 | 100 | Lines 373 to 378. Parsed as an integer. |
| `beerPackaging` | Packaging | select | `cans` | n/a | n/a | Values are `bottles`, `cans` and `keg`. Lines 380 to 386. Bottles and cans both use 24-packs in the purchase math. |
| `enableWine` | Wine | checkbox | true | n/a | n/a | Lines 399 to 403. |
| `pctWine` | Wine percentage | number | 30 | 0 | 100 | Lines 399 to 404. Parsed as an integer. |
| `pctRed` | Red Wine % | number | 50 | 0 | 100 | Lines 406 to 409. A blank or zero value falls back to 50 at lines 1638 and 1935. |
| `pctWhite` | White Wine % | number | 50 | 0 | 100 | Lines 410 to 413. A blank or zero value falls back to 50 at lines 1639 and 1936. |
| `enableChampagne` | Champagne Bar Service | checkbox | false | n/a | n/a | Lines 417 to 423. This category is inside the 100% mix. |
| `pctChampagne` | Champagne percentage | number | 10 | 0 | 100 | Lines 418 to 423. Parsed as an integer. |
| `enableChampagneToast` | Include Toast | checkbox | false | n/a | n/a | Lines 428 to 433. The toast is additive and outside the mix. |
| `pctCiderToast` | Percent toasting with sparkling cider | number | 15 | 0 | 100 | Lines 434 to 437. `calculate()` clamps it to 0 through 100 at line 1553. |
| `enableCocktails` | Signature Cocktails | checkbox | true | n/a | n/a | Lines 441 to 445. |
| `pctCocktails` | Signature Cocktail percentage | number | 25 | 0 | 100 | Lines 441 to 446. Parsed as an integer. |
| `enableSeltzer` | Hard Seltzers | checkbox | false | n/a | n/a | Lines 461 to 465. |
| `pctSeltzer` | Hard Seltzer percentage | number | 10 | 0 | 100 | Lines 461 to 466. Parsed as an integer. |
| `enableFullBar` | Full Bar Service | checkbox | false | n/a | n/a | Lines 479 to 483. |
| `pctFullBar` | Full Bar percentage | number | 0 | 0 | 100 | Lines 479 to 484. Parsed as an integer. This value is not included in the save payload breakdown. |
| `enableNA` | Non-Alcoholic Beverages | checkbox | false | n/a | n/a | Lines 508 to 513. NA demand is outside the 100% alcoholic mix. |
| `iceLbsPerGuest` | Ice, lbs per guest | number, step 0.25 | 1.5 | 0 | none | Lines 718 to 725. |
| `icePurchaser` | Ice purchaser | select | `client` | n/a | n/a | Values are `client` and `eddie`. Lines 722 to 725. |

HTML min and max attributes constrain browser controls but `calculate()` does not clamp most values. The harness assigns the saved state through `applyFullState()` at lines 2277 to 2312, just as a restored estimate does.

## Repeating user-managed inputs

| State path | Label or meaning | Type | Default or creation behavior | Min | Max | Source |
|---|---|---|---|---:|---:|---|
| `beerBrands[].name` | Beer brand | text | empty | n/a | n/a | `addBrand()` lines 804 to 810 and `renderBrands()` lines 835 to 861. |
| `beerBrands[].percentage` | Share of beer drinks | number | 0 | 0 | 100 | Percentages must equal exactly 100 or the named breakdown is ignored. `getBrandBreakdown()` lines 1115 to 1127. |
| `seltzerBrands[].name` | Seltzer brand | text | empty | n/a | n/a | Same brand functions as beer. |
| `seltzerBrands[].percentage` | Share of seltzer drinks | number | 0 | 0 | 100 | Must total exactly 100. |
| `fullBarLiquors[].name` | Full Bar liquor | text | empty | n/a | n/a | Created by `addBrand()`. |
| `fullBarLiquors[].percentage` | Share of Full Bar drinks | number | 0 | 0 | 100 | Must total exactly 100. |
| `fullBarMixers[].name` | Full Bar mixer | text | empty | n/a | n/a | Created by `addBrand()`. |
| `fullBarMixers[].percentage` | Share of Full Bar drinks | number | 0 | 0 | 100 | Independent of the liquor percentages and must total exactly 100. |
| `fullBarMixers[].purchaser` | Who buys this mixer | select | `client` | n/a | n/a | Values are `client` and `eddie`. Lines 828 to 833. |
| `cocktails[].name` | Cocktail name | text | empty | n/a | n/a | `addCocktail()` lines 883 to 893. |
| `cocktails[].pct` | Share of signature cocktail drinks | number | `round(100 / new count)` | 0 | 100 | UI at lines 1016 to 1019. Existing recipe percentages are not rebalanced when another recipe is added. |
| `cocktails[].mixers[].name` | Ingredient | text | empty | n/a | n/a | Lines 1025 to 1030. Ingredient name determines alcohol classification. |
| `cocktails[].mixers[].qty` | Quantity per drink | number | empty | no HTML min | no HTML max | Lines 1031 to 1034. |
| `cocktails[].mixers[].unit` | Ingredient unit | select | `oz` | n/a | n/a | Values are `oz`, `ml`, `cup`, `tbsp`, `tsp` and `each`. Lines 1035 to 1043. |
| `cocktails[].mixers[].purchaser` | Who buys a mixer | select | `client` | n/a | n/a | Shown only when the name classifies as a mixer. Alcohol follows `enableProcurement`. Lines 1044 to 1047. |
| `naBeverages[].name` | NA beverage | text | empty | n/a | n/a | `addNABeverage()` lines 953 to 964. |
| `naBeverages[].drinksPerGuest` | NA drinks per guest | number, step 0.25 | 0.5 | 0 | none | Lines 1075 to 1080. |
| `naBeverages[].purchaser` | Who buys the beverage or its recipe | select | `client` | n/a | n/a | Lines 1081 to 1082. |
| `naBeverages[].mixers[].name` | NA recipe ingredient | text | empty | n/a | n/a | Lines 1083 to 1104. |
| `naBeverages[].mixers[].qty` | Quantity per NA drink | number | empty | no HTML min | no HTML max | Lines 1091 to 1094. |
| `naBeverages[].mixers[].unit` | NA ingredient unit | select | `oz` | n/a | n/a | Same six units as cocktail ingredients. |
| `manualBudgetItems[].name` | Manual budget item | text | empty | n/a | n/a | `addManualBudgetItem()` lines 1302 to 1305 and rendering at lines 1368 to 1393. |
| `manualBudgetItems[].qty` | Manual quantity | number, step 1 | 1 | 0 | none | Parsed as a float despite the step. |
| `manualBudgetItems[].unitLabel` | Manual unit label | text | `each` | n/a | n/a | Free text. |
| `manualBudgetItems[].purchaser` | Who buys the manual item | select | `client` | n/a | n/a | Values are `client` and `eddie`. |
| `prices[budget key]` | Unit price | number, step 0.01 | kind-specific | 0 | none | Auto-line control at lines 1355 to 1364. Values persist by generated key. |
| `prices[manual|normalized name]` | Manual item unit price | number, step 0.01 | 0 | 0 | none | Lines 1381 to 1391. Renaming an item changes its price key. |
| `settings.tax` | Sales tax percentage | number, step 0.1 | 7.8 | 0 | none | Lines 1413 to 1424. |
| `settings.contingency` | Contingency percentage | number, step 1 | 10 | 0 | none | Lines 1413 to 1427. |
| `removedBudgetKeys[]` | Removed generated lines | remove button | empty set | n/a | n/a | `removeBudgetItem()` lines 1296 to 1300. The key is filtered at lines 2033 to 2047. |

Brand, recipe, ingredient, beverage and manual-item rows also have add or remove buttons. `removeMixer()` will not remove the last cocktail ingredient row at lines 934 to 941. NA ingredients can all be removed at lines 987 to 994.

## Constants, ratios and classifiers

`PROFILES` at lines 753 to 757 defines Casual BBQ as 55% beer, 20% wine, 0% champagne, 10% cocktails, 15% seltzer and 0% Full Bar. Wedding is 20%, 35%, 15%, 20%, 10% and 0%. Cocktail Party is 35%, 25%, 10%, 30%, 0% and 0%.

`PURCHASERS` at line 772 maps `client` to Client and `eddie` to 513Sips. Computation constants at lines 1130 to 1140 are:

| Constant | Value | Use |
|---|---:|---|
| `DRINKS_PER_WINE_BOTTLE` | 5 | Wine and champagne bar bottles |
| `DRINKS_PER_KEG` | 55 | One sixth barrel keg |
| `BEER_PACK_SIZE` | 24 | Beer case |
| `OZ_PER_750` | 25.4 | Recipe alcohol and Full Bar liquor bottle |
| `TOAST_POURS_PER_BOTTLE` | 5 | Champagne and cider toast bottles |
| `ICE_BAG_LBS` | 20 | Ice purchase unit |
| `FULL_BAR_LIQUOR_OZ` | 1.5 | Liquor per Full Bar drink |
| `FULL_BAR_MIXER_OZ` | 4 | Mixer per Full Bar drink |
| `UNIT_TO_OZ.oz` | 1 | Recipe conversion |
| `UNIT_TO_OZ.ml` | 0.033814 | Recipe conversion |
| `UNIT_TO_OZ.cup` | 8 | Recipe conversion |
| `UNIT_TO_OZ.tbsp` | 0.5 | Recipe conversion |
| `UNIT_TO_OZ.tsp` | 0.1667 | Recipe conversion |
| `UNIT_TO_OZ.each` | 0 | Counted separately |

`classifyIngredient()` at lines 1145 to 1151 checks champagne words first, then spirit words. Champagne words are champagne, prosecco, sparkling wine, cava, brut and spumante. Spirit words are vodka, tequila, rum, gin, whiskey, whisky, bourbon, scotch, brandy, cognac, mezcal, triple sec, cointreau, curacao, liqueur, amaretto, kahlua, baileys, vermouth, aperol, campari, cello, schnapps, soju, absinthe, chambord, frangelico, midori, st germain and st-germain. Gin and rum require whole-word matches. Everything else is a mixer.

The total drink formula is in `calculate()` at lines 1489 to 1502. Hours one and two use `guests * duration * firstRate`. Later hours use `guests * 2 * firstRate + guests * (duration - 2) * afterRate`. The buffer is 12.5%, applied as `round(total * 1.125)`.

## Rounding rules

- Category drink counts use `Math.round(bufferedDrinks * percentage / 100)` at lines 1534 to 1539. Toggled-off categories still have a computed count if their percentage is nonzero.
- NA beverage counts use `Math.round(guests * drinksPerGuest)` per beverage, then add the rounded values at lines 1541 to 1547.
- Toast demand splits guests by cider percentage first. Each side independently uses `Math.ceil(pours / 5)` at lines 1553 to 1555.
- Named brand drink counts use `Math.round(categoryDrinks * brand percentage / 100)` at lines 1122 to 1127. Each beer brand then rounds up independently to a 24-pack. Each seltzer brand rounds up independently to a 12-pack.
- Red and white wine drinks round independently, then each bottle count rounds up after division by 5 at lines 1641 to 1645.
- Each recipe's drink count uses its percentage and `Math.round()` at lines 1170 to 1174. Recipe percentages are validated but calculation is not blocked when they do not total 100.
- Recipe alcohol ounces aggregate by normalized ingredient name. Bottles use `Math.ceil(ounces / 25.4)` at lines 1943 to 1955.
- Full Bar liquor brand drinks round first through `getBrandBreakdown()`. Each brand's bottles then use `Math.ceil(drinks * 1.5 / 25.4)` at lines 1970 to 1977.
- Mixer ounces merge by normalized name before package conversion at lines 1980 to 2012. At 256 ounces or more, quantity is `ceil(ounces / 128)` one-gallon jugs. Below 256 ounces, quantity is `ceil(ounces / 32)` 32-ounce bottles. `mixerPurchase()` is at lines 1158 to 1166.
- `each` ingredients use `Math.ceil(each total)` at lines 2003 to 2007.
- Ready-to-serve NA beverages use `Math.ceil(beverage drinks / 8)` two-liter bottles at lines 2014 to 2022.
- Ice uses `Math.ceil(guests * pounds per guest / 20)` at lines 2025 to 2031.
- Same-key budget lines merge after their source quantities have already rounded. Their quantities are added at lines 2033 to 2045.
- `money()` rounds to cents for display at line 1268. Tax is `subtotal * taxPct / 100`. Contingency is `(subtotal + tax) * contingencyPct / 100`. Grand total is subtotal plus tax plus contingency at lines 1413 to 1430.

## Default prices

`defaultPrice()` at lines 1243 to 1261 supplies the unit prices below. `priceFor()` at lines 1263 to 1266 uses an edited local price when one exists.

| Kind | Default | Purchase unit |
|---|---:|---|
| `champagne` | $9.00 | 750ml bottle |
| `cider` | $4.00 | 750ml bottle |
| `wine` | $9.00 | 750ml bottle |
| `beer-case` | $23.00 | 24-pack |
| `keg` | $90.00 | one sixth barrel |
| `seltzer-case` | $15.00 | 12-pack |
| `spirit` | $22.00 | 750ml bottle |
| `soda2l` | $2.50 | 2L bottle |
| `ice` | $6.00 | 20 lb bag |
| `mixer-gal` | $4.50 | one-gallon jug |
| `mixer-qt` | $4.00 | 32-ounce bottle |
| `each` | $0.50 | each |
| `manual` | $0.00 | user label |
| fallback | $5.00 | unknown kind |

## Budget line order and formulas

`calculate()` builds auto lines in this order, then `renderBudget()` shows client-purchased lines and 513Sips-purchased lines in that same order. Manual lines follow all auto lines.

| Order | Line source | Formula and source |
|---:|---|---|
| 1 | Beer | Keg: `ceil(beerDrinks / 55)`. Named brand or generic case: `ceil(brandDrinks / 24)`. Lines 1920 to 1932 in `calculate()`. |
| 2 | Red Wine | `ceil(round(wineDrinks * redPct / 100) / 5)`. Lines 1934 to 1940. |
| 3 | White Wine | `ceil(round(wineDrinks * whitePct / 100) / 5)`. Lines 1934 to 1940. |
| 4 | Recipe alcohol | One line per normalized ingredient in first-seen order. `ceil(total ounces / 25.4)`. Lines 1943 to 1955 and `computeRecipeTotals()` lines 1177 to 1203. |
| 5 | Champagne bar service | `ceil(champagneDrinks / 5)`. Added to key `champagne|champagne`. Lines 1665 to 1674 and 1956 to 1958. |
| 6 | Champagne toast | `ceil(champagne toast guests / 5)`. Uses the same champagne key, so it merges with bar-service champagne. Lines 1549 to 1555 and 1956 to 1958. |
| 7 | Sparkling cider toast | `ceil(cider toast guests / 5)`. Lines 1549 to 1555 and 1959. |
| 8 | Hard seltzer | Named brand or generic quantity is `ceil(drinks / 12)`. Lines 1961 to 1967. |
| 9 | Full Bar liquor | Per brand, `ceil(round(fullBarDrinks * percentage / 100) * 1.5 / 25.4)`. Lines 1970 to 1977. Same-name spirits can merge with recipe spirits. |
| 10 | Mixers and count ingredients | Cocktail, NA and Full Bar mixer demand merges by normalized name before packaging. `each` lines come before ounce lines for the same ingredient. Lines 1980 to 2012. |
| 11 | Ready-to-serve NA beverage | `ceil(round(guests * drinksPerGuest) / 8)` two-liter bottles. Lines 2014 to 2022. |
| 12 | Ice | `ceil(guests * pounds per guest / 20)` bags. Lines 2025 to 2031. |
| 13 | Manual items | User quantity times the price stored under the normalized manual name. `renderBudget()` lines 1368 to 1393. |

Only lines whose purchaser is `eddie` enter the Client Prepay Budget subtotal. `renderBudget()` multiplies quantity by unit price at lines 1345 to 1366 and 1368 to 1393. It then appends subtotal, sales tax, contingency and reimbursement total at lines 1408 to 1430.

## Local storage

| Key | Contents | Source |
|---|---|---|
| `sips513_prices` | JSON object from generated product key to edited unit price | `PRICE_KEY` and price helpers at lines 1227 to 1239. |
| `sips513_budget_settings` | JSON object with `tax`, `contingency` and `iceLbs` when edited | `SETTINGS_KEY` and setting helpers at lines 1228 to 1241 and 1275 to 1294. Only `iceLbs` is applied on initial page load at lines 2243 to 2246. |
| `sips513_estimate_<event id>` or `sips513_estimate_default` | Full `_state` object from the last successful save | `estimateStorageKey()` and save mirror at lines 2314 and 2381 to 2383. |
| `513sips_last_estimate_id` | ID returned by the save function | Lines 2378 to 2380. |

The harness starts with a fresh localStorage for every fixture. It then loads fixture prices and settings through `applyFullState()`.

## Save shape and Books readback

`sendToBooks()` at lines 2343 to 2383 emits:

```text
{
  total_bottles: bufferedDrinks,
  breakdown: {
    beer: round(bufferedDrinks * pctBeer / 100),
    wine: round(bufferedDrinks * pctWine / 100),
    champagne: round(bufferedDrinks * pctChampagne / 100),
    spirits: round(bufferedDrinks * pctCocktails / 100),
    seltzer: round(bufferedDrinks * pctSeltzer / 100),
    _state: collectFullState()
  },
  lead_id,
  event_id
}
```

Despite its name, `total_bottles` is the buffered drink count. `breakdown.spirits` is the Signature Cocktail drink count, not a bottle count. Full Bar and NA counts are absent from the numeric breakdown. Toggle state is not consulted when those five saved counts are calculated.

`collectFullState()` at lines 2252 to 2275 saves version 2, timestamp, all listed static inputs, all toggles, all repeating arrays, manual items, removed keys, prices, settings and the reimbursement total parsed from the rendered budget. It does not save the computed shopping lines themselves.

The edge function validates only that `total_bottles` is a number and `breakdown` is an object. It inserts `lead_id`, `event_id`, `total_bottles` and the full `breakdown` object into `alcohol_estimates`.

Books uses `useAlcoholEstimatesByEvent()` to select the newest row for the event by `created_at`. `EventDetailPage.tsx` displays `estimate.total_bottles`, then every positive numeric property in `breakdown`. The `_state` object is filtered out because it is not numeric. The public estimator reads `breakdown._state` from the newest server row when permitted, otherwise it falls back to the device copy. That restore path is at lines 2316 to 2341.
