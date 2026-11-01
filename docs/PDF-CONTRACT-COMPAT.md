# PDF and contract compatibility

This slice verifies offline that the Books quote record shape remains compatible with the existing quote PDF and pinned website contract. It does not change pricing, the saved record builder, the website calculator or `contract.html`.

## Run the checks

Run the application tests:

```powershell
npm test
```

Run the pinned contract harness with the provided jsdom installation:

```powershell
$env:NODE_PATH='<folder that contains jsdom>/node_modules'
node baseline/CONTRACT-COMPAT.mjs
```

The PDF goldens can be regenerated from the original builder stored in the current `HEAD` commit:

```powershell
node baseline/pdf-golden/CAPTURE-ORIGINAL.mjs
```

Run the normal compile and bundle gate:

```powershell
npm run build
```

## Coverage

The PDF tests cover 12 single-event fixtures plus the pinned two-event fixture. The set includes both Evers cases, Signature, Premier, a small group, multi-bar service, a long event, a promo, travel, procurement, a cocktail program and a custom add-on.

For each fixture the tests verify:

- byte equality with HTML captured from the original `LeadsPage` builder
- equality between a Books row containing `breakdown.engine` and the website row without that key
- total, deposit, balance, validity date and displayed line amounts
- quantity labels without printed rates

The two-event row matches `saveQuoteToBooks()` in the pinned calculator. Its breakdown is an array of entries containing `name`, `total`, `guestCount`, `hours`, `bartenders`, `bd` and `_config`.

The contract harness covers 8 fixtures. It loads the unmodified pinned `contract.html` in jsdom, returns one synthetic lead and one synthetic quote from the two expected REST requests, rejects every other fetch and blocks `window.open`. It compares normalized visible text for both record shapes and checks total, deposit and balance.

The CDN `html2pdf` script is not required by the load and render path. jsdom does not load it in this harness, so no library stub is needed.

## Not covered

- browser print layout or live PDF generation
- font or CDN loading
- the contract signing and save steps
- real Supabase requests, policies or customer data
- live calculator behavior beyond the pinned fixtures
- Claude Code's client-facing QA gate

