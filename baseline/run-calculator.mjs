#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Supplied by the pilot brief. This keeps jsdom outside the application dependency tree.
const JSDOM_PATH = 'C:\\Users\\EDDIE~1.GAD\\AppData\\Local\\Temp\\claude\\C--Users-eddie-gady-OneDrive---Centric-Consulting-Eddie-Obsidian-Brain\\600de729-004e-4992-8c52-55026946dfb9\\scratchpad\\harness\\node_modules\\jsdom';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require(JSDOM_PATH);

const BASELINE_NOW = '2026-10-31T12:00:00-04:00';
const here = path.dirname(fileURLToPath(import.meta.url));
const calculatorPath = path.join(here, 'source', 'calculator.html');

function money(text) {
  const negative = /^\s*-/.test(text);
  const value = Number(String(text).replace(/[^0-9.]/g, '')) || 0;
  return negative ? -value : value;
}

function setElement(document, id, value) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Unknown calculator input: ${id}`);
  if (element.type === 'checkbox') element.checked = Boolean(value);
  else element.value = String(value);
}

function normalizeInput(input = {}) {
  return {
    eventName: '', quoteOptionName: '', clientNotes: '', eventDate: '',
    guestCount: 50, smallGroup: false, hours: 3, bartenderCount: 1,
    packageType: 'beerwine', fullBarStaffCount: 1,
    glassware: 'plastic_at_cost', glassCount: 0, distance: 0,
    cocktailCount: 0, houseCocktailCount: 0,
    signatureCocktailNames: '', houseCocktailNames: '',
    multiBarOperations: false, alcoholProcurement: false,
    coffeeService: false, archBackdrop: false, drinkBigIce: false,
    iceCount: 100, tentRental: false, promoCode: '', customItems: [],
    ...input,
  };
}

function applyInputs(window, rawInput) {
  const input = normalizeInput(rawInput);
  const { document } = window;

  setElement(document, 'smallGroup', input.smallGroup);
  window.toggleSmallGroup();
  setElement(document, 'bartenderCount', input.bartenderCount);
  window.syncFullBarStaffOptions(input.fullBarStaffCount);

  const direct = [
    'eventName', 'quoteOptionName', 'clientNotes', 'eventDate', 'guestCount',
    'hours', 'packageType', 'glassware', 'glassCount', 'distance',
    'signatureCocktailNames', 'houseCocktailNames', 'multiBarOperations',
    'alcoholProcurement', 'coffeeService', 'archBackdrop', 'drinkBigIce',
    'iceCount', 'tentRental',
  ];
  for (const id of direct) setElement(document, id, input[id]);

  document.getElementById('cocktailCount').textContent = String(input.cocktailCount);
  document.getElementById('houseCocktailCount').textContent = String(input.houseCocktailCount);
  window.toggleFullBarCoverage();
  window.syncFullBarStaffOptions(input.fullBarStaffCount);
  setElement(document, 'fullBarStaffCount', input.fullBarStaffCount);

  document.getElementById('customItems').innerHTML = '';
  for (const item of input.customItems) window.addCustomItem(item.name, item.price);

  setElement(document, 'promoCode', input.promoCode || '');
  window.applyPromo(false);
  return input;
}

function visibleLines(document) {
  return [...document.querySelectorAll('#breakdown > .breakdown-item')]
    .filter((element) => element.style.display !== 'none')
    .map((element) => {
      const spans = [...element.querySelectorAll(':scope > span')];
      const labelElement = element.querySelector('.tooltip-container > span') || spans[0];
      const amountElement = spans.at(-1) || element.querySelector('#basePrice');
      return {
        label: labelElement?.textContent.trim() || '',
        amount: money(amountElement?.textContent || '0'),
      };
    });
}

function captureEvent(window, appliedInput) {
  const { document } = window;
  window.calculate();
  const breakdown = structuredClone(window.currentBreakdown);
  return {
    total: window.currentTotal,
    deposit: money(document.getElementById('depositAmount').textContent),
    balance: money(document.getElementById('balanceAmount').textContent),
    depositLabel: document.getElementById('depositLabel').textContent.trim(),
    balanceLabel: document.getElementById('balanceLabel').textContent.trim(),
    lines: visibleLines(document),
    quantities: {
      guests: Number(appliedInput.guestCount),
      hours: Number(appliedInput.hours),
      bartenders: Number(appliedInput.bartenderCount),
      fullBarStaff: Number(appliedInput.fullBarStaffCount),
      glasses: Number(appliedInput.glassCount),
      signatureCocktails: Number(appliedInput.cocktailCount),
      houseCocktails: Number(appliedInput.houseCocktailCount),
      featuredCocktails: Number(appliedInput.cocktailCount) + Number(appliedInput.houseCocktailCount),
      logoIceCubes: appliedInput.drinkBigIce ? Number(appliedInput.iceCount) : 0,
      oneWayMiles: Number(appliedInput.distance),
    },
    breakdown,
  };
}

async function makeDom(eventCount = 1) {
  const html = await fs.readFile(calculatorPath, 'utf8');
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (!/Could not load img/.test(error.message)) throw error;
  });
  const query = eventCount > 1 ? `?events=${eventCount}` : '';
  const dom = new JSDOM(html, {
    url: `https://baseline.invalid/calculator.html${query}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      const RealDate = window.Date;
      window.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [BASELINE_NOW])); }
        static now() { return new RealDate(BASELINE_NOW).getTime(); }
      };
      window.fetch = async () => { throw new Error('Network disabled by baseline harness'); };
      window.open = () => null;
      window.confirm = () => false;
      window.alert = () => {};
    },
  });
  if (dom.window.document.readyState === 'loading') {
    await new Promise((resolve) => dom.window.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  dom.window.localStorage.clear();
  return dom;
}

export async function runCalculator(input) {
  const events = Array.isArray(input?.events) ? input.events : [input];
  const dom = await makeDom(events.length);
  const { window } = dom;
  const outputs = [];
  for (let index = 0; index < events.length; index += 1) {
    if (index > 0) window.switchEvent(index);
    let applied = applyInputs(window, events[index]);
    const changeSnapshots = [];
    for (const change of events[index]?.changes || []) {
      const before = captureEvent(window, applied);
      applied = applyInputs(window, { ...applied, ...change, changes: [] });
      const after = captureEvent(window, applied);
      changeSnapshots.push({
        change,
        before: { total: before.total, guests: before.quantities.guests, glasses: before.quantities.glasses },
        after: { total: after.total, guests: after.quantities.guests, glasses: after.quantities.glasses },
      });
    }
    const output = captureEvent(window, applied);
    if (changeSnapshots.length) output.changeSnapshots = changeSnapshots;
    outputs.push(output);
  }
  const combinedTotal = outputs.reduce((sum, output) => sum + output.total, 0);
  const firstDate = events.map((event) => event.eventDate).filter(Boolean).sort()[0] || '';
  const combinedPayment = window.getPaymentAmounts(combinedTotal, firstDate);
  dom.window.close();
  return events.length === 1 ? outputs[0] : {
    events: outputs,
    total: combinedTotal,
    deposit: combinedPayment.deposit,
    balance: combinedPayment.balance,
    depositLabel: combinedPayment.shortNotice ? 'Full Amount Due at Signing' : 'Combined Deposit (50%)',
  };
}

function stable(value) {
  return JSON.stringify(value);
}

async function main() {
  const fixtureArg = process.argv[2];
  if (!fixtureArg) {
    console.error('Usage: node baseline/run-calculator.mjs baseline/golden-fixtures.json [--update]');
    process.exitCode = 2;
    return;
  }
  const fixturePath = path.resolve(fixtureArg);
  const document = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const fixtures = Array.isArray(document) ? document : document.fixtures;
  const update = process.argv.includes('--update');
  let failed = 0;

  console.log(`${'Result'.padEnd(8)} ${'Fixture'.padEnd(44)} Total`);
  console.log(`${'-'.repeat(8)} ${'-'.repeat(44)} ${'-'.repeat(10)}`);
  for (const fixture of fixtures) {
    const actual = await runCalculator(fixture.input);
    const pass = update || stable(actual) === stable(fixture.expected);
    if (!pass) failed += 1;
    if (update) fixture.expected = actual;
    if (fixture.target) {
      const actualValue = fixture.target.field === 'breakdown.base'
        ? actual.breakdown?.base
        : actual.total;
      fixture.target.matches = actualValue === fixture.target.value;
    }
    console.log(`${(pass ? 'PASS' : 'FAIL').padEnd(8)} ${fixture.name.padEnd(44)} $${actual.total.toLocaleString()}`);
    if (!pass) {
      console.log(`  expected: ${stable(fixture.expected)}`);
      console.log(`  actual:   ${stable(actual)}`);
    }
  }
  if (update) await fs.writeFile(fixturePath, `${JSON.stringify(document, null, 2)}\n`);
  process.exitCode = failed ? 1 : 0;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) await main();

