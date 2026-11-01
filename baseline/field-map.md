# Calculator field map

Line references point to `source/calculator.html`. The pricing entry point is
`calculate()` at lines 1956-2266. `saveAndCalculate()` at lines 1747-1756 saves
the form then calls that function.

## User inputs

All ordinary form fields are also copied by `getCurrentConfig()` at lines
1460-1492 and by `saveToStorage()` at lines 1657-1690. The "Pricing reader"
column identifies the function that gives the field pricing or output meaning.

| Element id or control | Label | Type | Default | Min / max | Pricing reader |
|---|---|---|---|---|---|
| `eventName` | Event Name | text | blank, or `Event N` in multi-event mode | none | `getCurrentConfig()` 1460-1463 and multi-event labels 1572-1577 |
| `eventDate` | Event Date | date | blank | none | `calculate()` 2157 and `getPaymentAmounts()` 1946-1953 |
| `quoteOptionName` | Quote Option Name | text | blank | none | `calculate()` 1981 |
| `guestCount` | Number of Guests | number | 50 | 1 / 500 | `calculate()` 1957, 2021-2027 and `procurementFee()` 1863-1865 |
| `smallGroup` | Small Group Event | checkbox | false | not applicable | `toggleSmallGroup()` 1413-1440 and `calculate()` 1964, 1975, 2014 and 2029-2037 |
| `hours` | Service Duration | select | 3 | options 2 through 8 | `calculate()` 1958, 2014 and 2029-2055 |
| `bartenderCount` | Number of Bartenders | select | 1 | options 1 through 6 | `syncFullBarStaffOptions()` 1630-1643 and `calculate()` 1967, 2013-2043 |
| `packageType` | Package Type | select | `beerwine` | `beerwine`, `fullbar` | `toggleFullBarCoverage()` 1645-1649 and `calculate()` 2050-2055 |
| `fullBarStaffCount` | Full Bar Coverage | dynamic select | 1 | 1 through bartender count | `calculate()` 1968-1971 and 2053-2055 |
| `glassware` | Glassware Selection | select | `plastic_at_cost` | `plastic_at_cost`, `formal`, `none` | `calculate()` 2057-2063 |
| `glassCount` | Number of Glasses Needed | number | 0 | 0 / no HTML maximum | `calculate()` 1963 and 2062 |
| `distance` | One-Way Driving Distance from 2851 Minto Avenue | number | 0 | 0 / no HTML maximum | `calculate()` 1959 and 2045-2048 |
| `promoCode` | Have a Promo Code? | select | blank | listed codes only | `applyPromo()` 1758-1796 then `calculate()` 2123-2130 |
| `customPromoLabel` | Custom Discount label | text | blank | none | `applyCustomPromo()` 1798-1822 |
| `customPromoAmount` | Custom Discount amount | number | blank | 0 / no HTML maximum | `applyCustomPromo()` 1798-1822 then `calculate()` 2132-2142 |
| `customPromoType` | Custom Discount type | select | `fixed` | `fixed`, `percent` | `applyCustomPromo()` 1798-1822 then `calculate()` 2132-2142 |
| `cocktailCount` | Signature Cocktails | button-driven counter | 0 | 0 / 8 | `updateCounter()` 1612-1619 and `calculate()` 1960, 2065-2068 |
| `signatureCocktailNames` | Signature cocktail names | text | blank | none | `calculate()` 1994-1995 |
| `houseCocktailCount` | House Featured Cocktails | button-driven counter | 0 | 0 / 8 | `updateHouseCounter()` 1621-1628 and `calculate()` 1961, 2069-2075 |
| `houseCocktailNames` | House cocktail names | text | blank | none | `calculate()` 1997-1998 |
| `multiBarOperations` | Large Event & Multi-Bar Operations | checkbox | false | not applicable | `calculate()` 1972 and 2019-2027 |
| `alcoholProcurement` | Alcohol Procurement & Return Service | checkbox | false | not applicable | `calculate()` 2079-2089 |
| `coffeeService` | Coffee & Hot Chocolate Service | checkbox | false | not applicable | `calculate()` 2090-2092 |
| `archBackdrop` | Arch Backdrop (Photo Ready) | checkbox | false | not applicable | `calculate()` 2093-2095 |
| `drinkBigIce` | Custom Logo Ice by DrinkBigIce | checkbox | false | not applicable | `toggleDrinkBigIce()` 1651-1655 and `calculate()` 2096-2100 |
| `iceCount` | Logo ice cubes | number | 100 | 0 / no HTML maximum | `calculate()` 2096-2100 |
| `tentRental` | Tent Rental | checkbox | false | not applicable | `calculate()` 2102-2104 |
| dynamic custom item description | Item description | text | blank | none | `getCustomItems()` 1152-1162 and `calculate()` 2105-2113 |
| dynamic custom item price | Custom item price | number | blank | 0 / no HTML maximum | `getCustomItems()` 1152-1162 and `calculate()` 2105-2113 |
| `clientNotes` | Client-Facing Assumptions / Notes | textarea | blank | none | `calculate()` 1982, output metadata only |

