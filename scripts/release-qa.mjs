import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/release-qa';
const WORLD={width:1600,height:900};
const EXPECTED_PLATFORMS=[
  {id:'north-west',zone:'north',x:490,y:208,markerX:490,markerY:208,maskX:490,maskY:208},
  {id:'street-west',zone:'street',x:276,y:448,markerX:276,markerY:448,maskX:276,maskY:448},
  {id:'street-south',zone:'street',x:351,y:671,markerX:351,markerY:671,maskX:351,maskY:671},
  {id:'reactor-west',zone:'reactor',x:602,y:521,markerX:602,markerY:521,maskX:602,maskY:521},
  {id:'north-center',zone:'north',x:935,y:149,markerX:935,markerY:149,maskX:935,maskY:149},
  {id:'reactor-east',zone:'reactor',x:895,y:524,markerX:895,markerY:524,maskX:895,maskY:524},
  {id:'north-east',zone:'north',x:1208,y:230,markerX:1208,markerY:230,maskX:1208,maskY:230},
  {id:'bridge-center',zone:'bridge',x:1134,y:550,markerX:1134,markerY:550,maskX:1134,maskY:550},
  {id:'bridge-south',zone:'bridge',x:1202,y:754,markerX:1202,markerY:744,maskX:1202,maskY:754},
  {id:'core-west',zone:'core',x:1342,y:387,markerX:1342,markerY:387,maskX:1342,maskY:387}
];
const EXPECTED_SLOT_COUNT=EXPECTED_PLATFORMS.length;
const VIEWPORT_MATRIX=[
  {name:'1920x1080',width:1920,height:1080},
  {name:'1366x768',width:1366,height:768},
  {name:'1280x720',width:1280,height:720},
  {name:'1024x768',width:1024,height:768},
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

async function openGame(query='?qa=build'){
  await page.goto(`${base}${query}`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForFunction(
    ()=>window.__NEON_TEST__?.state?.ready&&window.__RENDERED_MAP_READY&&window.__PLACEMENT_OVERLAY_READY,
    null,
    {timeout:45000}
  );
  await page.waitForTimeout(350);
}

function expectedShell(viewport){
  const scale=Math.min(viewport.width/WORLD.width,viewport.height/WORLD.height);
  const width=WORLD.width*scale;
  const height=WORLD.height*scale;
  return {
    scale,
    width,
    height,
    left:Math.max(0,(viewport.width-width)/2),
    top:Math.max(0,(viewport.height-height)/2)
  };
}

function toViewport(canvasBox,point){
  return {
    x:canvasBox.x+(point.x/WORLD.width)*canvasBox.width,
    y:canvasBox.y+(point.y/WORLD.height)*canvasBox.height
  };
}

await openGame('?qa=built');
const assetReport=await page.evaluate(()=>{
  const entries=Object.entries(window.__NEON_TEST__.assets).map(([key,asset])=>{
    const width=asset?.naturalWidth||asset?.videoWidth||asset?.width||0;
    const height=asset?.naturalHeight||asset?.videoHeight||asset?.height||0;
    return [key,{width,height,kind:asset?.constructor?.name||typeof asset}];
  });
  return {
    failures:window.__assetLoadFailures||[],
    assets:Object.fromEntries(entries),
    map:window.__RENDERED_MAP_DIAGNOSTICS,
    source:window.__RENDERED_MAP_SOURCE,
    world:window.__PLACEMENT_WORLD,
    platforms:window.__NEON_TEST__.level.slots.map(({id,zone,x,y,markerX,markerY,maskX,maskY})=>({id,zone,x,y,markerX,markerY,maskX,maskY}))
  };
});
if(assetReport.failures.length)errors.push(`asset failures: ${assetReport.failures.join(', ')}`);
for(const [key,asset] of Object.entries(assetReport.assets)){
  if(!asset.width||!asset.height)errors.push(`invalid asset ${key}: ${JSON.stringify(asset)}`);
}
if(assetReport.source!=='delivery'||assetReport.map?.naturalWidth!==1600||assetReport.map?.naturalHeight!==900||assetReport.map?.anchorModel!=='game-marker-mask-v1'){
  errors.push(`rendered map invalid: ${JSON.stringify(assetReport.map)}`);
}
if(JSON.stringify(assetReport.world)!==JSON.stringify(WORLD)){
  errors.push(`logical world changed: ${JSON.stringify(assetReport.world)}`);
}
if(JSON.stringify(assetReport.platforms)!==JSON.stringify(EXPECTED_PLATFORMS)){
  errors.push(`platform anchor model changed: ${JSON.stringify(assetReport.platforms)}`);
}
await page.screenshot({path:`${out}/01-release-built-1600x900.png`});

const canvas=page.locator('#game');
let canvasBox=await canvas.boundingBox();
if(!canvasBox)throw new Error('Canvas unavailable for placement QA');

// Verify the formerly missing far-right authored platform is a real pointer target.
const farRightViewport=toViewport(canvasBox,EXPECTED_PLATFORMS[9]);
await page.mouse.move(farRightViewport.x,farRightViewport.y);
await page.waitForTimeout(160);
const farRightHover=await page.evaluate(()=>window.__NEON_TEST__.state.hoverSlot);
if(farRightHover!==9)errors.push(`far-right hover failed: ${farRightHover}`);
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.credits=5000;
  game.buildTower('rail',9);
});
await page.waitForTimeout(320);
const farRightPlacement=await page.evaluate(()=>({
  towerAtTarget:window.__NEON_TEST__.state.towers.some(tower=>tower.slot===9),
  towerCount:window.__NEON_TEST__.state.towers.length
}));
await page.screenshot({path:`${out}/01b-release-far-right-placement.png`});
if(!farRightPlacement.towerAtTarget)errors.push(`far-right placement failed: ${JSON.stringify(farRightPlacement)}`);

