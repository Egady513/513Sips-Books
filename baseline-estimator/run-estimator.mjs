#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const JSDOM_PATH = 'C:\\Users\\EDDIE~1.GAD\\AppData\\Local\\Temp\\claude\\C--Users-eddie-gady-OneDrive---Centric-Consulting-Eddie-Obsidian-Brain\\600de729-004e-4992-8c52-55026946dfb9\\scratchpad\\harness\\node_modules\\jsdom';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require(JSDOM_PATH);

const BASELINE_NOW = '2026-11-01T12:00:00-04:00';
const here = path.dirname(fileURLToPath(import.meta.url));
const estimatorPath = path.join(here, 'source', 'alcohol-estimator.html');

const DEFAULT_INPUTS = {
  guestCount: '50', duration: '3', drinksPerPersonFirst: '1.5', drinksPerPersonAfter: '1.0',
  pctBeer: '35', pctWine: '30', pctChampagne: '10', pctCocktails: '25',
  pctSeltzer: '10', pctFullBar: '0', pctRed: '50', pctWhite: '50',
  beerPackaging: 'cans', pctCiderToast: '15', iceLbsPerGuest: '1.5', icePurchaser: 'client',
};

const DEFAULT_TOGGLES = {
  enableBeer: true, enableWine: true, enableChampagne: false, enableChampagneToast: false,
  enableCocktails: true, enableSeltzer: false, enableFullBar: false, enableProcurement: false,
  enableNA: false,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeInput(input = {}) {
  return {
    version: 2,
    inputs: { ...DEFAULT_INPUTS, ...(input.inputs || {}) },
    toggles: { ...DEFAULT_TOGGLES, ...(input.toggles || {}) },
    cocktails: clone(input.cocktails || []),
    naBeverages: clone(input.naBeverages || []),
    beerBrands: clone(input.beerBrands || []),
    seltzerBrands: clone(input.seltzerBrands || []),
    fullBarLiquors: clone(input.fullBarLiquors || []),
    fullBarMixers: clone(input.fullBarMixers || []),
    manualBudgetItems: clone(input.manualBudgetItems || []),
    removedBudgetKeys: clone(input.removedBudgetKeys || []),
    prices: clone(input.prices || {}),
    settings: clone(input.settings || {}),
  };
}

function moneyText(text) {
  const match = String(text || '').replace(/,/g, '').match(/-?\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function parseListRows(element) {
  if (!element) return [];
  return [...element.querySelectorAll('.list-item')].map((row) => ({
    label: row.querySelector('.item-name')?.textContent.trim() || '',
    quantity: row.querySelector('.item-qty')?.textContent.trim() || '',
  }));
}

function applyActions(window, actions = []) {
  for (const action of actions) {
    if (action.type === 'removeBudgetItem') {
      window.removeBudgetItem(action.key);
    } else if (action.type === 'removeManualBudgetItem') {
      const state = window.collectFullState();
      const item = action.id !== undefined
        ? state.manualBudgetItems.find((entry) => entry.id === action.id)
        : state.manualBudgetItems.find((entry) => entry.name === action.name);
      if (!item) throw new Error(`Manual budget item not found: ${action.id ?? action.name}`);
      window.removeManualBudgetItem(item.id);
    } else if (action.type === 'addManualBudgetItem') {
      window.addManualBudgetItem();
      const item = window.collectFullState().manualBudgetItems.at(-1);
      for (const [field, value] of Object.entries(action.item || {})) {
        if (field !== 'unitPrice') window.updateManualBudgetItem(item.id, field, value);
      }
      if (action.item?.unitPrice !== undefined) window.onManualPriceEdit(action.item.name || '', action.item.unitPrice);
    } else if (action.type === 'editPrice') {
      window.onPriceEdit(action.key, action.kind, action.value);
    } else if (action.type === 'editTax') {
      window.onTaxEdit(action.value);
    } else if (action.type === 'editContingency') {
      window.onContingencyEdit(action.value);
    } else {
      throw new Error(`Unknown estimator action: ${action.type}`);
    }
  }
  window.calculate();
}

async function makeDom(input) {
  // Windows checkouts may use CRLF; the string markers below assume LF.
  let html = (await fs.readFile(estimatorPath, 'utf8')).replaceAll(String.fromCharCode(13), '');
  const calculationMarker = "            budgetItems = orderedKeys.map(k => mergedByKey[k]).filter(i => !removedBudgetKeys.has(i.key));\n\n            renderBudget();\n        }";
  const calculationCapture = `            budgetItems = orderedKeys.map(k => mergedByKey[k]).filter(i => !removedBudgetKeys.has(i.key));

            renderBudget();
            window.__baselineCalculation = JSON.parse(JSON.stringify({
              totalDrinks, bufferedDrinks, beerDrinks, wineDrinks, champagneDrinks,
              cocktailDrinks, seltzerDrinks, fullBarDrinks, naDrinks,
              champagneToastBottles, ciderToastBottles, champagneBarBottles,
              recipeChampagneBottles, totalChampagneBottles, champagneSources,
              recipeTotals, fullBarLiquorBreakdown, fullBarMixerBreakdown, iceBags
            }));
        }`;
  if (!html.includes(calculationMarker)) throw new Error('Pinned estimator calculate() marker not found');
  html = html.replace(calculationMarker, calculationCapture);
  const captureSource = `
    window.__baselineInternals = function () {
      const autoLines = budgetItems.map(function (item) {
        const unitPrice = itemPurchaser(item) === 'eddie' ? priceFor(item.key, item.kind) : null;
        return Object.assign({}, item, { unitPrice, amount: unitPrice === null ? null : unitPrice * item.qty });
      });
      const manualLines = manualBudgetItems.map(function (item) {
        const key = 'manual|' + (item.name || '').toLowerCase().trim();
        const unitPrice = itemPurchaser(item) === 'eddie' ? priceFor(key, 'manual') : null;
        return { key, label: item.name, qty: item.qty, unitLabel: item.unitLabel, kind: 'manual', purchaser: item.purchaser, unitPrice, amount: unitPrice === null ? null : unitPrice * item.qty };
      });
      return JSON.parse(JSON.stringify({ lines: autoLines.concat(manualLines) }));
    };
  `;
  const closingScript = html.lastIndexOf('</script>');
  if (closingScript < 0) throw new Error('Pinned estimator script not found');
  html = html.slice(0, closingScript) + captureSource + html.slice(closingScript);

  const requests = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (!/Could not load (?:link|img)/.test(error.message)) throw error;
  });
  const query = new URLSearchParams();
  if (input.eventId) query.set('event_id', input.eventId);
  if (input.leadId) query.set('lead_id', input.leadId);
  const suffix = query.size ? `?${query}` : '';
  const dom = new JSDOM(html, {
    url: `https://baseline.invalid/alcohol-estimator.html${suffix}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      const RealDate = window.Date;
      window.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [BASELINE_NOW])); }
        static now() { return new RealDate(BASELINE_NOW).getTime(); }
      };
      Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
        configurable: true,
        get() { return this.textContent; },
        set(value) { this.textContent = value; },
      });
      window.fetch = async (url, options = {}) => {
        requests.push({ url: String(url), options: clone(options) });
        if (options.method === 'POST') {
          return { ok: true, status: 201, json: async () => ({ success: true, estimate: { id: 'baseline-id' } }) };
        }
        return { ok: false, status: 404, json: async () => [] };
      };
      window.open = () => null;
      window.alert = () => {};
      window.confirm = () => false;
      window.print = () => {};
      window.localStorage.clear();
    },
  });
  if (dom.window.document.readyState === 'loading') {
    await new Promise((resolve) => dom.window.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  return { dom, requests };
}

function captureOutput(window) {
  const { document } = window;
  const state = window.collectFullState();
  const internals = window.__baselineInternals();
  const calculation = window.__baselineCalculation;
  const lines = internals.lines;
  const totalsRows = parseListRows(document.getElementById('budgetTotals'));
  const subtotal = moneyText(totalsRows[0]?.quantity);
  const taxPct = state.settings.tax ?? 7.8;
  const contingencyPct = state.settings.contingency ?? 10;
  const tax = moneyText(totalsRows[1]?.quantity);
  const contingency = moneyText(totalsRows[2]?.quantity);
  const grandTotal = moneyText(totalsRows[3]?.quantity);
  const quantityFor = (predicate) => lines.filter(predicate).reduce((sum, line) => sum + line.qty, 0);

  return {
    totalDrinks: calculation.totalDrinks,
    bufferedDrinks: calculation.bufferedDrinks,
    categoryDrinks: {
      beer: calculation.beerDrinks, wine: calculation.wineDrinks,
      champagne: calculation.champagneDrinks, cocktails: calculation.cocktailDrinks,
      seltzer: calculation.seltzerDrinks, fullBar: calculation.fullBarDrinks,
      nonAlcoholic: calculation.naDrinks,
    },
    purchases: {
      beerCases: quantityFor((line) => line.kind === 'beer-case'),
      kegs: quantityFor((line) => line.kind === 'keg'),
      redWineBottles: quantityFor((line) => line.key === 'wine|red'),
      whiteWineBottles: quantityFor((line) => line.key === 'wine|white'),
      champagneBarBottles: calculation.champagneBarBottles,
      champagneToastBottles: calculation.champagneToastBottles,
      ciderToastBottles: calculation.ciderToastBottles,
      seltzerCases: quantityFor((line) => line.kind === 'seltzer-case'),
      naBottles: quantityFor((line) => line.kind === 'soda2l'),
      beerBrands: parseListRows(document.getElementById('beerBrandBreakdown')),
      seltzerBrands: parseListRows(document.getElementById('seltzerBrandBreakdown')),
      recipeAlcohol: parseListRows(document.getElementById('alcoholBottleBreakdown')).filter((row) => row.quantity),
      recipeTotals: calculation.recipeTotals,
      recipes: parseListRows(document.getElementById('cocktailBreakdown')),
      mixers: parseListRows(document.getElementById('mixerBreakdown')),
      champagneRollup: {
        recipeBottles: calculation.recipeChampagneBottles,
        barBottles: calculation.champagneBarBottles,
        toastBottles: calculation.champagneToastBottles,
        totalBottles: calculation.totalChampagneBottles,
        sources: calculation.champagneSources,
      },
      fullBarLiquor: parseListRows(document.getElementById('fullBarLiquorBreakdown')),
      fullBarMixers: parseListRows(document.getElementById('fullBarMixerBreakdown')),
      nonAlcoholic: parseListRows(document.getElementById('mocktailBreakdown')),
      nonAlcoholicMixers: parseListRows(document.getElementById('mocktailMixerBreakdown')),
      iceBags: lines.find((line) => line.key === 'ice|bags')?.qty || 0,
    },
    budget: { lines, subtotal, taxPct, tax, contingencyPct, contingency, grandTotal },
  };
}

async function captureSave(window, requests) {
  const button = [...window.document.querySelectorAll('button')].find((entry) => entry.getAttribute('onclick') === 'sendToBooks()');
  if (!button) throw new Error('Save to Books button not found');
  button.click();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const request = requests.find((entry) => entry.options.method === 'POST');
    if (request) return JSON.parse(request.options.body);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Save handler did not produce a POST payload');
}

export async function runEstimator(input = {}) {
  const { dom, requests } = await makeDom(input);
  try {
    const { window } = dom;
    window.localStorage.clear();
    window.applyFullState(normalizeInput(input));
    applyActions(window, input.actions || []);
    const output = captureOutput(window);
    output.estimateData = await captureSave(window, requests);
    return output;
  } finally {
    dom.window.close();
  }
}

function stable(value) {
  return JSON.stringify(value);
}

async function main() {
  const fixtureArg = process.argv[2];
  if (!fixtureArg) {
    console.error('Usage: node baseline-estimator/run-estimator.mjs baseline-estimator/golden-fixtures.json [--update]');
    process.exitCode = 2;
    return;
  }
  const fixturePath = path.resolve(fixtureArg);
  const document = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const fixtures = Array.isArray(document) ? document : document.fixtures;
  const update = process.argv.includes('--update');
  let failed = 0;

  console.log(`${'Result'.padEnd(8)} ${'Fixture'.padEnd(48)} Drinks   Prepay`);
  console.log(`${'-'.repeat(8)} ${'-'.repeat(48)} ${'-'.repeat(8)} ${'-'.repeat(10)}`);
  for (const fixture of fixtures) {
    const actual = await runEstimator(fixture.input);
    const pass = update || stable(actual) === stable(fixture.expected);
    if (!pass) failed += 1;
    if (update) fixture.expected = actual;
    console.log(`${(pass ? 'PASS' : 'FAIL').padEnd(8)} ${fixture.name.padEnd(48)} ${String(actual.bufferedDrinks).padStart(6)}   $${actual.budget.grandTotal.toFixed(2)}`);
    if (!pass) {
      console.log(`  expected: ${stable(fixture.expected)}`);
      console.log(`  actual:   ${stable(actual)}`);
    }
  }
  if (update) await fs.writeFile(fixturePath, `${JSON.stringify(document, null, 2)}\n`);
  process.exitCode = failed ? 1 : 0;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) await main();
