# Typed pricing engine notes

## Run it

```powershell
npm test
```

The Windows-compatible script expands `src/lib/pricing/*.test.ts`. Node 24.13 on
Windows treats `node --test src/lib/pricing/` as one module path and fails to
discover the test file.

The pricing API is exported from `src/lib/pricing/index.ts`. Call
`calculateQuote(input, { today: 'YYYY-MM-DD' })` for one event or
`calculateMultiEventQuote(events, { today: 'YYYY-MM-DD' })` for a package. The
caller supplies the date, so the engine has no clock or database dependency.

## Page behavior reproduced on purpose

| Page behavior | Engine behavior |
|---|---|
| Base pricing changes from three included hours to two for Small Group events. A standard two-hour event keeps the standard base then receives a separate negative line. | The engine preserves the base and reduction as separate ordered lines. |
| The hour-five premium is added to Extended Service Hours instead of rendered as its own line. | The engine returns one combined line and leaves the blended line without a misleading unit price. |
| Full Bar Service applies only to assigned Full Bar staff, capped at total bartenders. | The result stores both bartender counts explicitly. |
| Signature and house cocktail charges are separate. The program tier is based on their combined count. | All three counts are stored. Consumers do not need to infer cocktail counts by dividing dollars. |
| The multi-bar fee replaces the guest volume adjustment. | Only one of those lines can appear. |
| Procurement, coffee, arch, logo ice and tent charges appear as one Premium Add-Ons line in that order. | The label and amount preserve the page order. |
| Formal glassware rounds `count × $3.50` to whole dollars. Travel rounds only after excess one-way miles are doubled and multiplied by $0.67. | Each line uses the same rounding point as the page. |
| A predefined percent promo rounds against the subtotal. A custom percent discount then rounds against the subtotal after the promo. | Discounts remain order-dependent and are also returned as explicit values. |
| A normal deposit is half the total rounded to whole dollars. Events fewer than 14 days away require the full total. | Payment terms store the percentage, short-notice flag and due-date rule. |
| A multi-event package sums event totals then recalculates one deposit using the earliest nonblank event date. | It does not sum the event-level deposits. |
| Quote validity is three calendar months from the supplied current date. | JavaScript calendar-month rollover behavior is preserved. |
| Plastic glassware sets an at-cost state on the page but adds no priced line. | It adds no line or dollars. The typed input still retains the selection. |

## Items that look like bugs or need an owner decision

These are listed only. Pricing behavior was not changed.

- Evers HIGH is $7,131 with four Full Bar staff. It is $7,206 with all five staff because current rules add the $75 hour-five premium.
- The source comment says 250 or more guests need custom procurement pricing, but the tier table charges $400 at exactly 250 and switches to custom at 251.
- Small Group mode can still calculate more than 20 guests if a value is restored or assigned after the UI toggle.
- An event exactly 14 days away receives normal terms. Any past event receives short-notice terms.
- A blank event date receives normal terms because there is no date to trigger short notice.
- Percent and fixed discounts are not capped at the subtotal, so a sufficiently large discount can produce a negative total and deposit.
- `parseInt` truncates fractional distance and other numeric form values before pricing.
- A Full Bar staff value of zero falls back to all bartenders because the page uses `parsedValue || bartenders`.
- Three-month quote validity follows JavaScript date overflow. For example, adding three months to January 31 can land in May.
- Multi-event payment ignores blank event dates when choosing the earliest date.
