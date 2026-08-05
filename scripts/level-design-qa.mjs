import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out = 'artifacts/visual-qa';
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));

await page.goto('http://127.0.0.1:8080/?qa=level&draftSeed=20260805', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_TEST__?.level?.path?.length >= 2, null, { timeout: 20000 });
await page.waitForTimeout(500);

const metrics = await page.evaluate(() => {
  const { level, pathInfo } = window.__NEON_TEST__;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pointSegmentDistance = (p, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2)) : 0;
    return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
  };
  const samplePath = count => Array.from({ length: count + 1 }, (_, index) => {
    const target = pathInfo.total * index / count;
    let segment = pathInfo.seg.at(-1);
    for (const candidate of pathInfo.seg) {
      if (target <= candidate.start + candidate.len) { segment = candidate; break; }
    }
    const t = Math.max(0, Math.min(1, (target - segment.start) / segment.len));
    return { x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t };
  });
  const pathSamples = samplePath(500);
  const coverage = range => {
    const counts = pathSamples.map(point => level.slots.filter(slot => distance(point, slot) <= range).length);
    return {
      covered: counts.filter(count => count > 0).length / counts.length,
      maxOverlap: Math.max(...counts),
      uncovered: counts.filter(count => count === 0).length
    };
  };
  const slotPathDistances = level.slots.map(slot => Math.min(...level.path.slice(0, -1).map((point, index) => pointSegmentDistance(slot, point, level.path[index + 1]))));
  const slotPairs = [];
  for (let i = 0; i < level.slots.length; i += 1) for (let j = i + 1; j < level.slots.length; j += 1) slotPairs.push(distance(level.slots[i], level.slots[j]));
  const turns = [];
  for (let i = 1; i < level.path.length - 1; i += 1) {
    const a = level.path[i - 1], b = level.path[i], c = level.path[i + 1];
    const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    const interior = Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
    turns.push(180 - interior);
  }
  const segmentLengths = pathInfo.seg.map(segment => segment.len);
  const hiddenSlots = level.slots.filter(slot =>
    (slot.x >= 145 && slot.x <= 365 && slot.y >= 80 && slot.y <= 310) ||
    (slot.x >= 1380 && slot.y >= 80 && slot.y <= 390) || slot.y >= 755
  );
  return {
    pathLength: pathInfo.total,
    directDistance: distance(level.path[0], level.path.at(-1)),
    pathPoints: level.path.length,
    slots: level.slots.length,
    zones: level.zones?.length || 0,
    minSlotPathDistance: Math.min(...slotPathDistances),
    maxSlotPathDistance: Math.max(...slotPathDistances),
    minSlotSeparation: Math.min(...slotPairs),
    sharpTurns: turns.filter(angle => angle >= 50).length,
    maxSegment: Math.max(...segmentLengths),
    coverage190: coverage(190),
    coverage205: coverage(205),
    hiddenSlots,
    bounds: {
      minX: Math.min(...level.path.map(point => point.x)), maxX: Math.max(...level.path.map(point => point.x)),
      minY: Math.min(...level.path.map(point => point.y)), maxY: Math.max(...level.path.map(point => point.y))
    },
    core: level.path.at(-1),
    page: { width: innerWidth, height: innerHeight, scrollX: document.documentElement.scrollWidth - innerWidth, scrollY: document.documentElement.scrollHeight - innerHeight }
  };
});

if (metrics.pathLength < 2350 || metrics.pathLength > 2650) errors.push(`path length outside delivery range: ${metrics.pathLength}`);
if (metrics.pathLength / metrics.directDistance < 1.55) errors.push(`route lacks meaningful traversal: ratio ${metrics.pathLength / metrics.directDistance}`);
if (metrics.pathPoints < 18) errors.push(`route has too few control points: ${metrics.pathPoints}`);
if (metrics.slots < 10 || metrics.slots > 12) errors.push(`invalid strategic node count: ${metrics.slots}`);
if (metrics.zones < 5) errors.push(`missing tactical zones: ${metrics.zones}`);
if (metrics.minSlotPathDistance < 78 || metrics.maxSlotPathDistance > 220) errors.push(`tower nodes have invalid path spacing: ${metrics.minSlotPathDistance}–${metrics.maxSlotPathDistance}`);
if (metrics.minSlotSeparation < 95) errors.push(`tower nodes are overcrowded: ${metrics.minSlotSeparation}`);
if (metrics.sharpTurns < 6) errors.push(`route lacks tactical turns: ${metrics.sharpTurns}`);
if (metrics.maxSegment < 190) errors.push(`route lacks a long damage corridor: ${metrics.maxSegment}`);
if (metrics.coverage190.covered < 0.86) errors.push(`standard tower coverage too sparse: ${metrics.coverage190.covered}`);
if (metrics.coverage205.covered < 0.94 || metrics.coverage205.maxOverlap > 3) errors.push(`long-range coverage is unbalanced: ${JSON.stringify(metrics.coverage205)}`);
if (metrics.hiddenSlots.length) errors.push(`tower nodes hidden by HUD: ${JSON.stringify(metrics.hiddenSlots)}`);
if (metrics.bounds.minX > 70 || metrics.bounds.maxX < 1490 || metrics.bounds.minY > 230 || metrics.bounds.maxY < 680) errors.push(`route does not use battlefield: ${JSON.stringify(metrics.bounds)}`);
if (metrics.core.y < 420) errors.push(`core overlaps inspector zone: ${JSON.stringify(metrics.core)}`);
if (metrics.page.scrollX > 0 || metrics.page.scrollY > 0) errors.push(`page overflow: ${JSON.stringify(metrics.page)}`);

await page.screenshot({ path: `${out}/20-level-layout-1600x900.png` });

await page.evaluate(() => {
  const game = window.__NEON_TEST__;
  game.state.credits = 5000;
  [['rail',0],['cryo',2],['plasma',4],['arcane',6],['rail',8],['cryo',9]].forEach(([type, slot]) => game.buildTower(type, slot));
  game.startWave();
  game.state.speed = 2;
});
await page.waitForTimeout(6500);
await page.screenshot({ path: `${out}/21-level-battle-1600x900.png` });

await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(350);
const responsive = await page.evaluate(() => ({
  width: innerWidth, height: innerHeight,
  shell: (() => { const r = document.getElementById('game-shell').getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, top: r.top }; })(),
  scrollX: document.documentElement.scrollWidth - innerWidth,
  scrollY: document.documentElement.scrollHeight - innerHeight
}));
if (responsive.scrollX > 0 || responsive.scrollY > 0) errors.push(`responsive overflow: ${JSON.stringify(responsive)}`);
await page.screenshot({ path: `${out}/22-level-layout-1280x720.png` });

await fs.writeFile(`${out}/level-design-report.json`, JSON.stringify({ errors, metrics, responsive }, null, 2));
await browser.close();

if (errors.length) {
  console.error(JSON.stringify({ errors, metrics, responsive }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ errors, metrics, responsive }, null, 2));
