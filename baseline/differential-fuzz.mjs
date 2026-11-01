// Differential check (Claude, 2026-10-31): random valid inputs through the real pinned page (jsdom) and the typed engine.
// Run: NODE_PATH=<folder with jsdom>/node_modules node baseline/differential-fuzz.mjs [seed] [cases]
import { runCalculator } from './run-calculator.mjs';
import { calculateQuote } from '../src/lib/pricing/calculateQuote.ts';
import { fromFormInputs } from '../src/lib/pricing/fromFormInputs.ts';

let seed = Number(process.argv[2] || 12345);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[int(0, arr.length - 1)];
const bool = (p = 0.5) => rnd() < p;
const N = Number(process.argv[3] || 250);
const dates = ['', '2026-11-05', '2026-11-14', '2026-11-21', '2026-12-31', '2027-03-06', '2027-09-18'];
let bad = 0;
const covered = { small: 0, fullbar: 0, multibar: 0, promo: 0, custom: 0, long: 0 };
for (let i = 0; i < N; i++) {
  const bartenderCount = int(1, 6);
  const small = bool(0.12);
  const input = {
    eventDate: pick(dates),
    guestCount: small ? int(1, 20) : int(1, 500),
    smallGroup: small,
    hours: int(2, 8),
    bartenderCount,
    packageType: pick(['beerwine', 'fullbar']),
    fullBarStaffCount: int(1, bartenderCount),
    glassware: pick(['plastic_at_cost', 'formal', 'none']),
    glassCount: int(0, 600),
    distance: pick([0, 0, 10, 30, 31, 45, 90]),
    cocktailCount: int(0, 6),
    houseCocktailCount: int(0, 4),
    multiBarOperations: bool(0.2),
    alcoholProcurement: bool(0.4),
    coffeeService: bool(0.15),
    archBackdrop: bool(0.15),
    drinkBigIce: bool(0.3),
    iceCount: pick([50, 100, 150, 200, 301]),
    tentRental: bool(0.1),
    promoCode: pick(['', '', '', 'FIRST10', 'VENDOR50', 'REFERRAL', 'RECURRING1', 'RECURRING3', 'RECURRING6', 'LAUNCH50']),
    customItems: bool(0.25) ? [{ name: 'Extra', price: int(1, 900) }] : [],
  };
  let page, eng;
  try { page = await runCalculator(input); } catch (e) { console.log('PAGE ERROR', i, e.message); bad++; continue; }
  try { eng = calculateQuote(fromFormInputs(input), { today: '2026-10-31' }); } catch (e) { console.log('ENGINE ERROR', i, e.message, JSON.stringify(input)); bad++; continue; }
  if (small) covered.small++; if (input.packageType === 'fullbar') covered.fullbar++; if (input.multiBarOperations) covered.multibar++;
  if (input.promoCode) covered.promo++; if (input.customItems.length) covered.custom++; if (input.hours >= 5) covered.long++;
  const eLines = eng.lines.map(({ label, amount }) => ({ label, amount }));
  const same = page.total === eng.total && page.deposit === eng.deposit && page.balance === eng.balance
    && JSON.stringify(page.lines) === JSON.stringify(eLines)
    && JSON.stringify(page.quantities) === JSON.stringify(eng.quantities);
  if (!same) {
    bad++;
    if (bad <= 5) console.log('MISMATCH', i, JSON.stringify(input), '\n page', page.total, page.deposit, page.balance, '\n eng ', eng.total, eng.deposit, eng.balance,
      '\n page lines', JSON.stringify(page.lines), '\n eng lines ', JSON.stringify(eLines));
  }
}
console.log(`cases ${N}, mismatches ${bad}, coverage`, JSON.stringify(covered));
process.exit(bad ? 1 : 0);
