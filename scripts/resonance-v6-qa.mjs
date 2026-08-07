import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/resonance-v6';
const BUILD='fusion-network-v6-20260807';
const EXPECTED_DAMAGE={rail:13,cryo:8,plasma:23,arcane:16};
const EXPECTED_INTERVAL={rail:.48,cryo:.95,plasma:1.16,arcane:.86};
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

async function dragSlot(fromSlot,toSlot){
  const from=await slotScreenPoint(fromSlot);
  const to=await slotScreenPoint(toSlot);
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move((from.x+to.x)/2,(from.y+to.y)/2,{steps:8});
  await page.mouse.move(to.x,to.y,{steps:12});
  await page.waitForTimeout(220);
  await page.mouse.up();
  await page.waitForTimeout(420);
}

await page.goto(`${base}?qa=build&draftSeed=20260807&resonanceV6Qa=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(expected=>
  window.__NEON_TEST__?.state?.ready&&
  window.__FUSION_RESONANCE_RUNTIME?.ready&&
  window.__FUSION_RESONANCE_RUNTIME.build===expected&&
  window.__RESONANCE_BOARD_RUNTIME?.ready&&
  window.__RESONANCE_BOARD_RUNTIME.build===expected,
BUILD,{timeout:45000});
await page.waitForTimeout(350);

const loaded=await page.evaluate(expected=>({
  expected,
  scripts:[...document.scripts].map(script=>script.src).filter(Boolean),
  runtime:{...window.__FUSION_RESONANCE_RUNTIME},
  board:{...window.__RESONANCE_BOARD_RUNTIME},
  diagnostics:window.__COMBAT_BALANCE__.snapshot()
}),BUILD);
for(const expectedFile of ['combat-bootstrap-v6.js','fusion-resonance-v6.js','resonance-board-network-v6.js']){
  const source=loaded.scripts.find(item=>item.includes(expectedFile))||'';
  if(!source.includes(`build=${BUILD}`)) errors.push(`missing/stale v6 script ${expectedFile}: ${source}`);
}
for(const legacy of ['combat-balance.js','fusion-resonance-v5.js','resonance-board-network.js']){
  if(loaded.scripts.some(item=>item.includes(`/${legacy}`))) errors.push(`legacy resonance runtime still loaded: ${legacy}`);
}
if(loaded.diagnostics.version!==6) errors.push(`diagnostics version mismatch: ${loaded.diagnostics.version}`);
if(loaded.runtime.policy!=='per-tower-all-partners') errors.push(`runtime policy mismatch: ${JSON.stringify(loaded.runtime)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['rail',4],['cryo',8],['plasma',3],['arcane',7]].forEach(([type,slot])=>game.buildTower(type,slot));
  game.state.selectedBuild=null;
  game.state.selectedTower=null;
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(350);
const beforeDrag=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
const arcaneBefore=beforeDrag.towers.find(tower=>tower.type==='arcane');
if(arcaneBefore?.linkCount!==1) errors.push(`control topology should begin with one Arcane partner, got ${JSON.stringify(arcaneBefore)}`);
await page.screenshot({path:`${out}/01-before-real-drag-one-link.png`});

await dragSlot(7,5);
await page.waitForFunction(()=>{
  const snapshot=window.__COMBAT_BALANCE__.snapshot();
  return snapshot.towers.find(tower=>tower.type==='arcane'&&tower.slot===5)?.linkCount===3;
},null,{timeout:5000});
await page.waitForTimeout(250);

const afterDrag=await page.evaluate(()=>({
  diagnostics:window.__COMBAT_BALANCE__.snapshot(),
  board:{...window.__RESONANCE_BOARD_RUNTIME},
  towers:window.__NEON_TEST__.state.towers.map(tower=>({
    type:tower.type,slot:tower.slot,level:tower.level,damage:tower.def.damage,interval:tower.def.interval,
    linkCount:tower.__fusionProfile?.linkCount||0,
    counts:{...(tower.__fusionProfile?.counts||{})}
  }))
}));
const arcaneAfter=afterDrag.towers.find(tower=>tower.type==='arcane');
if(arcaneAfter?.slot!==5) errors.push(`real drag did not move Arcane to slot 5: ${JSON.stringify(arcaneAfter)}`);
if(arcaneAfter?.linkCount!==3) errors.push(`Arcane range contains Rail/Cryo/Plasma but did not receive three fusions: ${JSON.stringify(arcaneAfter)}`);
for(const type of ['rail','cryo','plasma']){
  if(arcaneAfter?.counts?.[type]!==1) errors.push(`Arcane missing ${type} fusion after real drag: ${JSON.stringify(arcaneAfter)}`);
}
if(afterDrag.board.visibleLinkCount!==3) errors.push(`board did not render all three Arcane pair links: ${JSON.stringify(afterDrag.board)}`);
const directional=afterDrag.diagnostics.links.filter(link=>link.fromType==='arcane'||link.toType==='arcane');
if(directional.length!==3) errors.push(`expected three Arcane link records: ${JSON.stringify(directional)}`);
const railArcane=directional.find(link=>new Set([link.fromType,link.toType]).has('rail'));
const cryoArcane=directional.find(link=>new Set([link.fromType,link.toType]).has('cryo'));
if(!railArcane||railArcane.mutual!==false) errors.push(`Rail/Arcane should prove per-tower directional radius semantics: ${JSON.stringify(railArcane)}`);
if(!cryoArcane||cryoArcane.mutual!==false) errors.push(`Cryo/Arcane should prove per-tower directional radius semantics: ${JSON.stringify(cryoArcane)}`);
for(const tower of afterDrag.towers){
  if(Math.abs(tower.damage-EXPECTED_DAMAGE[tower.type])>.001) errors.push(`${tower.type} received generic resonance damage: ${tower.damage}`);
  if(Math.abs(tower.interval-EXPECTED_INTERVAL[tower.type])>.001) errors.push(`${tower.type} received generic resonance fire-rate boost: ${tower.interval}`);
}
await page.screenshot({path:`${out}/02-after-real-drag-three-links.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.selectedTower=game.state.towers.find(tower=>tower.type==='arcane');
  game.state.selectedBuild=null;
});
await page.waitForTimeout(250);
const selected=await page.evaluate(()=>({
  guide:window.__COMBAT_BALANCE__.snapshot().guide,
  board:{...window.__RESONANCE_BOARD_RUNTIME}
}));
if(selected.guide?.type!=='arcane'||selected.guide?.mode!=='selected'||selected.guide?.linkCount!==3) errors.push(`selected Arcane did not report three fusion links: ${JSON.stringify(selected)}`);
if(selected.board.visibleLinkCount!==3) errors.push(`selecting Arcane hid links: ${JSON.stringify(selected)}`);
await page.screenshot({path:`${out}/03-selected-arcane-three-links.png`});

const projectileProbe=await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const tower=game.state.towers.find(item=>item.type==='arcane');
  const slot=game.level.slots[tower.slot];
  let nearest={progress:0,distance:Infinity};
  for(let index=0;index<=2000;index+=1){
    const progress=index/2000;
    const point=game.pathPoint(progress);
    const distance=Math.hypot(point.x-slot.x,point.y-slot.y);
    if(distance<nearest.distance) nearest={progress,distance};
  }
  const target=game.createEnemy('boss',8);
  target.progress=nearest.progress;
  target.alpha=1;target.spawnScale=1;target.def={...target.def,speed:0};
  game.state.enemies=[target];
  game.state.spawnQueue=[];
  const before=game.state.projectiles.length;
  game.fireTower(tower,target);
  const projectile=game.state.projectiles.slice(before).find(item=>!item.__fusionGenerated);
  return {
    towerProfile:{linkCount:tower.__fusionProfile.linkCount,counts:{...tower.__fusionProfile.counts}},
    projectile:projectile?{
      type:projectile.type,
      chain:projectile.chain,
      baseChain:tower.__fusionBaseDef.chain,
      fusionProfile:projectile.__fusionProfile
    }:null
  };
});
if(projectileProbe.towerProfile.linkCount!==3) errors.push(`combat profile lost all-partner links: ${JSON.stringify(projectileProbe)}`);
if(projectileProbe.projectile?.type!=='arcane') errors.push(`Arcane projectile probe missing: ${JSON.stringify(projectileProbe)}`);
if(projectileProbe.projectile?.fusionProfile?.counts?.rail!==1||projectileProbe.projectile?.fusionProfile?.counts?.cryo!==1||projectileProbe.projectile?.fusionProfile?.counts?.plasma!==1) errors.push(`projectile did not snapshot all three fusion abilities: ${JSON.stringify(projectileProbe)}`);
if(!(projectileProbe.projectile?.chain>projectileProbe.projectile?.baseChain)) errors.push(`Rail + Arcane Phase Conduit did not extend chain behavior: ${JSON.stringify(projectileProbe)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=9999;
  game.buildTower('cryo',1);game.buildTower('cryo',2);
  game.state.selectedBuild=null;game.state.selectedTower=null;
  window.__COMBAT_BALANCE__.refresh();
});
await page.waitForTimeout(250);
const sameType=await page.evaluate(()=>window.__COMBAT_BALANCE__.snapshot());
if(sameType.links.length!==0) errors.push(`same-type towers incorrectly formed fusion links: ${JSON.stringify(sameType.links)}`);

const viewportResults=[];
for(const viewport of [{width:1600,height:900,name:'1600x900'},{width:1280,height:720,name:'1280x720'},{width:844,height:390,name:'844x390'}]){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.waitForTimeout(180);
  const geometry=await page.evaluate(()=>{
    const rect=id=>{const box=document.getElementById(id).getBoundingClientRect();return{x:box.x,y:box.y,width:box.width,height:box.height};};
    return {
      game:rect('game'),
      guide:rect('resonance-link-overlay'),
      board:rect('resonance-board-network-v6-overlay'),
      innerWidth,innerHeight,
      scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight
    };
  });
  viewportResults.push({viewport,geometry});
  for(const layer of ['guide','board']){
    for(const field of ['x','y','width','height']){
      if(Math.abs(geometry.game[field]-geometry[layer][field])>.75) errors.push(`${viewport.name} ${layer} ${field} mismatch: ${JSON.stringify(geometry)}`);
    }
  }
  if(geometry.scrollWidth>geometry.innerWidth||geometry.scrollHeight>geometry.innerHeight) errors.push(`${viewport.name} overflow: ${JSON.stringify(geometry)}`);
}

const report={errors,loaded,beforeDrag,afterDrag,selected,projectileProbe,sameType,viewportResults};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
