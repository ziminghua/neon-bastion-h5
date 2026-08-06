import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/resonance-board-runtime';
const BUILD='cross-type-board-v4-20260806';
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

await page.goto(`${base}?qa=build&draftSeed=20260806&runtimeQa=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(expected=>{
  return window.__NEON_TEST__?.state?.ready
    &&window.__COMBAT_BALANCE_DIAGNOSTICS?.version>=3
    &&window.__RESONANCE_BOARD_RUNTIME?.ready
    &&window.__RESONANCE_BOARD_RUNTIME?.build===expected;
},BUILD,{timeout:45000});
await page.waitForTimeout(300);

async function slotPoint(index){
  return page.evaluate(slotIndex=>{
    const slot=window.__NEON_TEST__.level.slots[slotIndex];
    const rect=document.getElementById('game').getBoundingClientRect();
    return {
      x:rect.left+slot.x/1600*rect.width,
      y:rect.top+slot.y/900*rect.height
    };
  },index);
}

async function clickSlot(index){
  const point=await slotPoint(index);
  await page.mouse.click(point.x,point.y);
}

const initial=await page.evaluate(expected=>{
  const combatScript=[...document.scripts].find(script=>script.src.includes('combat-balance.js'));
  const boardScript=[...document.scripts].find(script=>script.src.includes('resonance-board-network.js'));
  const snapshot=window.__COMBAT_BALANCE__.snapshot();
  return {
    selectedBuild:window.__NEON_TEST__.state.selectedBuild,
    selectedTower:Boolean(window.__NEON_TEST__.state.selectedTower),
    guide:snapshot.guide,
    combatVersion:snapshot.version,
    combatScript:combatScript?.src||'',
    boardScript:boardScript?.src||'',
    boardRuntime:{...window.__RESONANCE_BOARD_RUNTIME},
    boardDataset:document.getElementById('game-shell').dataset.resonanceBoardBuild,
    overlays:{
      combat:Boolean(document.getElementById('resonance-link-overlay')),
      board:Boolean(document.getElementById('resonance-board-network-overlay'))
    },
    expected
  };
},BUILD);

if(!initial.combatScript.includes(`build=${BUILD}`)) errors.push(`combat script was not cache-busted: ${initial.combatScript}`);
if(!initial.boardScript.includes(`build=${BUILD}`)) errors.push(`board script was not cache-busted: ${initial.boardScript}`);
if(initial.combatVersion<3) errors.push(`stale combat runtime loaded: ${initial.combatVersion}`);
if(initial.boardRuntime.build!==BUILD||initial.boardDataset!==BUILD) errors.push(`board runtime build mismatch: ${JSON.stringify(initial)}`);
if(!initial.overlays.combat||!initial.overlays.board) errors.push(`required overlays missing: ${JSON.stringify(initial.overlays)}`);
if(!initial.selectedBuild||initial.selectedTower) errors.push(`random draft did not begin in build-card state: ${JSON.stringify(initial)}`);
if(initial.guide?.mode!=='build'||initial.guide?.position!==null) errors.push(`bottom card incorrectly projected a range onto a placed node: ${JSON.stringify(initial.guide)}`);

const firstType=initial.selectedBuild;
await clickSlot(1);
await page.waitForFunction(()=>window.__NEON_TEST__.state.towers.length===1,null,{timeout:5000});
await page.waitForFunction(previous=>window.__NEON_TEST__.state.selectedBuild&&window.__NEON_TEST__.state.selectedBuild!==previous,firstType,{timeout:5000});
const secondType=await page.evaluate(()=>window.__NEON_TEST__.state.selectedBuild);
if(secondType===firstType) errors.push(`random draft did not advance to a different type: ${firstType}`);

await clickSlot(3);
await page.waitForFunction(()=>window.__NEON_TEST__.state.towers.length===2,null,{timeout:5000});
await page.waitForFunction(()=>window.__RESONANCE_BOARD_RUNTIME?.visibleLinkCount===1,null,{timeout:5000});
await page.mouse.move(1590,20);
await page.waitForTimeout(350);

const placedNetwork=await page.evaluate(()=>{
  const board=document.getElementById('resonance-board-network-overlay');
  const boardContext=board.getContext('2d');
  const pixels=boardContext.getImageData(0,0,board.width,board.height).data;
  let alphaPixels=0;
  for(let index=3;index<pixels.length;index+=4){
    if(pixels[index]>10) alphaPixels+=1;
  }
  const snapshot=window.__COMBAT_BALANCE__.snapshot();
  return {
    towers:window.__NEON_TEST__.state.towers.map(tower=>({type:tower.type,slot:tower.slot})),
    selectedBuild:window.__NEON_TEST__.state.selectedBuild,
    selectedTower:Boolean(window.__NEON_TEST__.state.selectedTower),
    guide:snapshot.guide,
    links:snapshot.links,
    boardRuntime:{...window.__RESONANCE_BOARD_RUNTIME},
    alphaPixels
  };
});

if(new Set(placedNetwork.towers.map(tower=>tower.type)).size!==2) errors.push(`real draft flow did not place two different tower types: ${JSON.stringify(placedNetwork.towers)}`);
if(placedNetwork.links.length!==1||placedNetwork.boardRuntime.visibleLinkCount!==1) errors.push(`placed mixed towers did not keep a persistent board link: ${JSON.stringify(placedNetwork)}`);
if(placedNetwork.alphaPixels<150) errors.push(`persistent board link was not visibly rendered: ${placedNetwork.alphaPixels} alpha pixels`);
if(placedNetwork.guide?.mode!=='build'||placedNetwork.guide?.position!==null) errors.push(`current bottom card incorrectly owns the placed resonance visualization: ${JSON.stringify(placedNetwork.guide)}`);
await page.screenshot({path:`${out}/01-real-draft-persistent-board-link.png`});

await clickSlot(1);
await page.waitForTimeout(250);
const selectedPlacedTower=await page.evaluate(()=>({
  selectedType:window.__NEON_TEST__.state.selectedTower?.type||null,
  guide:window.__COMBAT_BALANCE__.snapshot().guide,
  visibleLinkCount:window.__RESONANCE_BOARD_RUNTIME.visibleLinkCount
}));
if(!selectedPlacedTower.selectedType||selectedPlacedTower.guide?.mode!=='selected') errors.push(`clicking a placed tower did not show that tower's range: ${JSON.stringify(selectedPlacedTower)}`);
if(selectedPlacedTower.visibleLinkCount!==1) errors.push(`selecting a placed tower hid its persistent network: ${JSON.stringify(selectedPlacedTower)}`);
await page.screenshot({path:`${out}/02-selected-placed-tower-range-plus-network.png`});

const viewportResults=[];
for(const viewport of [{width:1600,height:900,name:'1600x900'},{width:844,height:390,name:'844x390'}]){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.waitForTimeout(220);
  const geometry=await page.evaluate(()=>{
    const rect=id=>{
      const box=document.getElementById(id).getBoundingClientRect();
      return {x:box.x,y:box.y,width:box.width,height:box.height};
    };
    return {
      game:rect('game'),
      board:rect('resonance-board-network-overlay'),
      combat:rect('resonance-link-overlay'),
      visibleLinkCount:window.__RESONANCE_BOARD_RUNTIME.visibleLinkCount
    };
  });
  viewportResults.push({viewport,geometry});
  for(const overlayName of ['board','combat']){
    for(const field of ['x','y','width','height']){
      if(Math.abs(geometry.game[field]-geometry[overlayName][field])>.75){
        errors.push(`${viewport.name} ${overlayName} overlay ${field} mismatch: ${JSON.stringify(geometry)}`);
      }
    }
  }
  if(geometry.visibleLinkCount!==1) errors.push(`${viewport.name} persistent link disappeared: ${JSON.stringify(geometry)}`);
}

const report={errors,initial,firstType,secondType,placedNetwork,selectedPlacedTower,viewportResults};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
