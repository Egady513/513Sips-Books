# Alcohol Estimator baseline report

## Result

The pinned page runs in jsdom and all 29 stored fixtures match the page on a clean verification run.

The harness:

- starts with fresh localStorage for every fixture
- fixes the clock at 2026-11-01 12:00:00 Eastern time
- restores each plain JSON input through the page's `applyFullState()` function
- runs the page's own `calculate()` and budget renderer
- uses the page's add and remove functions for action fixtures
- clicks the real Save to Books button and captures its JSON body with an in-memory `fetch` stub
- blocks external network access and stubs `window.open`, `alert`, `confirm` and `print`

The fixture set covers 25, 75, 200 and 400 guests, two, four, six and eight hours, Beer and Wine, Full Bar, cocktail-heavy and seltzer-heavy mixes, champagne toast with and without cider, one through five recipes, an additional six-recipe Evers-shaped case, NA on and off, edited prices, changed tax and contingency, automatic and manual removals and manual additions.

Verification command:

```text
node baseline-estimator/run-estimator.mjs baseline-estimator/golden-fixtures.json
```

Result: 29 PASS, 0 FAIL.

## Discrepancies and odd behavior

- The initial HTML percentages are 35 beer, 30 wine, 10 champagne, 25 cocktails, 10 seltzer and 0 Full Bar. They total 110%. Champagne and seltzer start toggled off, but their percentage fields retain 10.
- `calculate()` computes category counts from percentages even when a category toggle is off. The hidden result and purchase sections consult the toggles, but `sendToBooks()` does not. The default save therefore includes champagne and seltzer counts that were not displayed or purchased.
- Switching a category off through `toggleCategory()` sets that percentage to zero. Restoring saved state through `applyFullState()` can still create a false toggle with a nonzero percentage.
- The save field `total_bottles` contains buffered drinks, not bottles. Books labels it Total Bottles.
- `breakdown.spirits` contains Signature Cocktail drinks, not spirit bottles.
- Full Bar and NA drink counts are not included in the saved numeric breakdown.
- The saved breakdown can omit part of a valid 100% mix because Full Bar is excluded. It can also include disabled categories because toggle state is ignored.
- Category counts round independently, so their sum is not guaranteed to equal buffered drinks.
- Brand counts round independently before cases round up. Named-brand scenarios can purchase more cases than a generic category line.
- Red and white wine counts round independently before bottle conversion.
- A red or white percentage of zero falls back to 50 because the page uses `parseInt(value) || 50`. A deliberate 0/100 wine split cannot be represented by the current calculation.
- Zero guests, zero duration or zero drink rates fall back to defaults because the page uses `value || default` after parsing.
- Recipe percentages are validated visually but do not block calculation. Recipes totaling under or over 100% produce correspondingly low or high demand.
- New recipe percentages use `round(100 / count)` without rebalancing existing recipes. Adding a second recipe leaves the first at its prior percentage unless the user edits it.
- The last ingredient row in a cocktail cannot be removed. NA beverage recipes can have all ingredient rows removed.
- Ingredient classification is entirely name-based. A recognized alcohol word changes both packaging and purchaser behavior. The pinned version protects `gin` and `rum` with whole-word matching.
- Recipe champagne is keyed by its entered product name. Only the exact normalized name `champagne` merges with generic bar-service and toast champagne.
- Same-key quantities merge after each source has already rounded to a purchase unit. This can preserve source-level overbuy.
- Mixer product keys include the package tier. Removing a 32-ounce mixer line does not remove the same ingredient if later demand crosses 256 ounces and changes it to a gallon key.
- When an ingredient has both `each` and liquid demand, the page creates two budget lines for it.
- The Add item button appears under What 513Sips Brings, but a new manual item defaults to Client buys and moves to the client list after rendering.
- When every line is client-purchased, the subtotal and total rows are omitted. `collectFullState()` then stores `prepayTotal: null`, while the harness reports the visible budget total as zero.
- Prices persist by generated normalized key. Renaming a manual item or changing a mixer's package tier can make an earlier edited price stop applying.
- The reset function resets guests, duration, manual items and removed keys, then selects the Cocktail Party profile. It does not fully reset rates, toast state, recipes, NA beverages, prices, tax, contingency or purchaser choices.
- The tooltip says Beer (12-pack) equals 12 drinks, while the purchase constant and budget use 24-packs.
- The pinned page uses the legacy gold palette and Playfair Display with Inter. The current repository contract specifies copper and Cormorant Garamond with Montserrat.
- The edge function's TypeScript interface lists numeric breakdown fields but does not declare `_state`. Runtime validation accepts the object and inserts it unchanged.

These are observations only. No application or website behavior was changed.

## Assumptions

- Stored expectations represent the pinned file at the SHA-256 in `SOURCE.md`, not the current live website.
- A line's `amount`, tax, contingency and grand total are captured at the cents shown by the page. Internal category demand is captured before display hiding.
- Client-purchased lines have `unitPrice: null` and `amount: null` because the page intentionally shows a quantity checklist without prepay math for those lines.
- The Evers-named fixture follows the requested baseline shape of 200 guests and five hours. It uses the mix and recipe decisions in the supplied vault note as a cross-check. The vault's saved whole-night plan is seven hours and 1,575 buffered drinks, so this fixture is not claimed to reproduce that live saved record.
- The Evers fixture uses six recipes because the cross-check note lists six featured cocktails. Separate fixtures cover exactly one, two, three, four and five recipes.
- No customer record or database was read. The Evers vault note was the only event-specific cross-check.

## Could not determine

- The live website's current deployed hash was not checked because the task pins a source revision and prohibits network use.
- Database schema constraints, row-level security behavior and existing `alcohol_estimates` rows were not inspected.
- Browser behavior outside jsdom was not tested. Claude Code's client-facing QA gate remains required before any website change ships, though this slice changes no client-facing file.
- The intended product decision for each discrepancy was not inferred. This report records current behavior only.

## Build

Final `npm run build` tail:

```text
dist/index.html                     0.77 kB | gzip:   0.41 kB
dist/assets/index-6PV2J9y-.css     43.33 kB | gzip:   7.52 kB
dist/assets/index-D--Udift.js   1,037.76 kB | gzip: 285.28 kB

(!) Some chunks are larger than 500 kB after minification.
[PLUGIN_TIMINGS] Warning: build time was significant in rolldown:vite-resolve.

built in 6.46s
```

Build exit code: 0. The size and plugin timing warnings are pre-existing build warnings, not failures.

## Time and effort

- Start: 2026-11-01 11:19 EST
- End: 2026-11-01 11:36 EST
- Work performed: source review, page-driven harness implementation, 29-fixture generation, repeat verification, field mapping, Books readback tracing and build verification
