import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/difficulty-balance';
const BUILD='enemy-pressure-v2-20260807';
const HP_CURVE=[1.03,1.07,1.12,1.18,1.25];
const SPEED_CURVE=[1.03,1.07,1.12,1.17,1.22];
const CONTROL_CURVE=[.56,.60,.66,.72,.78];
const WAVE_PLAN=[
  [{type:'drone',count:9,gap:.58}],
  [{type:'runner',count:11,gap:.36},{type:'drone',count:6,gap:.40}],
  [{type:'brute',count:6,gap:.62},{type:'runner',count:13,gap:.27}],
  [{type:'shield',count:8,gap:.50},{type:'drone',count:14,gap:.22}],
  [{type:'runner',count:15,gap:.18},{type:'brute',count:8,gap:.34},{type:'shield',count:2,gap:.48},{type:'boss',count:1,gap:.90}]
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

await page.goto(`${base}?qa=build&draftSeed=20260807`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>
  window.__NEON_TEST__?.state?.ready&&
  window.__DIFFICULTY_BALANCE?.ready&&
  window.__FUSION_RESONANCE_RUNTIME?.ready,
  null,{timeout:45000}
);
await page.waitForTimeout(250);

const runtime=await page.evaluate(()=>({
  difficulty:window.__DIFFICULTY_BALANCE,
  script:[...document.scripts].map(script=>script.src).find(src=>src.includes('difficulty-balance-v1.js'))||'',
  liveWavePlan:window.__NEON_TEST__.level.wavesData
}));
if(runtime.difficulty.build!==BUILD) errors.push(`difficulty build mismatch: ${JSON.stringify(runtime.difficulty)}`);
if(!runtime.script.includes(BUILD)) errors.push(`cache token missing: ${runtime.script}`);
if(runtime.difficulty.design!=='pressure-over-sponge') errors.push(`difficulty design mismatch: ${runtime.difficulty.design}`);
if(JSON.stringify(runtime.difficulty.hpCurve)!==JSON.stringify(HP_CURVE)) errors.push(`hp curve mismatch: ${JSON.stringify(runtime.difficulty.hpCurve)}`);
if(JSON.stringify(runtime.difficulty.speedCurve)!==JSON.stringify(SPEED_CURVE)) errors.push(`speed curve mismatch: ${JSON.stringify(runtime.difficulty.speedCurve)}`);
if(JSON.stringify(runtime.difficulty.controlFloorCurve)!==JSON.stringify(CONTROL_CURVE)) errors.push(`control curve mismatch: ${JSON.stringify(runtime.difficulty.controlFloorCurve)}`);
if(JSON.stringify(runtime.liveWavePlan)!==JSON.stringify(WAVE_PLAN)) errors.push(`wave plan mismatch: ${JSON.stringify(runtime.liveWavePlan)}`);

async function sample(wave,type){
  await page.evaluate(({wave,type})=>{
    const game=window.__NEON_TEST__;
    game.state.enemies=[];
    game.state.wave=wave;
    game.state.enemies=[game.createEnemy(type,1+(wave-1)*.24)];
  },{wave,type});
  await page.waitForTimeout(120);
  return page.evaluate(()=>{
    const enemy=window.__NEON_TEST__.state.enemies[0];
    return {
      wave:window.__NEON_TEST__.state.wave,
      type:enemy.type,
      maxHp:enemy.maxHp,
      maxShield:enemy.maxShield,
      speed:enemy.def.speed,
      multiplier:enemy.__difficultyMultiplier,
      controlFloor:enemy.__difficultyControlFloor,
      build:enemy.__difficultyBuild
    };
  });
}

const wave1Drone=await sample(1,'drone');
const wave4Shield=await sample(4,'shield');
const wave5Runner=await sample(5,'runner');
const wave5Boss=await sample(5,'boss');
if(Math.abs(wave1Drone.maxHp-39.14)>.05||Math.abs(wave1Drone.speed-90.64)>.05) errors.push(`wave 1 drone mismatch: ${JSON.stringify(wave1Drone)}`);
if(Math.abs(wave4Shield.maxHp-282.31736)>.05||Math.abs(wave4Shield.maxShield-125.956976)>.05||Math.abs(wave4Shield.speed-62.0568)>.05) errors.push(`wave 4 shield mismatch: ${JSON.stringify(wave4Shield)}`);
if(wave5Runner.maxHp<70.5||wave5Runner.maxHp>71.5||wave5Runner.speed<170||wave5Runner.speed>171.5) errors.push(`wave 5 runner outside band: ${JSON.stringify(wave5Runner)}`);
if(wave5Boss.maxHp<2680||wave5Boss.maxHp>2700||wave5Boss.speed<48||wave5Boss.speed>48.5||wave5Boss.controlFloor<.879) errors.push(`wave 5 boss outside band: ${JSON.stringify(wave5Boss)}`);

// Verify late-wave control resistance actually prevents a stasis effect from pinning a boss at 56% movement speed.
await page.evaluate(()=>{
  const enemy=window.__NEON_TEST__.state.enemies[0];
  enemy.slow=2;
  enemy.slowFactor=.56;
});
await page.waitForTimeout(120);
const controlProbe=await page.evaluate(()=>{
  const enemy=window.__NEON_TEST__.state.enemies[0];
  return {slow:enemy.slow,slowFactor:enemy.slowFactor,floor:enemy.__difficultyControlFloor};
});
if(controlProbe.slowFactor<.879) errors.push(`boss control resistance not enforced: ${JSON.stringify(controlProbe)}`);

// A cheap two-tower opening should now leak a few enemies, but must not lose immediately.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=360;
  game.buildTower('rail',1);
  game.buildTower('cryo',3);
  game.state.speed=8;
  game.startWave();
});
await page.waitForTimeout(900);
await page.screenshot({path:`${out}/01-wave1-pressure.png`});
await page.waitForFunction(()=>!window.__NEON_TEST__.state.waveActive||window.__NEON_TEST__.state.hp<=0,null,{timeout:45000});
const earlyRun=await page.evaluate(()=>({hp:window.__NEON_TEST__.state.hp,kills:window.__NEON_TEST__.state.kills,wave:window.__NEON_TEST__.state.wave}));
if(earlyRun.hp<14) errors.push(`wave 1 opening is too punishing: ${JSON.stringify(earlyRun)}`);
if(earlyRun.kills>=9) errors.push(`wave 1 opening is still trivial: ${JSON.stringify(earlyRun)}`);

