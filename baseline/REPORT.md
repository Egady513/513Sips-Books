# Calculator baseline report

The harness executes the pinned page in jsdom, drives its real form and calls
the page's own `calculate()` function. Network access, `window.open` and dialogs
are disabled. The clock is fixed at 2026-10-31 so payment fixtures remain
repeatable. No database or customer record was read.

`node baseline/run-calculator.mjs baseline/golden-fixtures.json` passes all 40
stored fixtures.

## Results and discrepancies

- Evers LOW is $4,321 when all four bartenders receive Full Bar coverage. The
  Beer and Wine reading is $4,081. Its only missing line is $240 of Full Bar
  Service.
- Evers HIGH is $7,206 under the closest straightforward reading: all five
  bartenders receive Full Bar coverage and the rented station remains the
  recorded $1,000 custom item. That is $75 above the $7,131 record because
  today's page adds a $75 hour-five long-event premium.
- Evers HIGH also totals $7,131 if only four of five bartenders receive Full Bar
  coverage. This numerical match does not prove equivalent pricing. The new
  $75 long-event premium and the omitted fifth $75 Full Bar assignment cancel
  each other.
- Selecting today's multi-bar checkbox as well as the recorded rented-station
  custom item makes Evers HIGH $7,456. The checkbox replaces the old $250
  volume adjustment with a $500 operations fee. Combined with the $75
  long-event premium, this is $325 above the record.
- The package targets reproduce exactly: Signature $1,445, Premier at 100
  guests $3,008 and Premier at 99 guests $2,908. "Base $650" is interpreted as
  the base line item. The full configured Base scenario totals $1,320 after
  staffing, extended hours, Full Bar Service and volume adjustment.
- Procurement is $175 through 99 guests, $275 through 150, $350 through 199
  and $400 through 250. At 251 the page adds no fee and sets
  `procurementCustom: true`.
- The payment fixtures use 2026-11-10 for short notice and 2026-11-21 for normal
  terms. Against the fixed 2026-10-31 clock, they produce full payment and a
  50% deposit respectively.
- The regression fixture changes guests from 200 to 100 after setting 516
  formal glasses. The page keeps 516 glasses and the $1,806 glassware line.
  The total changes only by the $75 volume-tier difference.

## Assumptions and unknowns

- The Evers notes do not identify package type or Full Bar staff count. Both
  Beer and Wine and Full Bar readings were tested. Full Bar coverage counts
  relevant to the target were retained as separate fixtures.
- The two rented bars in the historical Evers note are represented by the
  recorded `Second Service Station` custom item. It is unknown whether today's
  separate multi-bar operations checkbox should also apply. Both readings are
  stored.
- Jordan's requested 115-guest case uses otherwise default inputs because the
  brief provides no duration, package or add-ons for that boundary check.
- The two-event fixture uses one default 50-guest event plus the reproduced
  $1,445 Signature scenario. No historical two-event target was provided.
- The supplied notes explain that the calculator changed after the Evers quote,
  but the pinned files alone cannot prove the original saved input state.

## Build

`npm run build` was run once. It failed before compilation because this
worktree has no `node_modules/.bin/tsc.cmd`. Per the brief, no dependency install
was attempted.

```text
> books@0.0.0 build
> tsc -b && vite build

'tsc' is not recognized as an internal or external command,
operable program or batch file.
```

## Time and effort

- Start: 2026-10-31 13:56 EDT
- End: 2026-10-31 14:06 EDT
- Main steps: repository review, source hashing, calculator mapping, safe jsdom
  harness construction, fixture capture, deterministic replay, persistence
  mapping and final build attempt.

