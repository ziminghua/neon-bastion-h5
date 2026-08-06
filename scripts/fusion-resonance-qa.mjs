import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/fusion-resonance';
const BUILD='fusion-network-v5-20260806';
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

await page.goto(`${base}?qa=build&draftSeed=20260806&fusionQa=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(expected=>window.__NEON_TEST__?.state?.ready&&window.__FUSION_RESONANCE_RUNTIME?.ready&&window.__FUSION_RESONANCE_RUNTIME.build===expected&&window.__RESONANCE_BOARD_RUNTIME?.build===expected,BUILD,{timeout:45000});
await page.waitForTimeout(350);

const loaded=await page.evaluate(expected=>({
  expected,
  fusionScript:[...document.scripts].find(script=>script.src.includes('fusion-resonance-v5.js'))?.src||'',
  combatScript:[...document.scripts].find(script=>script.src.includes('combat-balance.js'))?.src||'',
  boardScript:[...document.scripts].find(script=>script.src.includes('resonance-board-network.js'))?.src||'',
  runtime:{...window.__FUSION_RESONANCE_RUNTIME},
  board:{...window.__RESONANCE_BOARD_RUNTIME},
  diagnostics:window.__COMBAT_BALANCE__.snapshot()
}),BUILD);
for(const source of [loaded.fusionScript,loaded.combatScript,loaded.boardScript]){
  if(!source.includes(`build=${BUILD}`)) errors.push(`stale script URL: ${source}`);
}
if(loaded.diagnostics.version!==5) errors.push(`fusion diagnostics version mismatch: ${loaded.diagnostics.version}`);
if(!loaded.diagnostics.fusionChannels?.projectiles||!loaded.diagnostics.fusionChannels?.beams) errors.push(`fusion channels missing: ${JSON.stringify(loaded.diagnostics.fusionChannels)}`);
for(const expected of ['SUPERCONDUCTOR','OVERLOAD BURST','PHASE CONDUIT','THERMAL SHOCK','VOID FLAME','STASIS WEB']){
  if(!Object.values(loaded.runtime.combos||{}).includes(expected)) errors.push(`fusion ability is not registered: ${expected}`);
}

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['rail',1],['cryo',0],['plasma',3],['arcane',5]].forEach(([type,slot])=>game.buildTower(type,slot));
  game.state.selectedBuild=null;
  game.state.selectedTower=null;
});
await page.waitForFunction(()=>window.__COMBAT_BALANCE_DIAGNOSTICS?.version===5&&window.__COMBAT_BALANCE_DIAGNOSTICS.links.length===4,null,{timeout:5000});
await page.waitForTimeout(300);

const network=await page.evaluate(()=>{
  const diagnostics=window.__COMBAT_BALANCE__.snapshot();
  const board=document.getElementById('resonance-board-network-overlay');
  const pixels=board.getContext('2d').getImageData(0,0,board.width,board.height).data;
  let alphaPixels=0;
  for(let index=3;index<pixels.length;index+=4){if(pixels[index]>10)alphaPixels+=1;}
  return {
    diagnostics,
    board:{...window.__RESONANCE_BOARD_RUNTIME},
    alphaPixels,
    towers:window.__NEON_TEST__.state.towers.map(tower=>{
      const profile=tower.__fusionProfile||{};
      return {
        type:tower.type,
        slot:tower.slot,
        damage:tower.def.damage,
        interval:tower.def.interval,
        profile:{
          linkCount:profile.linkCount||0,
          counts:{...(profile.counts||{})},
          diversity:profile.diversity||1,
          combos:(profile.combos||[]).map(combo=>({type:combo.type,count:combo.count,key:combo.key,name:combo.name}))
        }
      };
    })
  };
});
if(network.diagnostics.links.length!==4) errors.push(`expected four all-pair links, got ${JSON.stringify(network.diagnostics.links)}`);
if(network.board.visibleLinkCount!==4) errors.push(`board did not render every valid link: ${JSON.stringify(network.board)}`);
if(network.alphaPixels<1000) errors.push(`all-pair network was not visibly rendered: ${network.alphaPixels}`);
const plasma=network.towers.find(tower=>tower.type==='plasma');
if(plasma?.profile?.linkCount!==3) errors.push(`central plasma should resonate with three towers: ${JSON.stringify(plasma)}`);
for(const tower of network.towers){
  if(Math.abs(tower.damage-EXPECTED_DAMAGE[tower.type])>.001) errors.push(`${tower.type} received generic resonance damage: ${tower.damage}`);
  if(Math.abs(tower.interval-EXPECTED_INTERVAL[tower.type])>.001) errors.push(`${tower.type} received generic resonance fire-rate boost: ${tower.interval}`);
}
const comboNames=new Set(network.diagnostics.links.map(link=>link.comboName));
for(const expected of ['OVERLOAD BURST','THERMAL SHOCK','VOID FLAME','SUPERCONDUCTOR']){
  if(!comboNames.has(expected)) errors.push(`missing in-range fusion combo ${expected}: ${JSON.stringify([...comboNames])}`);
}
await page.screenshot({path:`${out}/01-all-valid-links-idle.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.selectedTower=game.state.towers.find(tower=>tower.type==='plasma');
  game.state.selectedBuild=null;
});
await page.waitForTimeout(220);
const selected=await page.evaluate(()=>({guide:window.__COMBAT_BALANCE__.snapshot().guide,links:window.__RESONANCE_BOARD_RUNTIME.visibleLinkCount}));
if(selected.guide?.mode!=='selected'||selected.guide?.type!=='plasma') errors.push(`selected tower range missing: ${JSON.stringify(selected)}`);
if(selected.links!==4) errors.push(`selecting central tower hid network links: ${JSON.stringify(selected)}`);
await page.screenshot({path:`${out}/02-selected-plasma-three-fusions.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const plasmaTower=game.state.towers.find(tower=>tower.type==='plasma');
  const target=game.createEnemy('brute',3);
  const secondaryA=game.createEnemy('brute',3);
  const secondaryB=game.createEnemy('brute',3);
  target.progress=.29;
  const targetPos=game.pathPoint(target.progress);
  const candidates=[];
  for(let index=0;index<=1000;index+=1){
    const progress=index/1000;
    const point=game.pathPoint(progress);
    const distance=Math.hypot(point.x-targetPos.x,point.y-targetPos.y);
    if(distance>92&&distance<160)candidates.push({progress,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  secondaryA.progress=candidates[0]?.progress??.25;
  secondaryB.progress=candidates.at(-1)?.progress??.34;
  for(const enemy of [target,secondaryA,secondaryB]){
    enemy.alpha=1;enemy.spawnScale=1;enemy.def={...enemy.def,speed:0};
  }
  game.state.enemies=[target,secondaryA,secondaryB];
  game.state.spawnQueue=[];
  game.state.waveActive=false;
  game.state.buildPhase=true;
  window.__fusionEnemyProbe={target,secondaryA,secondaryB,before:[target.hp,secondaryA.hp,secondaryB.hp]};
  game.fireTower(plasmaTower,target);
});
await page.waitForTimeout(1800);
const overload=await page.evaluate(()=>{
  const probe=window.__fusionEnemyProbe;
  const fusionProjectiles=window.__NEON_TEST__.state.projectiles.filter(projectile=>projectile.__fusionGenerated);
  return {
    before:probe.before,
    after:[probe.target.hp,probe.secondaryA.hp,probe.secondaryB.hp],
    targetSlow:probe.target.slowFactor,
    secondaryDamage:[probe.secondaryA.maxHp-probe.secondaryA.hp,probe.secondaryB.maxHp-probe.secondaryB.hp],
    beams:window.__NEON_TEST__.state.beams.length,
    projectiles:window.__NEON_TEST__.state.projectiles.length,
    fusionProjectileCount:fusionProjectiles.length,
    fusionNames:[...new Set(fusionProjectiles.map(projectile=>projectile.__fusionName).filter(Boolean))]
  };
});
if(overload.fusionProjectileCount<1||!overload.fusionNames.includes('OVERLOAD BURST')) errors.push(`plasma + rail did not generate its chained fusion attack: ${JSON.stringify(overload)}`);
if(overload.beams<1) errors.push(`plasma + rail did not render a chained fusion beam: ${JSON.stringify(overload)}`);
if(!(overload.targetSlow<1)) errors.push(`plasma fusion effects did not apply control: ${JSON.stringify(overload)}`);
await page.screenshot({path:`${out}/03-overload-chain-combat.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=9999;
  game.buildTower('cryo',0);game.buildTower('cryo',3);
  game.state.selectedBuild=null;game.state.selectedTower=null;
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
    return {game:rect('game'),guide:rect('resonance-link-overlay'),board:rect('resonance-board-network-overlay'),innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight};
  });
  viewportResults.push({viewport,geometry});
  for(const layer of ['guide','board'])for(const field of ['x','y','width','height'])if(Math.abs(geometry.game[field]-geometry[layer][field])>.75)errors.push(`${viewport.name} ${layer} ${field} mismatch: ${JSON.stringify(geometry)}`);
  if(geometry.scrollWidth>geometry.innerWidth||geometry.scrollHeight>geometry.innerHeight)errors.push(`${viewport.name} overflow: ${JSON.stringify(geometry)}`);
}

const report={errors,loaded,network,selected,overload,sameType,viewportResults};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
