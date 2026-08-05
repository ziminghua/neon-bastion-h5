import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/visual-qa';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('requestfailed',r=>errors.push(`requestfailed: ${r.url()} :: ${r.failure()?.errorText||'unknown'}`));

async function load(){
  await page.goto(`${base}?qa=build&draftSeed=20260805`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__NEON_TEST__?.createEnemy&&window.__NEON_TEST__?.fireTower,null,{timeout:20000});
  await page.evaluate(()=>{const g=window.__NEON_TEST__;g.resetGame();g.state.credits=9999;g.state.enemies=[];g.state.towers=[];g.state.projectiles=[];g.state.beams=[];g.state.rings=[];g.state.runes=[];g.state.decals=[];});
}
async function stage(type,slot,progresses,shotWait,file){
  await load();
  await page.evaluate(({type,slot,progresses})=>{
    const g=window.__NEON_TEST__;g.buildTower(type,slot);g.state.selectedBuild=null;
    const enemies=progresses.map((progress,index)=>{const e=g.createEnemy(index===0?'brute':'drone',1);e.progress=progress;e.alpha=1;e.spawnScale=1;e.hp=999;e.maxHp=999;return e;});
    g.state.enemies.push(...enemies);g.fireTower(g.state.towers[0],enemies[0]);
  },{type,slot,progresses});
  await page.waitForTimeout(shotWait);
  await page.screenshot({path:`${out}/${file}`});
  return page.evaluate(()=>({
    frost:Math.max(0,...window.__NEON_TEST__.state.enemies.map(e=>e.frost||0)),
    beams:window.__NEON_TEST__.state.beams.length,
    rings:window.__NEON_TEST__.state.rings.length,
    runes:window.__NEON_TEST__.state.runes.length,
    decals:window.__NEON_TEST__.state.decals.length,
    projectiles:window.__NEON_TEST__.state.projectiles.length
  }));
}

const rail=await stage('rail',4,[.38],45,'30-vfx-rail.png');
if(!rail.beams&&!rail.rings)errors.push(`rail signature missing: ${JSON.stringify(rail)}`);
const cryo=await stage('cryo',3,[.27],520,'31-vfx-cryo.png');
if(cryo.frost<.3||!cryo.rings||!cryo.decals)errors.push(`cryo signature missing: ${JSON.stringify(cryo)}`);
const plasma=await stage('plasma',6,[.56,.565,.575],620,'32-vfx-plasma.png');
if(!plasma.rings||!plasma.decals)errors.push(`plasma signature missing: ${JSON.stringify(plasma)}`);
const arcane=await stage('arcane',7,[.72,.725,.735],520,'33-vfx-arcane.png');
if(!arcane.runes&&!arcane.beams)errors.push(`arcane signature missing: ${JSON.stringify(arcane)}`);

await load();
await page.evaluate(()=>{
  const g=window.__NEON_TEST__;g.state.credits=9999;
  [['rail',0],['cryo',3],['plasma',6],['arcane',7],['rail',8],['cryo',9]].forEach(([t,s])=>g.buildTower(t,s));
  for(let i=0;i<12;i++){const e=g.createEnemy(i%4===0?'shield':i%3===0?'brute':'drone',1.4);e.progress=.18+i*.045;e.alpha=1;e.spawnScale=1;g.state.enemies.push(e);}g.state.speed=1.5;
});
await page.waitForTimeout(3500);
await page.screenshot({path:`${out}/34-vfx-mixed-combat.png`});
const mixed=await page.evaluate(()=>({towers:window.__NEON_TEST__.state.towers.length,active:window.__NEON_TEST__.state.enemies.length,bodyClass:document.body.className,overflow:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]}));
if(mixed.towers<4||mixed.active<1||!mixed.bodyClass.includes('combat-active')&&window.__NEON_TEST__.state.waveActive)errors.push(`mixed combat state invalid: ${JSON.stringify(mixed)}`);
if(mixed.overflow.some(v=>v>0))errors.push(`mixed combat overflow: ${JSON.stringify(mixed)}`);

const report={errors,rail,cryo,plasma,arcane,mixed};
await fs.writeFile(`${out}/vfx-report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(JSON.stringify(report,null,2));
