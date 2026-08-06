import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/combat-balance';
const EXPECTED_RANGES={rail:240,cryo:225,plasma:215,arcane:265};
const VIEWPORTS=[
  {name:'1600x900',width:1600,height:900},
  {name:'1280x720',width:1280,height:720},
  {name:'844x390',width:844,height:390}
];
await fs.mkdir(out,{recursive:true});

const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
});
const context=await browser.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
page.on('requestfailed',request=>errors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText||'unknown'}`));

async function openGame(){
  await page.goto(`${base}?qa=build&draftSeed=20260806`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(()=>window.__NEON_TEST__?.state?.ready&&window.__RENDERED_MAP_READY&&window.__COMBAT_BALANCE_DIAGNOSTICS?.overlayReady,null,{timeout:45000});
  await page.waitForTimeout(350);
}

await openGame();
const initial=await page.evaluate(()=>({
  ranges:Object.fromEntries(Object.entries(window.__NEON_TEST__.towerTypes).map(([type,def])=>[type,def.range])),
  diagnostics:window.__COMBAT_BALANCE_DIAGNOSTICS,
  overlay:Boolean(document.getElementById('resonance-link-overlay'))
}));
if(JSON.stringify(initial.ranges)!==JSON.stringify(EXPECTED_RANGES)) errors.push(`tower ranges mismatch: ${JSON.stringify(initial.ranges)}`);
if(!initial.overlay) errors.push('resonance overlay missing');
for(const [type,margin] of Object.entries(initial.diagnostics.minimumCoverageMargin||{})){
  if(margin<20) errors.push(`${type} minimum path coverage margin too small: ${margin}`);
}

const attackResults=[];
for(const type of Object.keys(EXPECTED_RANGES)){
  await page.evaluate(type=>{
    const game=window.__NEON_TEST__;
    game.resetGame();
    game.state.credits=9999;
    game.buildTower(type,6);
    const slot=game.level.slots[6];
    let nearest={progress:0,distance:Infinity};
    for(let index=0;index<=2000;index+=1){
      const progress=index/2000;
      const point=game.pathPoint(progress);
      const distance=Math.hypot(point.x-slot.x,point.y-slot.y);
      if(distance<nearest.distance) nearest={progress,distance};
    }
    const enemy=game.createEnemy('boss',20);
    enemy.progress=nearest.progress;
    enemy.alpha=1;
    enemy.spawnScale=1;
    enemy.def={...enemy.def,speed:0};
    game.state.enemies=[enemy];
    game.state.spawnQueue=[];
    game.state.towers[0].cooldown=0;
  },type);
  await page.waitForTimeout(1450);
  const result=await page.evaluate(type=>({
    type,
    totalDamage:window.__NEON_TEST__.state.towers[0]?.totalDamage||0,
    range:window.__NEON_TEST__.towerTypes[type].range
  }),type);
  attackResults.push(result);
  if(result.totalDamage<=0) errors.push(`${type} failed to acquire a target from the most distant platform`);
}

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['cryo',0],['cryo',9],['plasma',1],['plasma',6],['arcane',2],['arcane',8]].forEach(([type,slot])=>game.buildTower(type,slot));
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(500);
const resonance=await page.evaluate(()=>({
  state:{...window.__NEON_TEST__.state.resonance},
  links:window.__COMBAT_BALANCE_DIAGNOSTICS.links,
  counters:{
    frost:document.getElementById('frostCount').textContent,
    energy:document.getElementById('energyCount').textContent,
    arcane:document.getElementById('arcaneCount').textContent
  }
}));
for(const key of ['frost','energy','arcane']){
  if(resonance.state[key]!==1) errors.push(`${key} resonance did not activate: ${JSON.stringify(resonance.state)}`);
  if(resonance.counters[key]!=='2/2') errors.push(`${key} counter incorrect: ${resonance.counters[key]}`);
}
for(const type of ['cryo','plasma','arcane']){
  if(!resonance.links.some(link=>link.type===type)) errors.push(`${type} visual resonance link missing`);
}
await page.screenshot({path:`${out}/resonance-links-1600x900.png`});

const viewportResults=[];
for(const viewport of VIEWPORTS){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.waitForTimeout(220);
  const geometry=await page.evaluate(()=>{
    const rect=element=>{
      const box=element.getBoundingClientRect();
      return {x:box.x,y:box.y,width:box.width,height:box.height};
    };
    return {
      canvas:rect(document.getElementById('game')),
      resonance:rect(document.getElementById('resonance-link-overlay')),
      scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight,
      innerWidth,
      innerHeight
    };
  });
  viewportResults.push({viewport,geometry});
  const fields=['x','y','width','height'];
  for(const field of fields){
    if(Math.abs(geometry.canvas[field]-geometry.resonance[field])>0.75) errors.push(`${viewport.name} overlay ${field} mismatch: ${JSON.stringify(geometry)}`);
  }
  if(geometry.scrollWidth>geometry.innerWidth||geometry.scrollHeight>geometry.innerHeight) errors.push(`${viewport.name} overflow: ${JSON.stringify(geometry)}`);
  await page.screenshot({path:`${out}/resonance-${viewport.name}.png`});
}

const report={errors,initial,attackResults,resonance,viewportResults};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
