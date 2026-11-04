# PDF and contract compatibility report

## Result

Books-saved and website-shaped quote rows produce identical PDF HTML and identical visible contract text in every covered fixture. No missing field, label change or ordering difference was found. No pricing or quote-record change is proposed.

## Original capture method

I captured the goldens before replacing the component implementation. `baseline/pdf-golden/CAPTURE-ORIGINAL.mjs` reads `HEAD:src/pages/LeadsPage.tsx` with `git show`, extracts the original nested `handleDownloadQuotePDF` function, injects the fixed baseline date and returns its HTML instead of opening a window. It then builds synthetic saved rows from `baseline/golden-fixtures.json` and writes 13 HTML files.

The resulting tests compare the new pure builder against those files byte for byte. This keeps the baseline tied to the original code path instead of accepting output produced only by the refactored module.

## Files

- `src/lib/quotePdf.ts`: pure `buildQuotePdfHtml({ lead, quote, today })` extraction
- `src/lib/quotePdf.test.ts`: 39 PDF compatibility tests across 13 fixtures
- `src/pages/LeadsPage.tsx`: imports the pure builder, opens the result and writes it to the print window
- `package.json`: includes `src/lib/*.test.ts` in `npm test`
- `baseline/pdf-golden/`: capture script plus 13 original-path HTML goldens
- `baseline/CONTRACT-COMPAT.mjs`: offline jsdom contract comparison across 8 fixtures
- `docs/PDF-CONTRACT-COMPAT.md`: runbook, scope and exclusions
- `docs/PDF-CONTRACT-REPORT.md`: implementation and verification evidence

## Test counts

- Full Node suite: 129 tests passed
- New PDF tests: 39 passed
- PDF golden fixtures: 13 passed
- PDF Books-versus-website comparisons: 13 passed
- PDF value and quantity checks: 13 passed
- Contract compatibility fixtures: 8 of 8 passed

## Differences found

None between the Books and website record shapes.

The existing PDF itemizes custom add-ons. For the Evers HIGH fixture it prints `$1,000.00` and `$250.00` instead of the calculator summary's aggregate `$1,250.00`. Both record shapes behave the same, every saved custom-item amount appears and the captured output confirms this is existing behavior.

## Verification evidence

`npm test` tail:

```text
ℹ tests 129
ℹ suites 0
ℹ pass 129
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 814.6426
```

`npm run build` tail:

```text
dist/assets/index-D6mnSF4A.js   1,072.54 kB │ gzip: 293.83 kB
✓ built in 5.58s
```

The existing Vite large-chunk warning remains. The build exited 0.

Scoped lint command:

```powershell
npx eslint src/lib/quotePdf.ts src/lib/quotePdf.test.ts src/pages/LeadsPage.tsx baseline/pdf-golden/CAPTURE-ORIGINAL.mjs baseline/CONTRACT-COMPAT.mjs
```

It exited 0 with no output. The Date clock reads cited in the brief were inside the builder that moved and now use the injected `today` value as required. I made no unrelated edit to the remaining quote-expiry `Date.now()` call in `LeadsPage.tsx`.

Contract harness tail:

```text
PASS Multi-bar replaces volume adjustment
PASS Promo FIRST10
PASS Two-event quote
Contract compatibility: 8/8 fixtures passed
```

## Not finished

Live browser printing, contract signing, contract saving and real database access were intentionally not run. Claude Code's client-facing QA gate and Vera's later test pass remain external review steps.

## Time and effort

- Wall-clock start: 2026-11-01 10:59 EST
- Wall-clock end: 2026-11-01 11:10 EST
- Elapsed: about 11 minutes