// A full, unmerged mixed board should survive wave 5, but the fight must create density
// and resolve through movement/leaks/kills rather than a permanent slow-lock grind.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=6000;
  ['rail','cryo','plasma','arcane','rail','cryo','plasma','arcane'].forEach((type,slot)=>game.buildTower(type,slot));
  game.state.wave=4;
  game.state.speed=8;
  game.startWave();
});
const lateTimeline=[];
let resolvedAt=null;
let peakActive=0;
for(let second=1;second<=35;second+=1){
  await page.waitForTimeout(1000);
  const point=await page.evaluate(second=>{
    const game=window.__NEON_TEST__;
    const progress=game.state.enemies.map(enemy=>enemy.progress).filter(Number.isFinite);
    return {
      second,
      hp:game.state.hp,
      kills:game.state.kills,
      waveActive:game.state.waveActive,
      enemies:game.state.enemies.length,
      queued:game.state.spawnQueue.length,
      maxProgress:progress.length?Math.max(...progress):null,
      avgProgress:progress.length?progress.reduce((sum,value)=>sum+value,0)/progress.length:null
    };
  },second);
  lateTimeline.push(point);
  peakActive=Math.max(peakActive,point.enemies);
  if(!point.waveActive||point.hp<=0){resolvedAt=second;break;}
}
await page.screenshot({path:`${out}/02-wave5-pressure.png`});
const lateRun=await page.evaluate(()=>({
  hp:window.__NEON_TEST__.state.hp,
  kills:window.__NEON_TEST__.state.kills,
  wave:window.__NEON_TEST__.state.wave,
  waveActive:window.__NEON_TEST__.state.waveActive
}));
if(lateRun.hp<=0) errors.push(`wave 5 is overtuned for a full mixed level-1 board: ${JSON.stringify(lateRun)}`);
if(lateRun.waveActive) errors.push(`wave 5 still becomes a control-lock grind: ${JSON.stringify(lateTimeline)}`);
if(resolvedAt!==null&&resolvedAt<8) errors.push(`wave 5 still resolves too quickly: ${resolvedAt}s`);
if(peakActive<10) errors.push(`wave 5 never created enough simultaneous pressure: peak=${peakActive}`);

const report={errors,runtime,samples:{wave1Drone,wave4Shield,wave5Runner,wave5Boss},controlProbe,earlyRun,lateRun,resolvedAt,peakActive,lateTimeline};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
