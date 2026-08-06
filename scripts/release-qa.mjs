import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base = 'http://127.0.0.1:8080/';
const out = 'artifacts/release-qa';
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1
});
const page = await context.newPage();
const errors = [];
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', request => {
  errors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`);
});

async function openGame(query = '?qa=build') {
  await page.goto(`${base}${query}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(
    () => window.__NEON_TEST__?.state?.ready && window.__RENDERED_MAP_READY,
    null,
    { timeout: 45000 }
  );
  await page.waitForTimeout(350);
}

await openGame('?qa=built');
const assetReport = await page.evaluate(() => {
  const entries = Object.entries(window.__NEON_TEST__.assets).map(([key, asset]) => {
    const width = asset?.naturalWidth || asset?.videoWidth || asset?.width || 0;
    const height = asset?.naturalHeight || asset?.videoHeight || asset?.height || 0;
    return [key, { width, height, kind: asset?.constructor?.name || typeof asset }];
  });
  return {
    failures: window.__assetLoadFailures || [],
    assets: Object.fromEntries(entries),
    map: window.__RENDERED_MAP_DIAGNOSTICS,
    source: window.__RENDERED_MAP_SOURCE
  };
});
if (assetReport.failures.length) errors.push(`asset failures: ${assetReport.failures.join(', ')}`);
for (const [key, asset] of Object.entries(assetReport.assets)) {
  if (!asset.width || !asset.height) errors.push(`invalid asset ${key}: ${JSON.stringify(asset)}`);
}
if (assetReport.source !== 'delivery' || assetReport.map?.naturalWidth !== 1600 || assetReport.map?.naturalHeight !== 900) {
  errors.push(`rendered map invalid: ${JSON.stringify(assetReport.map)}`);
}
await page.screenshot({ path: `${out}/01-release-built-1600x900.png` });

// Drag the rail tower from the first authored platform to the ninth platform.
const canvas = page.locator('#game');
const canvasBox = await canvas.boundingBox();
if (!canvasBox) throw new Error('Canvas unavailable for drag QA');
const dragNodes = await page.evaluate(() => ({
  from: window.__NEON_TEST__.level.slots[0],
  to: window.__NEON_TEST__.level.slots[8]
}));
const toViewport = ({ x, y }) => ({
  x: canvasBox.x + (x / 1600) * canvasBox.width,
  y: canvasBox.y + (y / 900) * canvasBox.height
});
const dragFrom = toViewport(dragNodes.from);
const dragTo = toViewport(dragNodes.to);
await page.mouse.move(dragFrom.x, dragFrom.y);
await page.mouse.down();
await page.mouse.move(dragTo.x, dragTo.y, { steps: 14 });
await page.waitForTimeout(180);
const dragPreview = await page.evaluate(() => ({
  moved: Boolean(window.__NEON_TEST__.state.drag?.moved),
  hoverSlot: window.__NEON_TEST__.state.hoverSlot,
  sourceSlot: window.__NEON_TEST__.state.drag?.tower?.slot
}));
await page.screenshot({ path: `${out}/02-release-drag.png` });
if (!dragPreview.moved || dragPreview.hoverSlot !== 8 || dragPreview.sourceSlot !== 0) {
  errors.push(`drag preview failed: ${JSON.stringify(dragPreview)}`);
}
await page.mouse.up();
await page.waitForTimeout(420);
const dragResult = await page.evaluate(() => ({
  active: Boolean(window.__NEON_TEST__.state.drag),
  railAtTarget: window.__NEON_TEST__.state.towers.some(tower => tower.type === 'rail' && tower.slot === 8)
}));
if (dragResult.active || !dragResult.railAtTarget) errors.push(`drag landing failed: ${JSON.stringify(dragResult)}`);

// Execute the real five-wave loop with authored path and platforms.
await openGame('?qa=build');
await page.evaluate(() => {
  const game = window.__NEON_TEST__;
  game.state.credits = 6000;
  const layout = ['rail', 'cryo', 'plasma', 'arcane', 'rail', 'cryo', 'plasma', 'arcane'];
  layout.forEach((type, slot) => game.buildTower(type, slot));
  Object.keys(game.state.mods.damage).forEach(type => {
    game.state.mods.damage[type] = 2.7;
  });
  game.state.speed = 8;
});

for (let wave = 1; wave <= 5; wave += 1) {
  const started = await page.evaluate(() => window.__NEON_TEST__.startWave());
  if (started === false) errors.push(`wave ${wave} did not start`);
  if (wave === 1) {
    await page.waitForTimeout(950);
    await page.screenshot({ path: `${out}/03-release-wave-1.png` });
  }
  if (wave < 5) {
    await page.waitForFunction(
      () => !document.getElementById('protocolModal').classList.contains('hidden'),
      null,
      { timeout: 90000 }
    );
    await page.locator('.protocol-choice').first().click();
    await page.waitForFunction(
      () => !window.__NEON_TEST__.state.paused && window.__NEON_TEST__.state.buildPhase,
      null,
      { timeout: 10000 }
    );
  }
}
await page.waitForFunction(
  () => !document.getElementById('resultModal').classList.contains('hidden'),
  null,
  { timeout: 90000 }
);
await page.screenshot({ path: `${out}/04-release-result.png` });
const fullRun = await page.evaluate(() => ({
  wave: window.__NEON_TEST__.state.wave,
  hp: window.__NEON_TEST__.state.hp,
  kills: window.__NEON_TEST__.state.kills,
  title: document.getElementById('resultTitle').textContent,
  resultVisible: !document.getElementById('resultModal').classList.contains('hidden'),
  pathPoints: window.__NEON_TEST__.level.path.length,
  slots: window.__NEON_TEST__.level.slots.length
}));
if (fullRun.wave !== 5 || !fullRun.resultVisible || !fullRun.title.includes('SECURED')) {
  errors.push(`five-wave run failed: ${JSON.stringify(fullRun)}`);
}
if (fullRun.pathPoints !== 18 || fullRun.slots !== 9) errors.push(`authored geometry changed: ${JSON.stringify(fullRun)}`);

await page.setViewportSize({ width: 1280, height: 720 });
await openGame('?qa=built');
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
await page.screenshot({ path: `${out}/05-release-responsive-1280x720.png` });
if (
  Math.abs(responsive.shellWidth - 1280) > 1 ||
  Math.abs(responsive.shellHeight - 720) > 1 ||
  responsive.scrollWidth > responsive.innerWidth ||
  responsive.scrollHeight > responsive.innerHeight
) {
  errors.push(`responsive layout failed: ${JSON.stringify(responsive)}`);
}

const report = { errors, assetReport, dragPreview, dragResult, fullRun, responsive };
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