The HTML definitions are at lines 713-948. Dynamic custom item controls are
created at lines 1134-1145. A selected Small Group Event caps the current guest
value at 20 but does not add a `max=20` attribute (lines 1418-1425).

## Constants, rates and tier tables

### Named pricing constants

| Name | Value | Lines | Use |
|---|---:|---|---|
| `FULL_BAR_HOURLY` | $15 | 1832-1835 | Per service hour per assigned Full Bar bartender |
| `HOUSE_COCKTAIL_RATE` | $50 | 1836 | Per House Featured cocktail |
| `COCKTAIL_PROGRAM_EXPANDED` | $250 | 1837 | Added at 5 through 7 total featured cocktails |
| `COCKTAIL_PROGRAM_EXTENSIVE` | $500 | 1838 | Added at 8 or more total featured cocktails |
| `MULTI_BAR_OPERATIONS_FEE` | $500 | 1839 | Replaces the guest volume adjustment when checked |
| `HOURLY_RATE` | $75 | 1841-1843 | Staffing, extra service hours and the 2-hour reduction |
| `LONG_EVENT_PREMIUM` | $15 | 1845-1847 | Per bartender per service hour beginning at hour 5 |
| `LONG_EVENT_PREMIUM_START_HOUR` | 5 | 1848 | First premium hour |
| `STAFF_WAGE` | $35 | 1867-1874 | Internal cost model for service hours 1 through 4, not client total |
| `STAFF_WAGE_5PLUS` | $50 | 1867-1874 | Internal cost model from hour 5, not client total |

### Procurement tiers

`PROCUREMENT_TIERS` is declared at lines 1850-1862 and read by
`procurementFee()` at lines 1863-1865.

| Guest count | Fee |
|---|---:|
| 1 through 99 | $175 |
| 100 through 150 | $275 |
| 151 through 199 | $350 |
| 200 through 250 | $400 |
| 251 and up | custom, represented by `null` |

At 251 and up, `calculate()` sets `breakdown.procurementCustom = true` and adds
no dollars (lines 2082-2088).

### Promo table

`PROMO_CODES` is declared at lines 1107-1117.

| Code | Value | Restriction |
|---|---:|---|
| `FIRST10` | 10% | none in code |
| `WEDDING2024` | 5% | none in code |
| `REFERRAL` | 5% | none in code |
| `VENDOR50` | $50 | none in code |
| `LAUNCH50` | $50 | none in code |
| `RECURRING1` | $10 | Small Group only |
| `RECURRING3` | $20 | Small Group only |
| `RECURRING6` | $35 | Small Group only |

### Literal calculation rates

| Rate or threshold | Value | Lines |
|---|---:|---|
| Standard base | $650 | 1974-1975 |
| Small Group base | $395 | 1974-1975 |
| Standard base hours | 3 | 2013-2017 |
| Small Group base hours | 2 | 2013-2017 |
| Volume adjustment, 51 through 100 guests | $175 | 2023-2024 |
| Volume adjustment, 101 and up | $250 | 2025-2026 |
| Free one-way distance | 30 miles | 2045-2048 |
| Excess mileage | $0.67 per roundtrip mile | 2045-2048 |
| Formal glassware | $3.50 each, rounded to whole dollars | 2057-2063 |
| Signature cocktail | $125 each | 2065-2068 |
| Coffee Service | $100 | 2090-2092 |
| Arch Backdrop | $350 | 2093-2095 |
| Logo ice | $2.50 per cube | 2096-2100 |
| Tent Rental | $250 | 2102-2104 |
| Normal deposit | 50%, rounded to whole dollars | 1946-1953 |
| Short-notice cutoff | fewer than 14 calendar days | 1946-1953 |
| Quote validity | three calendar months from save | 2482-2488 |

## Produced line items and formulas

This is rendered order in the page at lines 967-1048. Hidden zero rows do not
appear. The long-event premium has a dedicated HTML row but `calculate()` hides
it and combines its amount into Extended Service Hours at lines 2183-2192.

