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

await page.goto('http://127.0.0.1:8080/?qa=layout&draftSeed=20260805', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_DRAFT__ && document.querySelector('.bottom-deck.three-zone-draft-dock'), null, { timeout: 20000 });
await page.waitForTimeout(400);

async function snapshot() {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const visible = selector => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
    };
    const next = document.querySelector('#draftNext');
    const reroll = document.querySelector('#draftReroll');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      deck: rect('.three-zone-draft-dock'),
      primary: rect('.draft-zone-primary'),
      signal: rect('.draft-zone-signal'),
      combat: rect('.draft-zone-combat'),
      current: rect('.tower-card.draft-current'),
      next: rect('#draftNext'),
      reroll: rect('#draftReroll'),
      emp: rect('#empBtn'),
      start: rect('#startWaveBtn'),
      rerollInsideNext: Boolean(next && reroll && next.contains(reroll)),
      visible: {
        current: visible('.tower-card.draft-current'),
        nextImage: visible('#draftNext img'),
        reroll: visible('#draftReroll'),
        emp: visible('#empBtn'),
        start: visible('#startWaveBtn')
      },
      scroll: {
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight
      }
    };
  });
}

function validate(layout, label) {
  for (const key of ['deck', 'primary', 'signal', 'combat', 'current', 'next', 'reroll', 'emp', 'start']) {
    if (!layout[key]) errors.push(`${label}: missing ${key}`);
  }
  if (!layout.deck || !layout.primary || !layout.signal || !layout.combat) return;

  if (layout.deck.width > layout.viewport.width * 0.62) errors.push(`${label}: dock still too wide (${layout.deck.width}px)`);
  if (layout.primary.right > layout.signal.left + 1) errors.push(`${label}: primary and signal zones overlap`);
  if (layout.signal.right > layout.combat.left + 1) errors.push(`${label}: signal and combat zones overlap`);
  if (Math.abs(layout.primary.height - layout.signal.height) > 2 || Math.abs(layout.signal.height - layout.combat.height) > 2) {
    errors.push(`${label}: zone heights are inconsistent`);
  }
  if (layout.current.width > layout.primary.width || layout.next.width > layout.signal.width) errors.push(`${label}: content escapes its zone`);
  if (!layout.rerollInsideNext) errors.push(`${label}: reroll control is not integrated into the next-tower card`);
  if (layout.reroll && layout.next && (
    layout.reroll.left < layout.next.left || layout.reroll.right > layout.next.right ||
    layout.reroll.top < layout.next.top || layout.reroll.bottom > layout.next.bottom
  )) errors.push(`${label}: reroll control escapes the next-tower card`);
  for (const [key, isVisible] of Object.entries(layout.visible)) {
    if (!isVisible) errors.push(`${label}: ${key} is not visible`);
  }
  if (layout.scroll.x > 0 || layout.scroll.y > 0) errors.push(`${label}: page overflow ${JSON.stringify(layout.scroll)}`);
}

const desktop = await snapshot();
validate(desktop, '1600x900');
await page.screenshot({ path: `${out}/14-three-zone-dock-1600x900.png` });

await page.setViewportSize({ width: 1280, height: 720 });
await page.waitForTimeout(300);
const responsive = await snapshot();
validate(responsive, '1280x720');
await page.screenshot({ path: `${out}/15-three-zone-dock-1280x720.png` });

const report = { errors, desktop, responsive };
await fs.writeFile(`${out}/draft-layout-report.json`, JSON.stringify(report, null, 2));
await browser.close();

if (errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
