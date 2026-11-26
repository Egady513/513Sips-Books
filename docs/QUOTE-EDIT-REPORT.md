# Quote edit implementation report

## Outcome

Books can edit a saved single-event quote without silently replacing its price. The screen always shows the stored total, deposit and balance beside the calculation from current rules. Detail-only saves keep stored pricing and history unchanged. Price-relevant changes and explicit re-quotes require a confirmation before writing a new price.

The update path preserves status, refreshes validity to three calendar months, appends one version history entry and returns an error if Supabase does not return the updated row. Updated records retain the legacy breakdown, `_config` and typed engine snapshot needed by Books and the website calculator.

## Files added

- `src/lib/pricing/quoteEdit.ts`
- `src/lib/pricing/quoteEdit.test.ts`
- `baseline/QUOTE-EDIT-ROUNDTRIP.mjs`
- `docs/QUOTE-EDIT.md`
- `docs/QUOTE-EDIT-REPORT.md`

## Files changed

- `src/lib/pricing/index.ts`
- `src/hooks/useQuotes.ts`
- `src/pages/QuotePage.tsx`
- `src/pages/SavedQuotePage.tsx`
- `src/App.tsx`

No files outside the approved slice were changed.

## Test and verification results

### Pricing tests

`npm test` passed all 97 tests. Seven edit tests were added to the existing 90-test suite.

```text
tests 97
suites 0
pass 97
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 475.7404
```

The edit tests cover every single-event golden fixture, website-shaped records with `_config`, refusal of unsafe old records, detail persistence, guest and hour changes and status preservation. They also prove that unchanged Evers inputs keep the stored $7,131 price even though current rules return $7,206. An explicit re-quote produces the $75 increase and appends exactly one history entry.

### Production build

`npm run build` passed.

```text
2431 modules transformed.
dist/index.html                     0.77 kB | gzip:   0.42 kB
dist/assets/index-HQJefUwa.css     46.40 kB | gzip:   7.96 kB
dist/assets/index-iY7tAKAp.js   1,082.68 kB | gzip: 296.15 kB
built in 5.21s
```

Vite also printed its existing chunk-size warning. It did not fail the build.

### Scoped ESLint

The scoped command covered every changed TypeScript, TSX and JavaScript file. It passed with exit code 0 and no output.

```text
npx eslint src/lib/pricing/quoteEdit.ts src/lib/pricing/quoteEdit.test.ts src/lib/pricing/index.ts src/pages/QuotePage.tsx src/pages/SavedQuotePage.tsx src/hooks/useQuotes.ts src/App.tsx baseline/QUOTE-EDIT-ROUNDTRIP.mjs
```

### Full repository lint

`npm run lint` still reports the same eight pre-existing errors. No file containing these errors was changed for this slice.

```text
BankPage.tsx          1  no-explicit-any
DashboardPage.tsx     1  react-hooks/purity
EventDetailPage.tsx   1  no-explicit-any
EventsPage.tsx        3  no-explicit-any
LeadsPage.tsx         2  react-hooks/purity

8 problems (8 errors, 0 warnings)
```

### Offline website round trip

`baseline/QUOTE-EDIT-ROUNDTRIP.mjs` changed the guest count for 10 fixture records, applied a re-price update and opened the updated `_config` in the pinned website calculator. All 10 website totals matched the updated Books records.

```text
PASS     Evers LOW, full bar for all staff            $4,321
PASS     Evers LOW, Beer and Wine reading             $4,081
PASS     Evers HIGH, four Full Bar staff              $7,131
PASS     Evers HIGH, Full Bar for all staff           $7,206
PASS     Evers HIGH, current multi-bar checkbox       $7,456
PASS     Package Base line                            $1,395
PASS     Package Signature                            $1,520
PASS     Package Premier at 100 guests                $3,083
PASS     Package Premier at 99 guests                 $3,008
PASS     Focused package at 20 guests                 $395

10 re-priced quote edits reopened with the same calculator total.
```

No network, Supabase database or customer record was used.

## Pricing findings

No pricing behavior or engine output was changed. No new pricing mismatch was found.

## Not finished in this slice

- Multi-event editing
- PDF changes
- Live database testing
- Claude Code client-facing QA
- Vera testing

Claude Code’s QA gate and Vera’s later test pass remain required before shipping.

## Time and effort

- Start: 2026-11-01 10:49:30 EST
- End: 2026-11-01 11:11:15 EST
- Work completed: repository review, pure edit planning and update logic, golden and legacy coverage, zero-row-safe update hook, shared edit form, confirmation flow, saved-view entry point, offline website round trip, build and lint verification and documentation.
