import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out='artifacts/scene-smoke';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8080/?qa=build&draftSeed=20260805',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__NEON_TEST__?.state?.ready&&window.__RENDERED_MAP_READY,{timeout:20000});
await page.waitForTimeout(350);
await page.screenshot({path:`${out}/rendered-map-build-1600x900.png`});
await page.evaluate(()=>{
  const g=window.__NEON_TEST__;
  g.state.credits=5000;
  [['rail',0],['cryo',3],['plasma',6],['arcane',7]].forEach(([type,slot])=>g.buildTower(type,slot));
  g.startWave();
});
await page.waitForTimeout(2600);
await page.screenshot({path:`${out}/rendered-map-battle-1600x900.png`});
const result=await page.evaluate(()=>({
  ready:window.__NEON_TEST__.state.ready,
  renderedMap:window.__RENDERED_MAP_READY===true,
  pathPoints:window.__NEON_TEST__.level.path.length,
  slots:window.__NEON_TEST__.level.slots.length,
  towers:window.__NEON_TEST__.state.towers.length,
  enemies:window.__NEON_TEST__.state.enemies.length,
  assetFailures:window.__assetLoadFailures||[],
  overflow:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]
}));
if(!result.ready||!result.renderedMap||result.pathPoints<15||result.slots<8||result.towers<4||result.assetFailures.length||result.overflow.some(v=>v>0))errors.push(JSON.stringify(result));
await fs.writeFile(`${out}/report.json`,JSON.stringify({errors,result},null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify({errors,result},null,2));process.exit(1)}
console.log(JSON.stringify(result,null,2));
