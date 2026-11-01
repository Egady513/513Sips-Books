# Estimator engine report

## Who did what

Codex built the engine, its adapters and its tests through `dispatch.py`, then stopped when its usage limit was reached (about 11 minutes into the run, with no final report). Claude finished the leftovers: this report, `ENGINE-NOTES.md` (from the `QUIRK:` tags Codex left in the code) and a line-ending fix to the harness. Claude did not change the engine code.

## Files

- `src/lib/estimator/`: `types.ts`, `rates.ts`, `calculateEstimate.ts`, `savePayload.ts`, `fromPageState.ts` (with the reverse `toPageState`), `index.ts`, `calculateEstimate.test.ts`
- `package.json`: the `test` script also runs the estimator tests
- `baseline-estimator/run-estimator.mjs`: reads the pinned page with LF line endings so it also runs on Windows checkouts (Claude)

## Checks run by Claude

- `npm test`: 88 of 88 pass, which includes all 29 golden scenarios plus rounding and unit-conversion cases.
- `npm run build`: passes.
- `npx eslint src/lib/estimator`: clean.
- Differential check written by Claude: 80 random variations of the golden scenarios (guest count, hours, drink mix, category switches) run through the real pinned page and the engine, compared on every count, purchase quantity, budget line, tax, contingency, grand total and the save payload. 0 differences, ignoring the order of keys inside the saved `_state` object.

## Not done

- No screen, saving or Books wiring (not part of this slice).
- Codex's own wall-clock figures were not recorded because it stopped before its report.
- The run was cut off by the usage limit, so Codex did not get to review its own notes.
