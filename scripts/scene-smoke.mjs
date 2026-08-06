import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const EXPECTED_MAP_LENGTH=86436;
const EXPECTED_MAP_SHA='55aef6251587908cd4dedea4bbf5391fedd65b99dcf1449552b740117024ef5b';
const EXPECTED_WORLD={width:1600,height:900};
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
const out='artifacts/scene-smoke';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const errors=[];
page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:8080/?qa=build&draftSeed=20260805',{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>window.__NEON_TEST__?.state?.ready,{timeout:20000});

let mapWaitError='';
try{
  await page.waitForFunction(()=>window.__RENDERED_MAP_READY&&window.__RENDERED_MAP_SOURCE==='delivery'&&window.__PLACEMENT_OVERLAY_READY,{timeout:30000});
}catch(error){
  mapWaitError=error.message;
  errors.push(mapWaitError);
}

const deliveryMap=await page.evaluate(()=>window.__RENDERED_MAP_DELIVERY||'');
const deliverySha=crypto.createHash('sha256').update(deliveryMap).digest('hex');
if(deliveryMap.length!==EXPECTED_MAP_LENGTH) errors.push(`Delivery map length ${deliveryMap.length}, expected ${EXPECTED_MAP_LENGTH}`);
if(deliverySha!==EXPECTED_MAP_SHA) errors.push(`Delivery map SHA ${deliverySha}, expected ${EXPECTED_MAP_SHA}`);

if(mapWaitError){
  await page.screenshot({path:`${out}/rendered-map-delivery-failure-1600x900.png`});
  const diagnostics=await page.evaluate(()=>({
    ready:window.__NEON_TEST__?.state?.ready,
    renderedMap:window.__RENDERED_MAP_READY,
    placementOverlay:window.__PLACEMENT_OVERLAY_READY,
    mapSource:window.__RENDERED_MAP_SOURCE,
    mapError:window.__RENDERED_MAP_ERROR,
    deliveryError:window.__RENDERED_MAP_DELIVERY_ERROR,
    deliveryDiagnostics:window.__RENDERED_MAP_DELIVERY_DIAGNOSTICS,
    scripts:[...document.scripts].map(script=>script.getAttribute('src')).filter(Boolean),
    assetFailures:window.__assetLoadFailures||[]
  }));
  await fs.writeFile(`${out}/report.json`,JSON.stringify({errors,diagnostics,deliveryLength:deliveryMap.length,deliverySha},null,2));
  await browser.close();
  console.error(JSON.stringify({errors,diagnostics,deliveryLength:deliveryMap.length,deliverySha},null,2));
  process.exit(1);
}

await page.waitForTimeout(500);
await page.screenshot({path:`${out}/rendered-map-build-1600x900.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.credits=5000;
  [['rail',0],['cryo',3],['plasma',6],['arcane',7]].forEach(([type,slot])=>game.buildTower(type,slot));
});
await page.waitForTimeout(850);
await page.screenshot({path:`${out}/rendered-map-deployed-1600x900.png`});

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.startWave();
  game.state.spawnQueue=[{type:'drone',at:999,scale:1}];
});
await page.waitForTimeout(2100);
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const specs=[
    ['drone',.19],['runner',.24],['drone',.29],['brute',.39],
    ['shield',.47],['runner',.60],['brute',.68],['shield',.78]
  ];
  game.state.spawnQueue=[];
  game.state.enemies=specs.map(([type,progress])=>{
    const enemy=game.createEnemy(type,1.3);
    enemy.progress=progress;
    enemy.alpha=1;
    enemy.spawnScale=1;
    return enemy;
  });
  const targets=[game.state.enemies[2],game.state.enemies[1],game.state.enemies[4],game.state.enemies[6]];
  game.state.towers.forEach((tower,index)=>game.fireTower(tower,targets[index]));
});
await page.waitForTimeout(45);
await page.screenshot({path:`${out}/rendered-map-volley-1600x900.png`});
await page.waitForTimeout(390);
await page.screenshot({path:`${out}/rendered-map-impact-1600x900.png`});

await page.setViewportSize({width:1280,height:720});
await page.waitForTimeout(300);
await page.screenshot({path:`${out}/rendered-map-combat-1280x720.png`});

const result=await page.evaluate(()=>({
  ready:window.__NEON_TEST__.state.ready,
  renderedMap:window.__RENDERED_MAP_READY===true,
  placementOverlay:window.__PLACEMENT_OVERLAY_READY===true,
  mapSource:window.__RENDERED_MAP_SOURCE,
  mapDiagnostics:window.__RENDERED_MAP_DIAGNOSTICS,
  deliveryDiagnostics:window.__RENDERED_MAP_DELIVERY_DIAGNOSTICS,
  fusionDiagnostics:window.__FUSION_RENDERER_DIAGNOSTICS,
  world:window.__PLACEMENT_WORLD,
  pathPoints:window.__NEON_TEST__.level.path.length,
  slots:window.__NEON_TEST__.level.slots.length,
  platformModel:window.__NEON_TEST__.level.slots.map(({id,zone,x,y,markerX,markerY,maskX,maskY})=>({id,zone,x,y,markerX,markerY,maskX,maskY})),
  towers:window.__NEON_TEST__.state.towers.length,
  enemies:window.__NEON_TEST__.state.enemies.length,
  assetFailures:window.__assetLoadFailures||[],
  overflow:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]
}));

const mapWidth=result.mapDiagnostics?.naturalWidth||0;
const mapHeight=result.mapDiagnostics?.naturalHeight||0;
if(JSON.stringify(result.platformModel)!==JSON.stringify(EXPECTED_PLATFORMS)){
  errors.push(`Placement anchor model changed: ${JSON.stringify(result.platformModel)}`);
}
if(JSON.stringify(result.world)!==JSON.stringify(EXPECTED_WORLD)){
  errors.push(`Logical world changed: ${JSON.stringify(result.world)}`);
}
if(!result.ready||!result.renderedMap||!result.placementOverlay||result.mapSource!=='delivery'||result.mapDiagnostics?.anchorModel!=='game-marker-mask-v1'||mapWidth!==1600||mapHeight!==900||result.pathPoints!==18||result.slots!==EXPECTED_SLOT_COUNT||result.towers<4||result.enemies<4||result.assetFailures.length||result.overflow.some(value=>value>0)){
  errors.push(JSON.stringify(result));
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({errors,result,deliveryLength:deliveryMap.length,deliverySha},null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify({errors,result,deliveryLength:deliveryMap.length,deliverySha},null,2));
  process.exit(1);
}
console.log(JSON.stringify({result,deliveryLength:deliveryMap.length,deliverySha},null,2));
