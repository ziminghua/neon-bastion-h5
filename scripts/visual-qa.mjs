import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base = 'http://127.0.0.1:8080/';
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
page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
page.on('requestfailed', req => errors.push(`requestfailed: ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`));

async function openState(name, query = '', wait = 700) {
  await page.goto(`${base}${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__NEON_TEST__ && Object.keys(window.__NEON_TEST__.assets).length >= 19, null, { timeout: 20000 });
  await page.waitForTimeout(wait);
  const assetState = await page.evaluate(() => ({
    failures: window.__assetLoadFailures || [],
    assets: Object.fromEntries(Object.entries(window.__NEON_TEST__.assets).map(([key, image]) => [key, [image.naturalWidth, image.naturalHeight]]))
  }));
  if (assetState.failures.length) errors.push(`${name}: failed assets ${assetState.failures.join(', ')}`);
  for (const [key, [width, height]] of Object.entries(assetState.assets)) {
    if (!width || !height) errors.push(`${name}: invalid asset ${key} (${width}x${height})`);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  return assetState;
}

await openState('01-intro');
await openState('02-build', '?qa=build');
await openState('03-built', '?qa=built');

// Verify the tower follows the pointer, exposes a drop target, and settles on release.
await page.goto(`${base}?qa=built`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_TEST__?.level?.slots?.length >= 9, null, { timeout: 20000 });
await page.waitForTimeout(500);
const dragStage = page.locator('#game');
const dragBox = await dragStage.boundingBox();
if (!dragBox) throw new Error('Canvas unavailable for drag QA');
const dragNodes = await page.evaluate(() => ({
  from: window.__NEON_TEST__.level.slots[0],
  to: window.__NEON_TEST__.level.slots[8]
}));
const mapPoint = ({ x, y }) => ({ x: dragBox.x + x / 1600 * dragBox.width, y: dragBox.y + y / 900 * dragBox.height });
const dragFrom = mapPoint(dragNodes.from), dragTo = mapPoint(dragNodes.to);
await page.mouse.move(dragFrom.x, dragFrom.y);
await page.mouse.down();
await page.mouse.move(dragTo.x, dragTo.y, { steps: 14 });
await page.waitForTimeout(220);
const dragState = await page.evaluate(() => ({
  active: Boolean(window.__NEON_TEST__.state.drag?.moved),
  hoverSlot: window.__NEON_TEST__.state.hoverSlot,
  towerSlot: window.__NEON_TEST__.state.drag?.tower?.slot
}));
await page.screenshot({ path: `${out}/04-drag-active.png` });
if (!dragState.active || dragState.hoverSlot !== 8 || dragState.towerSlot !== 0) errors.push(`drag preview failed: ${JSON.stringify(dragState)}`);
await page.mouse.up();
await page.waitForTimeout(420);
const landedState = await page.evaluate(() => ({
  active: Boolean(window.__NEON_TEST__.state.drag),
  movedTower: window.__NEON_TEST__.state.towers.some(t => t.type === 'rail' && t.slot === 8)
}));
await page.screenshot({ path: `${out}/05-drag-landed.png` });
if (landedState.active || !landedState.movedTower) errors.push(`drag landing failed: ${JSON.stringify(landedState)}`);

await openState('06-battle', '?qa=battle', 4200);
await page.evaluate(() => window.__NEON_TEST__.useEMP());
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/07-emp.png` });
await openState('08-protocol', '?qa=protocol');
await openState('09-result', '?qa=result');

// Complete the actual five-wave loop at accelerated simulation speed.
await page.goto(`${base}?qa=build`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_TEST__, null, { timeout: 20000 });
await page.evaluate(() => {
  const test = window.__NEON_TEST__;
  test.state.credits = 5000;
  [['rail',0],['cryo',1],['plasma',2],['arcane',3],['rail',4],['cryo',5],['plasma',6],['arcane',7]].forEach(([type, slot]) => test.buildTower(type, slot));
  Object.keys(test.state.mods.damage).forEach(key => { test.state.mods.damage[key] = 2.5; });
  test.state.speed = 8;
});

for (let wave = 1; wave <= 5; wave += 1) {
  await page.evaluate(() => window.__NEON_TEST__.startWave());
  if (wave === 1) {
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/10-full-run-combat.png` });
  }
  if (wave < 5) {
    await page.waitForFunction(
      () => !document.getElementById('protocolModal').classList.contains('hidden'),
      null,
      { timeout: 90000 }
    );
    await page.locator('.protocol-choice').first().click();
    await page.waitForFunction(() => !window.__NEON_TEST__.state.paused && window.__NEON_TEST__.state.buildPhase, null, { timeout: 10000 });
  }
}
await page.waitForFunction(() => !document.getElementById('resultModal').classList.contains('hidden'), null, { timeout: 90000 });
await page.screenshot({ path: `${out}/11-full-run-result.png` });
const fullRun = await page.evaluate(() => ({
  wave: window.__NEON_TEST__.state.wave,
  hp: window.__NEON_TEST__.state.hp,
  kills: window.__NEON_TEST__.state.kills,
  title: document.getElementById('resultTitle').textContent,
  resultVisible: !document.getElementById('resultModal').classList.contains('hidden')
}));
if (fullRun.wave !== 5 || !fullRun.resultVisible || !fullRun.title.includes('SECURED')) {
  errors.push(`full run failed: ${JSON.stringify(fullRun)}`);
}

const viewport = await page.evaluate(() => ({
  innerWidth, innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight
}));
if (viewport.scrollWidth > viewport.innerWidth || viewport.scrollHeight > viewport.innerHeight) {
  errors.push(`viewport overflow: ${JSON.stringify(viewport)}`);
}

// Verify the same fixed 16:9 composition scales cleanly to a common laptop viewport.
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(`${base}?qa=built`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_TEST__, null, { timeout: 20000 });
await page.waitForTimeout(700);
const responsive = await page.evaluate(() => {
  const shell = document.getElementById('game-shell').getBoundingClientRect();
  return {
    innerWidth,
    innerHeight,
    shellWidth: shell.width,
    shellHeight: shell.height,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  };
});
await page.screenshot({ path: `${out}/12-responsive-1280x720.png` });
if (Math.abs(responsive.shellWidth - 1280) > 1 || Math.abs(responsive.shellHeight - 720) > 1 || responsive.scrollWidth > 1280 || responsive.scrollHeight > 720) {
  errors.push(`responsive layout failed: ${JSON.stringify(responsive)}`);
}

const report = { errors, fullRun, viewport, responsive };
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