// Drag the rail tower from the first authored platform to the lower-right platform.
const dragNodes=await page.evaluate(()=>({
  from:window.__NEON_TEST__.level.slots[0],
  to:window.__NEON_TEST__.level.slots[8]
}));
const dragFrom=toViewport(canvasBox,dragNodes.from);
const dragTo=toViewport(canvasBox,dragNodes.to);
await page.mouse.move(dragFrom.x,dragFrom.y);
await page.mouse.down();
await page.mouse.move(dragTo.x,dragTo.y,{steps:14});
await page.waitForTimeout(180);
const dragPreview=await page.evaluate(()=>({
  moved:Boolean(window.__NEON_TEST__.state.drag?.moved),
  hoverSlot:window.__NEON_TEST__.state.hoverSlot,
  sourceSlot:window.__NEON_TEST__.state.drag?.tower?.slot
}));
await page.screenshot({path:`${out}/02-release-drag.png`});
if(!dragPreview.moved||dragPreview.hoverSlot!==8||dragPreview.sourceSlot!==0){
  errors.push(`drag preview failed: ${JSON.stringify(dragPreview)}`);
}
await page.mouse.up();
await page.waitForTimeout(420);
const dragResult=await page.evaluate(()=>({
  active:Boolean(window.__NEON_TEST__.state.drag),
  railAtTarget:window.__NEON_TEST__.state.towers.some(tower=>tower.type==='rail'&&tower.slot===8)
}));
if(dragResult.active||!dragResult.railAtTarget)errors.push(`drag landing failed: ${JSON.stringify(dragResult)}`);

// Execute the real five-wave loop with authored path and platform anchors.
await openGame('?qa=build');
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.credits=6000;
  const layout=['rail','cryo','plasma','arcane','rail','cryo','plasma','arcane'];
  layout.forEach((type,slot)=>game.buildTower(type,slot));
  Object.keys(game.state.mods.damage).forEach(type=>{game.state.mods.damage[type]=2.7;});
  game.state.speed=8;
});

