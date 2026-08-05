import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const EXPECTED_MAP_LENGTH=86436;
const EXPECTED_MAP_SHA='1602b94f6c5f2c51ec4762a79b2d872e9a144d860fa1494e954db43bfbd84d94';
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
  await page.waitForFunction(()=>window.__RENDERED_MAP_READY&&window.__RENDERED_MAP_SOURCE==='delivery',{timeout:30000});
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
  mapSource:window.__RENDERED_MAP_SOURCE,
  mapDiagnostics:window.__RENDERED_MAP_DIAGNOSTICS,
  deliveryDiagnostics:window.__RENDERED_MAP_DELIVERY_DIAGNOSTICS,
  fusionDiagnostics:window.__FUSION_RENDERER_DIAGNOSTICS,
  pathPoints:window.__NEON_TEST__.level.path.length,
  slots:window.__NEON_TEST__.level.slots.length,
  towers:window.__NEON_TEST__.state.towers.length,
  enemies:window.__NEON_TEST__.state.enemies.length,
  assetFailures:window.__assetLoadFailures||[],
  overflow:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight]
}));

const mapWidth=result.mapDiagnostics?.naturalWidth||0;
const mapHeight=result.mapDiagnostics?.naturalHeight||0;
if(!result.ready||!result.renderedMap||result.mapSource!=='delivery'||mapWidth!==1600||mapHeight!==900||result.pathPoints!==18||result.slots!==9||result.towers<4||result.enemies<4||result.assetFailures.length||result.overflow.some(value=>value>0)){
  errors.push(JSON.stringify(result));
}
await fs.writeFile(`${out}/report.json`,JSON.stringify({errors,result,deliveryLength:deliveryMap.length,deliverySha},null,2));
await browser.close();
if(errors.length){
  console.error(JSON.stringify({errors,result,deliveryLength:deliveryMap.length,deliverySha},null,2));
  process.exit(1);
}
console.log(JSON.stringify({result,deliveryLength:deliveryMap.length,deliverySha},null,2));
