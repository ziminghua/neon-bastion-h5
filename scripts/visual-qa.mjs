import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts/visual-qa', { recursive: true });
await fs.cp('assets', 'artifacts/visual-qa/assets', { recursive: true });
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

await page.goto('http://127.0.0.1:8080/asset-preview.html', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 20000 });
await page.screenshot({ path: 'artifacts/visual-qa/00-assets.png', fullPage: true });
const assetSummary = await page.locator('#summary').textContent();

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/visual-qa/01-intro.png' });
await page.locator('#enterBtn').click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'artifacts/visual-qa/02-build.png' });

const stage = page.locator('#stage');
const box = await stage.boundingBox();
if (!box) throw new Error('Stage not visible');
const clickStage = async (x, y) => page.mouse.click(box.x + x / 1600 * box.width, box.y + y / 900 * box.height);
await clickStage(360, 390);
await page.waitForTimeout(300);
await page.locator('[data-type="cryo"]').click();
await clickStage(535, 350);
await page.waitForTimeout(300);
await page.screenshot({ path: 'artifacts/visual-qa/03-built.png' });
await page.locator('#startWaveBtn').click();
await page.waitForTimeout(4500);
await page.screenshot({ path: 'artifacts/visual-qa/04-battle.png' });

const result = {
  assetSummary,
  errors,
  viewport: await page.evaluate(() => ({
    innerWidth, innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }))
};
if (!assetSummary?.includes('0 failed')) errors.push(`asset summary: ${assetSummary}`);
await fs.writeFile('artifacts/visual-qa/report.json', JSON.stringify(result, null, 2));
if (errors.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
await browser.close();