for(let wave=1;wave<=5;wave+=1){
  const started=await page.evaluate(()=>window.__NEON_TEST__.startWave());
  if(started===false)errors.push(`wave ${wave} did not start`);
  if(wave===1){
    await page.waitForTimeout(950);
    await page.screenshot({path:`${out}/03-release-wave-1.png`});
  }
  if(wave<5){
    await page.waitForFunction(
      ()=>!document.getElementById('protocolModal').classList.contains('hidden'),
      null,
      {timeout:90000}
    );
    await page.locator('.protocol-choice').first().click();
    await page.waitForFunction(
      ()=>!window.__NEON_TEST__.state.paused&&window.__NEON_TEST__.state.buildPhase,
      null,
      {timeout:10000}
    );
  }
}
await page.waitForFunction(
  ()=>!document.getElementById('resultModal').classList.contains('hidden'),
  null,
  {timeout:90000}
);
await page.screenshot({path:`${out}/04-release-result.png`});
const fullRun=await page.evaluate(()=>({
  wave:window.__NEON_TEST__.state.wave,
  hp:window.__NEON_TEST__.state.hp,
  kills:window.__NEON_TEST__.state.kills,
  title:document.getElementById('resultTitle').textContent,
  resultVisible:!document.getElementById('resultModal').classList.contains('hidden'),
  pathPoints:window.__NEON_TEST__.level.path.length,
  slots:window.__NEON_TEST__.level.slots.length,
  platformModel:window.__NEON_TEST__.level.slots.map(({id,zone,x,y,markerX,markerY,maskX,maskY})=>({id,zone,x,y,markerX,markerY,maskX,maskY}))
}));
if(fullRun.wave!==5||!fullRun.resultVisible||!fullRun.title.includes('SECURED')){
  errors.push(`five-wave run failed: ${JSON.stringify(fullRun)}`);
}
if(fullRun.pathPoints!==18||fullRun.slots!==EXPECTED_SLOT_COUNT||JSON.stringify(fullRun.platformModel)!==JSON.stringify(EXPECTED_PLATFORMS)){
  errors.push(`authored geometry changed: ${JSON.stringify(fullRun)}`);
}

// Validate one fixed logical map and one anchor model across common desktop/tablet/mobile-landscape sizes.
const viewportMatrix=[];
for(const viewport of VIEWPORT_MATRIX){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await openGame('?qa=build');
  const metrics=await page.evaluate(()=>{
    const shell=document.getElementById('game-shell').getBoundingClientRect();
    const canvas=document.getElementById('game').getBoundingClientRect();
    const overlay=document.getElementById('placement-node-overlay').getBoundingClientRect();
    return {
      innerWidth,
      innerHeight,
      shell:{left:shell.left,top:shell.top,width:shell.width,height:shell.height},
      canvas:{left:canvas.left,top:canvas.top,width:canvas.width,height:canvas.height},
      overlay:{left:overlay.left,top:overlay.top,width:overlay.width,height:overlay.height},
      scrollWidth:document.documentElement.scrollWidth,
      scrollHeight:document.documentElement.scrollHeight
    };
  });
  const expected=expectedShell(viewport);
  const tolerance=1.5;
  const shellOk=
    Math.abs(metrics.shell.left-expected.left)<=tolerance&&
    Math.abs(metrics.shell.top-expected.top)<=tolerance&&
    Math.abs(metrics.shell.width-expected.width)<=tolerance&&
    Math.abs(metrics.shell.height-expected.height)<=tolerance;
  const layersOk=['left','top','width','height'].every(key=>
    Math.abs(metrics.canvas[key]-metrics.overlay[key])<=.5
  );
  const overflowOk=metrics.scrollWidth<=metrics.innerWidth&&metrics.scrollHeight<=metrics.innerHeight;
  if(!shellOk||!layersOk||!overflowOk){
    errors.push(`viewport ${viewport.name} geometry failed: ${JSON.stringify({metrics,expected})}`);
  }

  canvasBox=await canvas.boundingBox();
  if(!canvasBox)throw new Error(`Canvas unavailable at ${viewport.name}`);
  const hoverResults=[];
  for(let index=0;index<EXPECTED_PLATFORMS.length;index+=1){
    const platform=EXPECTED_PLATFORMS[index];
    const markerPoint={x:platform.markerX,y:platform.markerY};
    const screen=toViewport(canvasBox,markerPoint);
    await page.mouse.move(screen.x,screen.y);
    await page.waitForTimeout(25);
    const hover=await page.evaluate(()=>window.__NEON_TEST__.state.hoverSlot);
    hoverResults.push(hover);
    if(hover!==index){
      errors.push(`viewport ${viewport.name} marker ${platform.id} hit test failed: expected ${index}, got ${hover}`);
    }
  }

  if(viewport.name==='1280x720'||viewport.name==='844x390'){
    await page.screenshot({path:`${out}/05-release-responsive-${viewport.name}.png`});
  }
  viewportMatrix.push({viewport,expected,metrics,hoverResults});
}

const report={errors,assetReport,farRightHover,farRightPlacement,dragPreview,dragResult,fullRun,viewportMatrix};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
