# Books sign-in build report

## Result

Slice 3a is implemented with the sign-in requirement off by default. When `VITE_REQUIRE_LOGIN` is missing, empty or anything other than `true`, the gate returns the existing app immediately for loading, signed-in and signed-out states.

The Settings Account card remains available while the requirement is off so Eddie can test his Supabase user before requiring sign-in.

## Files added

- `src/lib/auth/allowList.ts`
- `src/lib/auth/allowList.test.ts`
- `src/lib/auth/gate.ts`
- `src/lib/auth/gate.test.ts`
- `src/lib/auth/authContext.ts`
- `src/lib/auth/AuthProvider.tsx`
- `src/lib/auth/config.ts`
- `src/lib/auth/useAuth.ts`
- `src/components/auth/AuthGate.tsx`
- `src/components/auth/SignInForm.tsx`
- `docs/SIGN-IN.md`
- `docs/SIGN-IN-REPORT.md`

## Files changed

- `src/App.tsx`: added the provider and in-place gate around the existing routes
- `src/components/layout/Header.tsx`: added signed-in email and sign-out control
- `src/pages/SettingsPage.tsx`: added the Account card
- `.github/workflows/deploy.yml`: added only the two requested build environment variables
- `package.json`: added the auth test glob while preserving the pricing test glob

No Supabase client, query, database rule, RLS file or pricing file was changed. No login route was added.

## Verification

### Tests

`npm test` passed 62 of 62 tests: 14 auth tests and 48 existing pricing tests.

Real output tail:

```text
ℹ tests 62
ℹ suites 0
ℹ pass 62
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 817.2975
```

The auth tests cover the default, empty and whitespace allow lists, normalization, two addresses, case-insensitive matching and every requested gate state. The switch-off path is tested for all three auth statuses and always returns `show-app`.

### Production build

`npm run build` passed with exit code 0.

Real output tail:

```text
dist/index.html                     0.77 kB │ gzip:   0.42 kB
dist/assets/index-YP5Wb5IP.css     43.59 kB │ gzip:   7.56 kB
dist/assets/index-cGLU2WuN.js   1,042.59 kB │ gzip: 286.71 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 7.46s
```

The size warning already applies to the app bundle and did not fail the build.

### Lint

`npx eslint src/lib/auth src/components/auth` passed with exit code 0 and no output.

`npm run lint` was also run. It returned exit code 1 with the 11 known errors in older files outside this slice. No full-lint error points to a file changed for sign-in.

Real output tail:

```text
C:\Users\eddie.gady\Code\books-signin\src\pages\LeadsPage.tsx
  647:83  error  Error: Cannot call impure function during render  react-hooks/purity
  701:82  error  Error: Cannot call impure function during render  react-hooks/purity

✖ 11 problems (11 errors, 0 warnings)
```

`git diff --check` passed with no output.

### Switch-off behavior

I checked the switch-off behavior through the pure gate tests and code path, then built the production app. `requireBooksLogin` is true only when `VITE_REQUIRE_LOGIN === 'true'`. `decideGate` returns `show-app` before checking session status whenever that value is false. The gate therefore does not replace the existing routes with loading or sign-in UI while the switch is off.

## Not finished or not checked

- I did not perform a real sign-in because Eddie must create the Supabase user and keep the password private.
- I did not test a deployed GitHub Pages build or repository variable change.
- I did not run the Claude Code client-facing QA gate. Theo must review the diff and run that gate before shipping.
- This does not protect data at the database layer. RLS and database rule changes remain a later step.

## Time and effort

- Wall-clock start: 2026-11-01 10:36:00 -05:00
- Wall-clock end: 2026-11-01 10:41:09 -05:00
- Elapsed wall time: 5 minutes 9 seconds