| Order | Rendered line | Formula in `calculate()` |
|---:|---|---|
| 1 | Base Package or Small Group Package | `smallGroup ? 395 : 650` (1974-1975) |
| 2 | Additional Bartenders | `(bartenders - 1) * 75 * baseHours` (2013-2017) |
| 3 | 2-Hour Service Reduction | subtract `(baseHours - hours) * 75 * bartenders`, standard events only (2029-2032) |
| 4 | Extended Service Hours | `(hours - baseHours) * 75 * bartenders` plus `max(0, hours - 5 + 1) * 15 * bartenders` (2034-2043, 2183-2191) |
| 5 | Long-Event Premium | always hidden as a separate row (2192) |
| 6 | Full Bar Service | `15 * hours * fullBarStaffCount` when `packageType === 'fullbar'` (2050-2055) |
| 7 | Signature Cocktails | `cocktailCount * 125` (2065-2068) |
| 8 | House Featured Cocktails | `houseCocktailCount * 50` (2069-2071) |
| 9 | Expanded or Extensive Featured Cocktail Program | $250 for 5 through 7 total featured cocktails, $500 for 8 or more (2072-2076) |
| 10 | High-Volume Event Adjustment | $175 for 51 through 100, $250 for 101 and up, unless multi-bar is selected (2019-2027) |
| 11 | Large Event & Multi-Bar Operations | $500 when selected, replacing volume (2019-2027) |
| 12 | Premium Add-Ons | Sum of procurement, coffee, arch, logo ice and tent in that order (2078-2104) |
| 13 | Premium Glassware | `round(glassCount * 3.50)` for formal glassware (2057-2063) |
| 14 | Travel Fee | `round((distance - 30) * 0.67 * 2)` when distance exceeds 30 (2045-2048) |
| 15 | Custom Items | Sum of entered custom item prices (2105-2113) |
| 16 | Promo Discount | Percent is `round(subtotal * rate)`, otherwise fixed dollars (2123-2130) |
| 17 | Custom Discount | Percent is `round((subtotal - promoDiscount) * rate)`, otherwise fixed dollars (2132-2142) |

Subtotal is the sum at lines 2115-2121. Total subtracts both discounts at line
2144. Deposit and balance are computed by `getPaymentAmounts()` at lines
1946-1953.

## Saved `quotes` row

`saveQuoteToBooks()` builds the row at lines 2427-2526. A new row contains:

`lead_id`, `total`, `deposit`, `balance`, `guest_count`, `hours`, `bartenders`,
`breakdown`, `promo_code`, `addon_notes`, `valid_until`, `status` and
`version_history`.

An update sends the same fields except `lead_id` and `status`. It preserves the
existing status server-side.

### `breakdown`

For one event, the saved object contains every `calculate()` field plus
`_config` (lines 2463-2472):

`base`, `hours`, `bartenders`, `fullBarStaffCount`, `quoteOptionName`,
`clientNotes`, `staffing`, `volume`, `multiBarOperations`, `twoHrReduction`,
`extraHours`, `longEventPremium`, `travel`, `package`, `glassware`,
`glasswareAtCost`, `cocktails`, `signatureCocktailCount`,
`signatureCocktailNames`, `houseCocktails`, `houseCocktailCount`,
`houseCocktailNames`, `cocktailProgram`, `featuredCocktailCount`, `addons`,
`addonsList`, `addonItems`, `discount`, optional `procurementCustom`,
`customItems`, `customItemsTotal`, `customItemsList`, `customDiscount`,
`customDiscountLabel` and `_config`.

For multiple events, `breakdown` is an array. Each element has `name`, `total`,
`guestCount`, `hours`, `bartenders`, `bd` and `_config` (lines 2451-2460).

### `_config`

`getCurrentConfig()` supplies these fields at lines 1460-1492:

`eventName`, `quoteOptionName`, `clientNotes`, `eventDate`, `guestCount`,
`hours`, `packageType`, `glassware`, `glassCount`, `distance`, `cocktailCount`,
`houseCocktailCount`, `signatureCocktailNames`, `houseCocktailNames`,
`bartenderCount`, `fullBarStaffCount`, `smallGroup`, `multiBarOperations`,
`alcoholProcurement`, `coffeeService`, `archBackdrop`, `drinkBigIce`,
`iceCount`, `tentRental`, `promoCode`, `customItems`, `customPromo`,
`customPromoLabel`, `customPromoAmount` and `customPromoType`.

### `version_history`

A new quote starts with one object containing `versionNum`, `total`, `deposit`,
`balance`, `status: 'draft'` and `created_at`. An update appends an object with
`versionNum`, `total`, `deposit`, `balance` and `edited_at` (lines 2490-2495).

