import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/combat-balance';
const EXPECTED_RANGES={rail:240,cryo:225,plasma:215,arcane:265};
const EXPECTED_RESONANCE_RANGES={cryo:360,plasma:350,arcane:420};
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
  await page.waitForFunction(()=>window.__NEON_TEST__?.state?.ready&&window.__RENDERED_MAP_READY&&window.__COMBAT_BALANCE_DIAGNOSTICS?.version===2&&window.__COMBAT_BALANCE_DIAGNOSTICS?.overlayReady,null,{timeout:45000});
  await page.waitForTimeout(350);
}

async function refresh(){
  await page.evaluate(()=>window.__COMBAT_BALANCE__.refresh());
  await page.waitForTimeout(120);
}

await openGame();
const initial=await page.evaluate(()=>({
  ranges:Object.fromEntries(Object.entries(window.__NEON_TEST__.towerTypes).map(([type,def])=>[type,def.range])),
  resonanceRanges:window.__COMBAT_BALANCE__.resonanceRanges,
  diagnostics:window.__COMBAT_BALANCE_DIAGNOSTICS,
  overlay:Boolean(document.getElementById('resonance-link-overlay')),
  counters:Object.fromEntries(['frostCount','energyCount','arcaneCount'].map(id=>{
    const element=document.getElementById(id);
    return [id,{text:element.textContent,display:getComputedStyle(element).display}];
  }))
}));
if(JSON.stringify(initial.ranges)!==JSON.stringify(EXPECTED_RANGES)) errors.push(`tower ranges mismatch: ${JSON.stringify(initial.ranges)}`);
if(JSON.stringify(initial.resonanceRanges)!==JSON.stringify(EXPECTED_RESONANCE_RANGES)) errors.push(`resonance ranges mismatch: ${JSON.stringify(initial.resonanceRanges)}`);
if(!initial.overlay) errors.push('resonance overlay missing');
for(const [type,radius] of Object.entries(initial.resonanceRanges)){
  if(radius<=initial.ranges[type]) errors.push(`${type} resonance range must exceed attack range: ${radius} <= ${initial.ranges[type]}`);
  if(radius/initial.ranges[type]<1.35) errors.push(`${type} resonance range separation is too small: ${radius/initial.ranges[type]}`);
}
for(const [type,margin] of Object.entries(initial.diagnostics.minimumCoverageMargin||{})){
  if(margin<20) errors.push(`${type} minimum path coverage margin too small: ${margin}`);
}
for(const [id,counter] of Object.entries(initial.counters)){
  if(counter.display!=='none'||counter.text!=='') errors.push(`${id} numeric counter still visible: ${JSON.stringify(counter)}`);
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

const pairCases=[
  {type:'cryo',stateKey:'frost',inside:[0,1],outside:4},
  {type:'plasma',stateKey:'energy',inside:[5,7],outside:6},
  {type:'arcane',stateKey:'arcane',inside:[4,6],outside:8}
];
const pairResults=[];
for(const pairCase of pairCases){
  const result=await page.evaluate(pairCase=>{
    const game=window.__NEON_TEST__;
    game.resetGame();
    game.state.credits=9999;
    game.buildTower(pairCase.type,pairCase.inside[0]);
    game.buildTower(pairCase.type,pairCase.inside[1]);
    game.state.selectedTower=game.state.towers[0];
    window.__COMBAT_BALANCE__.refresh();
    const inside={
      state:game.state.resonance[pairCase.stateKey],
      links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.filter(link=>link.type===pairCase.type),
      guide:window.__COMBAT_BALANCE_DIAGNOSTICS.guide
    };
    game.state.towers[1].slot=pairCase.outside;
    window.__COMBAT_BALANCE__.refresh();
    const outside={
      state:game.state.resonance[pairCase.stateKey],
      links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.filter(link=>link.type===pairCase.type)
    };
    return {pairCase,inside,outside};
  },pairCase);
  pairResults.push(result);
  if(result.inside.state!==1||result.inside.links.length<1) errors.push(`${pairCase.type} did not connect inside resonance range: ${JSON.stringify(result)}`);
  if(result.inside.links.some(link=>link.distance>link.radius)) errors.push(`${pairCase.type} produced an over-range link: ${JSON.stringify(result.inside.links)}`);
  if(result.outside.state!==0||result.outside.links.length) errors.push(`${pairCase.type} stayed connected outside resonance range: ${JSON.stringify(result)}`);
  if(result.inside.guide?.radius!==EXPECTED_RESONANCE_RANGES[pairCase.type]) errors.push(`${pairCase.type} range guide missing or incorrect: ${JSON.stringify(result.inside.guide)}`);
}

// Use the real pointer drag path to verify that resonance breaks and reconnects spatially.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  game.buildTower('cryo',0);
  game.buildTower('cryo',1);
  game.state.selectedTower=game.state.towers[0];
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(220);
await page.screenshot({path:`${out}/01-spatial-resonance-in-range-1600x900.png`});

const canvas=page.locator('#game');
const canvasBox=await canvas.boundingBox();
if(!canvasBox) throw new Error('Canvas unavailable for spatial resonance QA');
const toViewport=({x,y})=>({
  x:canvasBox.x+(x/1600)*canvasBox.width,
  y:canvasBox.y+(y/900)*canvasBox.height
});
const dragPoints=await page.evaluate(()=>({
  from:window.__NEON_TEST__.level.slots[1],
  outside:window.__NEON_TEST__.level.slots[4],
  inside:window.__NEON_TEST__.level.slots[3]
}));

const from=toViewport(dragPoints.from);
const outside=toViewport(dragPoints.outside);
await page.mouse.move(from.x,from.y);
await page.mouse.down();
await page.mouse.move(outside.x,outside.y,{steps:18});
await page.waitForTimeout(220);
const dragOutside=await page.evaluate(()=>({
  dragMoved:Boolean(window.__NEON_TEST__.state.drag?.moved),
  hoverSlot:window.__NEON_TEST__.state.hoverSlot,
  resonance:window.__NEON_TEST__.state.resonance.frost,
  links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.filter(link=>link.type==='cryo'),
  guide:window.__COMBAT_BALANCE_DIAGNOSTICS.guide
}));
await page.screenshot({path:`${out}/02-spatial-resonance-drag-outside.png`});
if(!dragOutside.dragMoved||dragOutside.hoverSlot!==4||dragOutside.resonance!==0||dragOutside.links.length){
  errors.push(`dragging outside resonance range did not break the link: ${JSON.stringify(dragOutside)}`);
}
await page.mouse.up();
await page.waitForTimeout(420);
const droppedOutside=await page.evaluate(()=>({
  slots:window.__NEON_TEST__.state.towers.filter(tower=>tower.type==='cryo').map(tower=>tower.slot).sort((a,b)=>a-b),
  resonance:window.__NEON_TEST__.state.resonance.frost,
  links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.filter(link=>link.type==='cryo')
}));
if(JSON.stringify(droppedOutside.slots)!==JSON.stringify([0,4])||droppedOutside.resonance!==0||droppedOutside.links.length){
  errors.push(`outside drop state incorrect: ${JSON.stringify(droppedOutside)}`);
}

const outsideFrom=toViewport(dragPoints.outside);
const inside=toViewport(dragPoints.inside);
await page.mouse.move(outsideFrom.x,outsideFrom.y);
await page.mouse.down();
await page.mouse.move(inside.x,inside.y,{steps:18});
await page.waitForTimeout(220);
const dragInside=await page.evaluate(()=>({
  dragMoved:Boolean(window.__NEON_TEST__.state.drag?.moved),
  hoverSlot:window.__NEON_TEST__.state.hoverSlot,
  resonance:window.__NEON_TEST__.state.resonance.frost,
  links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.filter(link=>link.type==='cryo')
}));
if(!dragInside.dragMoved||dragInside.hoverSlot!==3||dragInside.resonance!==1||!dragInside.links.length){
  errors.push(`dragging back inside resonance range did not reconnect: ${JSON.stringify(dragInside)}`);
}
await page.mouse.up();
await page.waitForTimeout(420);
const droppedInside=await page.evaluate(()=>({
  slots:window.__NEON_TEST__.state.towers.filter(tower=>tower.type==='cryo').map(tower=>tower.slot).sort((a,b)=>a-b),
  resonance:window.__NEON_TEST__.state.resonance.frost,
  links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.filter(link=>link.type==='cryo')
}));
if(JSON.stringify(droppedInside.slots)!==JSON.stringify([0,3])||droppedInside.resonance!==1||!droppedInside.links.length){
  errors.push(`inside drop state incorrect: ${JSON.stringify(droppedInside)}`);
}

// Build three actual in-range networks for visual and responsive inspection.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['cryo',0],['cryo',1],['plasma',5],['plasma',7],['arcane',4],['arcane',6]].forEach(([type,slot])=>game.buildTower(type,slot));
  game.state.selectedTower=game.state.towers[0];
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(350);
const resonance=await page.evaluate(()=>({
  state:{...window.__NEON_TEST__.state.resonance},
  links:window.__COMBAT_BALANCE_DIAGNOSTICS.links,
  guide:window.__COMBAT_BALANCE_DIAGNOSTICS.guide,
  counters:Object.fromEntries(['frostCount','energyCount','arcaneCount'].map(id=>{
    const element=document.getElementById(id);
    return [id,{text:element.textContent,display:getComputedStyle(element).display}];
  }))
}));
for(const key of ['frost','energy','arcane']){
  if(resonance.state[key]!==1) errors.push(`${key} spatial resonance did not activate: ${JSON.stringify(resonance.state)}`);
}
for(const type of ['cryo','plasma','arcane']){
  if(!resonance.links.some(link=>link.type===type)) errors.push(`${type} visual resonance link missing`);
}
for(const [id,counter] of Object.entries(resonance.counters)){
  if(counter.display!=='none'||counter.text!=='') errors.push(`${id} numeric counter reappeared: ${JSON.stringify(counter)}`);
}
await page.screenshot({path:`${out}/03-spatial-resonance-networks-1600x900.png`});

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
      links:window.__COMBAT_BALANCE_DIAGNOSTICS.links.length,
      guide:window.__COMBAT_BALANCE_DIAGNOSTICS.guide,
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
  if(geometry.links<3) errors.push(`${viewport.name} resonance links disappeared: ${JSON.stringify(geometry)}`);
  if(geometry.scrollWidth>geometry.innerWidth||geometry.scrollHeight>geometry.innerHeight) errors.push(`${viewport.name} overflow: ${JSON.stringify(geometry)}`);
  await page.screenshot({path:`${out}/04-spatial-resonance-${viewport.name}.png`});
}

const report={errors,initial,attackResults,pairResults,dragOutside,droppedOutside,dragInside,droppedInside,resonance,viewportResults};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
