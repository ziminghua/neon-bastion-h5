import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/combat-balance';
const EXPECTED_RANGES={rail:240,cryo:225,plasma:215,arcane:265};
const EXPECTED_RESONANCE={rail:340,cryo:360,plasma:350,arcane:420};
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

async function slotScreenPoint(slotIndex){
  return page.evaluate(index=>{
    const game=window.__NEON_TEST__;
    const slot=game.level.slots[index];
    const rect=document.getElementById('game').getBoundingClientRect();
    return {
      x:rect.left+slot.x/1600*rect.width,
      y:rect.top+slot.y/900*rect.height
    };
  },slotIndex);
}

async function dragSlot(fromSlot,toSlot,hold=180){
  const from=await slotScreenPoint(fromSlot);
  const to=await slotScreenPoint(toSlot);
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move((from.x+to.x)/2,(from.y+to.y)/2,{steps:8});
  await page.mouse.move(to.x,to.y,{steps:10});
  await page.waitForTimeout(hold);
  return {from,to};
}

await openGame();
const initial=await page.evaluate(()=>({
  ranges:Object.fromEntries(Object.entries(window.__NEON_TEST__.towerTypes).map(([type,def])=>[type,def.range])),
  diagnostics:window.__COMBAT_BALANCE__.snapshot(),
  overlay:Boolean(document.getElementById('resonance-link-overlay')),
  upgrade:{
    hidden:document.getElementById('upgradeBtn').hidden,
    disabled:document.getElementById('upgradeBtn').disabled,
    display:getComputedStyle(document.getElementById('upgradeBtn')).display,
    note:Boolean(document.querySelector('.merge-upgrade-note'))
  },
  counters:['frostCount','energyCount','arcaneCount'].map(id=>({id,text:document.getElementById(id).textContent,display:getComputedStyle(document.getElementById(id)).display}))
}));
if(JSON.stringify(initial.ranges)!==JSON.stringify(EXPECTED_RANGES)) errors.push(`tower ranges mismatch: ${JSON.stringify(initial.ranges)}`);
if(JSON.stringify(initial.diagnostics.resonanceRanges)!==JSON.stringify(EXPECTED_RESONANCE)) errors.push(`resonance ranges mismatch: ${JSON.stringify(initial.diagnostics.resonanceRanges)}`);
if(!initial.overlay) errors.push('resonance overlay missing');
if(!initial.upgrade.hidden||!initial.upgrade.disabled||initial.upgrade.display!=='none'||!initial.upgrade.note) errors.push(`merge-only UI not installed: ${JSON.stringify(initial.upgrade)}`);
for(const counter of initial.counters){
  if(counter.text.trim()||counter.display!=='none') errors.push(`numeric resonance counter remains visible: ${JSON.stringify(counter)}`);
}
for(const type of Object.keys(EXPECTED_RANGES)){
  if(EXPECTED_RESONANCE[type]<=EXPECTED_RANGES[type]) errors.push(`${type} resonance radius is not greater than attack range`);
}
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
  game.buildTower('cryo',1);
  game.buildTower('cryo',3);
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(250);
const sameType=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
if(sameType.links.length!==0) errors.push(`same-type towers incorrectly resonated: ${JSON.stringify(sameType.links)}`);
if(sameType.towerStacks.some(entry=>entry.stack!==0)) errors.push(`same-type towers received stacks: ${JSON.stringify(sameType.towerStacks)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  game.buildTower('rail',1);
  game.buildTower('cryo',3);
  game.state.selectedTower=null;
  game.state.selectedBuild=null;
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(450);
const mixedPair=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
if(mixedPair.links.length!==1) errors.push(`rail + cryo pair did not create exactly one link: ${JSON.stringify(mixedPair.links)}`);
if(!mixedPair.links.some(link=>new Set([link.fromType,link.toType]).has('rail')&&new Set([link.fromType,link.toType]).has('cryo'))) errors.push(`rail + cryo link missing: ${JSON.stringify(mixedPair.links)}`);
if(mixedPair.towerStacks.some(entry=>entry.stack!==1)) errors.push(`two-type network should give stack 1: ${JSON.stringify(mixedPair.towerStacks)}`);
const pairTowerDamage=Object.fromEntries(mixedPair.towerStacks.map(entry=>[entry.type,entry.damage]));
if(!(pairTowerDamage.rail>13&&pairTowerDamage.cryo>8)) errors.push(`mixed resonance did not apply damage stack: ${JSON.stringify(pairTowerDamage)}`);
await page.screenshot({path:`${out}/01-rail-cryo-cross-type-link.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['rail',1],['cryo',3],['plasma',5],['arcane',7]].forEach(([type,slot])=>game.buildTower(type,slot));
  game.state.selectedTower=null;
  game.state.selectedBuild=null;
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(450);
const stackedNetwork=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
if(stackedNetwork.links.length!==3) errors.push(`four-type network should use three links: ${JSON.stringify(stackedNetwork.links)}`);
if(stackedNetwork.towerStacks.some(entry=>entry.stack!==3)) errors.push(`four unique types should give stack 3: ${JSON.stringify(stackedNetwork.towerStacks)}`);
await page.screenshot({path:`${out}/02-four-type-stacked-network.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  game.buildTower('rail',1);
  game.buildTower('cryo',3);
  game.state.selectedTower=null;
  game.state.selectedBuild=null;
});
await page.waitForTimeout(220);
await dragSlot(3,9);
await page.waitForTimeout(180);
const duringDrag=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
if(duringDrag.links.length!==0) errors.push(`cross-type link remained active outside radius during drag: ${JSON.stringify(duringDrag.links)}`);
await page.screenshot({path:`${out}/03-cross-type-link-broken-during-drag.png`});
await page.mouse.up();
await page.waitForTimeout(300);
const afterDrop=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
if(afterDrop.links.length!==0) errors.push(`cross-type link remained active after out-of-range drop: ${JSON.stringify(afterDrop.links)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  game.buildTower('cryo',1);
  game.buildTower('cryo',3);
  game.state.selectedTower=game.state.towers[0];
  const before={level:game.state.towers[0].level,credits:game.state.credits,count:game.state.towers.length};
  document.getElementById('upgradeBtn').click();
  window.__upgradeClickProbe={before,after:{level:game.state.towers[0].level,credits:game.state.credits,count:game.state.towers.length}};
});
await page.waitForTimeout(100);
const clickProbe=await page.evaluate(()=>window.__upgradeClickProbe);
if(JSON.stringify(clickProbe.before)!==JSON.stringify(clickProbe.after)) errors.push(`hidden upgrade button changed progression: ${JSON.stringify(clickProbe)}`);
await dragSlot(1,3,120);
await page.mouse.up();
await page.waitForTimeout(350);
const mergeResult=await page.evaluate(()=>({
  towers:window.__NEON_TEST__.state.towers.map(tower=>({type:tower.type,level:tower.level,slot:tower.slot})),
  upgrade:{hidden:document.getElementById('upgradeBtn').hidden,disabled:document.getElementById('upgradeBtn').disabled}
}));
if(mergeResult.towers.length!==1||mergeResult.towers[0].type!=='cryo'||mergeResult.towers[0].level!==2) errors.push(`identical towers failed to merge-upgrade: ${JSON.stringify(mergeResult)}`);
await page.screenshot({path:`${out}/04-merge-only-level-two.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['rail',1],['cryo',3],['plasma',5],['arcane',7]].forEach(([type,slot])=>game.buildTower(type,slot));
  game.state.selectedTower=null;
  game.state.selectedBuild=null;
});
await page.waitForTimeout(300);

const viewportResults=[];
for(const viewport of VIEWPORTS){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.waitForTimeout(240);
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
  for(const field of ['x','y','width','height']){
    if(Math.abs(geometry.canvas[field]-geometry.resonance[field])>0.75) errors.push(`${viewport.name} overlay ${field} mismatch: ${JSON.stringify(geometry)}`);
  }
  if(geometry.scrollWidth>geometry.innerWidth||geometry.scrollHeight>geometry.innerHeight) errors.push(`${viewport.name} overflow: ${JSON.stringify(geometry)}`);
  await page.screenshot({path:`${out}/responsive-${viewport.name}.png`});
}

const report={errors,initial,attackResults,sameType,mixedPair,stackedNetwork,duringDrag,afterDrop,clickProbe,mergeResult,viewportResults};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
