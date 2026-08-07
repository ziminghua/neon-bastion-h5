import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/tower-level-visuals';
const BUILD='tower-level-art-v1-20260807';
const TYPES=['rail','cryo','plasma','arcane'];
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

async function slotPoint(slotIndex){
  return page.evaluate(index=>{
    const game=window.__NEON_TEST__;
    const slot=game.level.slots[index];
    const rect=document.getElementById('game').getBoundingClientRect();
    return {x:rect.left+slot.x/1600*rect.width,y:rect.top+slot.y/900*rect.height};
  },slotIndex);
}

async function dragSlot(fromSlot,toSlot){
  const from=await slotPoint(fromSlot);
  const to=await slotPoint(toSlot);
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move((from.x+to.x)/2,(from.y+to.y)/2,{steps:8});
  await page.mouse.move(to.x,to.y,{steps:12});
  await page.waitForTimeout(180);
  await page.mouse.up();
  await page.waitForTimeout(420);
}

await page.goto(`${base}?qa=build&draftSeed=20260807&towerLevelQa=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(expected=>
  window.__NEON_TEST__?.state?.ready&&
  window.__TOWER_LEVEL_VISUALS__?.ready&&
  window.__TOWER_LEVEL_VISUALS__.build===expected,
BUILD,{timeout:45000});
await page.waitForTimeout(500);

const loaded=await page.evaluate(({BUILD,TYPES})=>{
  const runtime=window.__TOWER_LEVEL_VISUALS__;
  const spriteInfo={};
  for(const type of TYPES){
    spriteInfo[type]=[1,2,3].map(level=>{
      const image=window.__TOWER_LEVEL_SPRITES__?.[type]?.[level];
      return {level,complete:Boolean(image?.complete),width:image?.naturalWidth||0,height:image?.naturalHeight||0,srcLength:image?.src?.length||0,src:image?.src||''};
    });
  }
  return {
    runtime,
    spriteInfo,
    script:[...document.scripts].map(script=>script.src).find(src=>src.includes('tower-level-visuals-v1.js'))||''
  };
},{BUILD,TYPES});

if(!loaded.script.includes(`build=${BUILD}`)) errors.push(`tower visual cache token missing: ${loaded.script}`);
if(loaded.runtime.assetCount!==12) errors.push(`expected 12 generated tower sprites, got ${loaded.runtime.assetCount}`);
if(loaded.runtime.maxLevel!==3) errors.push(`expected max level 3, got ${loaded.runtime.maxLevel}`);
const sources=[];
for(const type of TYPES){
  const levels=loaded.spriteInfo[type]||[];
  if(levels.length!==3) errors.push(`${type} did not expose three visual levels`);
  for(const item of levels){
    if(!item.complete||item.width!==256||item.height!==256) errors.push(`${type} L${item.level} sprite not ready at 256x256: ${JSON.stringify(item)}`);
    if(!item.src.startsWith('data:image/webp')) errors.push(`${type} L${item.level} is not a generated WebP image`);
    if(item.srcLength<1500) errors.push(`${type} L${item.level} generated image unexpectedly small: ${item.srcLength}`);
    sources.push(item.src);
  }
  if(new Set(levels.map(item=>item.src)).size!==3) errors.push(`${type} levels are not visually distinct image assets`);
}
if(new Set(sources).size!==12) errors.push(`expected 12 unique generated image assets, got ${new Set(sources).size}`);

await page.evaluate(()=>{
  document.getElementById('intro')?.classList.add('hidden');
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=9999;
  [['rail',0,1],['rail',1,2],['rail',2,3],['cryo',3,1],['cryo',4,2],['cryo',5,3]].forEach(([type,slot,level])=>{
    game.buildTower(type,slot);
    game.state.towers.find(tower=>tower.slot===slot).level=level;
  });
  game.state.selectedBuild=null;game.state.selectedTower=null;
});
await page.waitForTimeout(700);
await page.screenshot({path:`${out}/01-rail-cryo-levels.png`,fullPage:true});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=9999;
  [['plasma',0,1],['plasma',1,2],['plasma',2,3],['arcane',3,1],['arcane',4,2],['arcane',5,3]].forEach(([type,slot,level])=>{
    game.buildTower(type,slot);
    game.state.towers.find(tower=>tower.slot===slot).level=level;
  });
  game.state.selectedBuild=null;game.state.selectedTower=null;
});
await page.waitForTimeout(700);
await page.screenshot({path:`${out}/02-plasma-arcane-levels.png`,fullPage:true});

const drawProbe=await page.evaluate(()=>structuredClone(window.__TOWER_LEVEL_VISUALS__.drawCounts));
for(const type of TYPES){
  for(const level of [1,2,3]){
    if((drawProbe?.[type]?.[level]||0)<1) errors.push(`${type} L${level} generated sprite was never drawn to the battlefield`);
  }
}

// Real pointer merges must still create L2 and L3.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=9999;
  [0,1,2,3].forEach(slot=>game.buildTower('rail',slot));
  game.state.selectedBuild=null;game.state.selectedTower=null;
});
await dragSlot(0,1);
await dragSlot(2,3);
let mergeState=await page.evaluate(()=>window.__NEON_TEST__.state.towers.map(tower=>({type:tower.type,slot:tower.slot,level:tower.level})));
if(mergeState.length!==2||mergeState.some(tower=>tower.level!==2)) errors.push(`L1->L2 merge regression: ${JSON.stringify(mergeState)}`);
await dragSlot(1,3);
mergeState=await page.evaluate(()=>window.__NEON_TEST__.state.towers.map(tower=>({type:tower.type,slot:tower.slot,level:tower.level})));
if(mergeState.length!==1||mergeState[0]?.level!==3) errors.push(`L2->L3 merge regression: ${JSON.stringify(mergeState)}`);

// A second L3 tower may be positioned nearby, but L3+L3 must not become L4 or consume either tower.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.credits=9999;
  game.buildTower('rail',4);
  const second=game.state.towers.find(tower=>tower.slot===4);
  second.level=3;
  game.state.selectedBuild=null;game.state.selectedTower=null;
});
await page.waitForTimeout(250);
await dragSlot(4,3);
const capState=await page.evaluate(()=>({
  towers:window.__NEON_TEST__.state.towers.map(tower=>({type:tower.type,slot:tower.slot,level:tower.level})),
  drag:window.__NEON_TEST__.state.drag,
  toast:document.getElementById('toast')?.textContent||''
}));
if(capState.towers.length!==2) errors.push(`L3 cap consumed a tower: ${JSON.stringify(capState)}`);
if(capState.towers.some(tower=>tower.level!==3)) errors.push(`tower exceeded or fell below L3 cap: ${JSON.stringify(capState)}`);
if(capState.towers.some(tower=>tower.level>3)) errors.push(`L4 tower created despite cap: ${JSON.stringify(capState)}`);
if(capState.drag!==null) errors.push(`drag state did not clear after blocked L3 merge: ${JSON.stringify(capState.drag)}`);
if(!capState.toast.includes('MAX LEVEL 3')) errors.push(`max-level feedback missing: ${capState.toast}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.selectedTower=game.state.towers.find(tower=>tower.level===3)||null;
});
await page.waitForTimeout(300);
const inspector=await page.evaluate(()=>({
  name:document.getElementById('inspectName')?.textContent||'',
  src:document.getElementById('inspectImage')?.src||''
}));
if(!inspector.name.includes('Lv.3 MAX')) errors.push(`L3 inspector did not show MAX: ${JSON.stringify(inspector)}`);
if(!inspector.src.startsWith('data:image/webp')) errors.push(`L3 inspector did not use generated level image`);
await page.screenshot({path:`${out}/03-level3-cap.png`,fullPage:true});

const report={
  errors,
  runtime:{build:loaded.runtime.build,assetCount:loaded.runtime.assetCount,maxLevel:loaded.runtime.maxLevel,policy:loaded.runtime.policy},
  assets:Object.fromEntries(TYPES.map(type=>[type,loaded.spriteInfo[type].map(({level,complete,width,height,srcLength})=>({level,complete,width,height,srcLength}))])),
  drawProbe,
  mergeState,
  capState,
  inspector
};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
