import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out = 'artifacts/visual-qa';
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));

await page.goto('http://127.0.0.1:8080/?qa=build&draftSeed=20260805', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_TEST__ && window.__NEON_DRAFT__, null, { timeout: 20000 });
await page.waitForTimeout(500);

const initial = await page.evaluate(() => {
  const draft = window.__NEON_DRAFT__.snapshot();
  const visibleCards = [...document.querySelectorAll('.tower-card')].filter(card => getComputedStyle(card).display !== 'none').map(card => card.dataset.type);
  const counts = [draft.current, draft.next, ...draft.bag].reduce((result, type) => {
    result[type] = (result[type] || 0) + 1;
    return result;
  }, {});
  return { draft, visibleCards, counts };
});

if (initial.draft.current === initial.draft.next) errors.push('initial current and next tower are identical');
if (initial.visibleCards.length !== 1 || initial.visibleCards[0] !== initial.draft.current) errors.push(`visible offer mismatch: ${JSON.stringify(initial.visibleCards)}`);
for (const type of ['rail', 'cryo', 'plasma', 'arcane']) {
  if (initial.counts[type] !== 2) errors.push(`bag fairness failed for ${type}: ${initial.counts[type]}`);
}
if (!initial.draft.freeReroll || initial.draft.rerollCost !== 0) errors.push(`initial reroll should be free: ${JSON.stringify(initial.draft)}`);
await page.screenshot({ path: `${out}/11-random-draft-initial.png` });

const beforeFree = initial.draft.current;
await page.locator('#draftReroll').click();
await page.waitForFunction(previous => window.__NEON_DRAFT__.current !== previous, beforeFree);
const afterFree = await page.evaluate(() => window.__NEON_DRAFT__.snapshot());
if (afterFree.freeReroll || afterFree.rerollCost !== 20) errors.push(`free reroll state failed: ${JSON.stringify(afterFree)}`);
await page.screenshot({ path: `${out}/12-random-draft-rerolled.png` });

const expectedAfterBuild = afterFree.next;
const offeredBeforeBuild = afterFree.current;
await page.evaluate(type => {
  window.__NEON_TEST__.state.credits = 1000;
  window.__NEON_TEST__.buildTower(type, 0);
}, offeredBeforeBuild);
await page.waitForFunction(expected => window.__NEON_TEST__.state.towers.length === 1 && window.__NEON_DRAFT__.current === expected, expectedAfterBuild);
const afterBuild = await page.evaluate(() => ({
  draft: window.__NEON_DRAFT__.snapshot(),
  tower: window.__NEON_TEST__.state.towers[0],
  selectedBuild: window.__NEON_TEST__.state.selectedBuild
}));
if (afterBuild.tower.type !== offeredBeforeBuild) errors.push(`built tower did not match offer: ${afterBuild.tower.type} vs ${offeredBeforeBuild}`);
if (afterBuild.selectedBuild !== afterBuild.draft.current) errors.push(`next offer was not auto-selected: ${afterBuild.selectedBuild} vs ${afterBuild.draft.current}`);
await page.screenshot({ path: `${out}/13-random-draft-consumed.png` });

const creditsBeforePaid = await page.evaluate(() => window.__NEON_TEST__.state.credits);
await page.locator('#draftReroll').click();
await page.waitForTimeout(150);
const paid = await page.evaluate(() => ({
  credits: window.__NEON_TEST__.state.credits,
  draft: window.__NEON_DRAFT__.snapshot()
}));
if (creditsBeforePaid - paid.credits !== 20) errors.push(`paid reroll did not deduct 20 credits: ${creditsBeforePaid} -> ${paid.credits}`);
if (paid.draft.rerollCost !== 35) errors.push(`paid reroll escalation failed: ${paid.draft.rerollCost}`);

const report = { errors, initial, afterFree, afterBuild, paid };
await fs.writeFile(`${out}/random-draft-report.json`, JSON.stringify(report, null, 2));
await browser.close();

if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
