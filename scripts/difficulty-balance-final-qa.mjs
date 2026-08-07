import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/difficulty-balance';
const BUILD='enemy-pressure-v3-20260807';
const HP_CURVE=[1.03,1.07,1.12,1.18,1.25];
const SPEED_CURVE=[1.08,1.13,1.19,1.25,1.32];
const CONTROL_CURVE=[.70,.74,.78,.82,.86];
const CRYO={slow:.24,slowDuration:1.15};
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
page.on('console',message=>{if(message.type()==='error') errors.push(`console: ${message.text()}`)});
page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
page.on('requestfailed',request=>errors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText||'unknown'}`));

await page.goto(`${base}?qa=build&draftSeed=20260807`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>window.__NEON_TEST__?.state?.ready&&window.__DIFFICULTY_BALANCE?.ready,null,{timeout:45000});
await page.waitForTimeout(250);

const runtime=await page.evaluate(()=>({
  difficulty:structuredClone(window.__DIFFICULTY_BALANCE),
  script:[...document.scripts].map(script=>script.src).find(src=>src.includes('difficulty-balance-v1.js'))||'',
  liveWavePlan:structuredClone(window.__NEON_TEST__.level.wavesData),
  cryo:{
    slow:window.__NEON_TEST__.towerTypes.cryo.slow,
    slowDuration:window.__NEON_TEST__.towerTypes.cryo.slowDuration
  }
}));

if(runtime.difficulty.build!==BUILD) errors.push(`difficulty build mismatch: ${JSON.stringify(runtime.difficulty)}`);
if(!runtime.script.includes(BUILD)) errors.push(`cache token missing: ${runtime.script}`);
if(runtime.difficulty.design!=='faster-flow-cryo-only-hit-control') errors.push(`movement design mismatch: ${runtime.difficulty.design}`);
if(runtime.difficulty.hitMovementPolicy!=='cryo-only') errors.push(`hit movement policy mismatch: ${runtime.difficulty.hitMovementPolicy}`);
if(runtime.difficulty.hpCurveChanged!==false) errors.push('HP curve should remain unchanged in this tuning pass');
if(runtime.difficulty.wavePlanChanged!==false) errors.push('wave plan should remain unchanged in this tuning pass');
if(JSON.stringify(runtime.difficulty.hpCurve)!==JSON.stringify(HP_CURVE)) errors.push(`hp curve mismatch: ${JSON.stringify(runtime.difficulty.hpCurve)}`);
if(JSON.stringify(runtime.difficulty.speedCurve)!==JSON.stringify(SPEED_CURVE)) errors.push(`speed curve mismatch: ${JSON.stringify(runtime.difficulty.speedCurve)}`);
if(JSON.stringify(runtime.difficulty.controlFloorCurve)!==JSON.stringify(CONTROL_CURVE)) errors.push(`control curve mismatch: ${JSON.stringify(runtime.difficulty.controlFloorCurve)}`);
if(JSON.stringify(runtime.liveWavePlan)!==JSON.stringify(WAVE_PLAN)) errors.push(`wave plan mismatch: ${JSON.stringify(runtime.liveWavePlan)}`);
if(Math.abs(runtime.cryo.slow-CRYO.slow)>1e-9||Math.abs(runtime.cryo.slowDuration-CRYO.slowDuration)>1e-9) errors.push(`cryo tuning mismatch: ${JSON.stringify(runtime.cryo)}`);

async function sample(wave,type){
  await page.evaluate(({wave,type})=>{
    const game=window.__NEON_TEST__;
    game.state.enemies=[];
    game.state.wave=wave;
    game.state.enemies=[game.createEnemy(type,1+(wave-1)*.24)];
  },{wave,type});
  await page.waitForTimeout(140);
  return page.evaluate(()=>{
    const enemy=window.__NEON_TEST__.state.enemies[0];
    return {
      wave:window.__NEON_TEST__.state.wave,
      type:enemy.type,
      maxHp:enemy.maxHp,
      speed:enemy.def.speed,
      controlFloor:enemy.__difficultyControlFloor,
      impactPolicy:enemy.__movementImpactPolicy,
      build:enemy.__difficultyBuild
    };
  });
}

const wave1Drone=await sample(1,'drone');
const wave4Shield=await sample(4,'shield');
const wave5Runner=await sample(5,'runner');
const wave5Boss=await sample(5,'boss');
if(Math.abs(wave1Drone.speed-95.04)>.05) errors.push(`wave 1 drone speed mismatch: ${JSON.stringify(wave1Drone)}`);
if(Math.abs(wave4Shield.speed-66.3)>.05) errors.push(`wave 4 shield speed mismatch: ${JSON.stringify(wave4Shield)}`);
if(Math.abs(wave5Runner.speed-184.6944)>.05) errors.push(`wave 5 runner speed mismatch: ${JSON.stringify(wave5Runner)}`);
if(Math.abs(wave5Boss.speed-52.1664)>.05) errors.push(`wave 5 boss speed mismatch: ${JSON.stringify(wave5Boss)}`);
if(wave5Boss.controlFloor<.919) errors.push(`wave 5 boss control floor mismatch: ${JSON.stringify(wave5Boss)}`);
if([wave1Drone,wave4Shield,wave5Runner,wave5Boss].some(sample=>sample.impactPolicy!=='cryo-only-v1')) errors.push('enemy impact policy was not installed');

const impactProbe=await page.evaluate(()=>{
  const enemy=window.__NEON_TEST__.state.enemies[0];
  const values={};
  for(const kind of ['rail','plasma','arcane']){
    enemy.impactKind=kind;
    enemy.impact=.13;
    values[kind]=enemy.impact;
  }
  enemy.impactKind='cryo';
  enemy.impact=.13;
  values.cryo=enemy.impact;
  return values;
});
if(impactProbe.rail!==0||impactProbe.plasma!==0||impactProbe.arcane!==0) errors.push(`non-cryo hit still creates movement impact: ${JSON.stringify(impactProbe)}`);
if(impactProbe.cryo<=0) errors.push(`cryo impact no longer exposes control feedback: ${JSON.stringify(impactProbe)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.wave=1;
  const enemy=game.createEnemy('drone',1);
  game.state.enemies=[enemy];
});
await page.waitForTimeout(140);
const cryoProbe=await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const enemy=game.state.enemies[0];
  enemy.slow=game.towerTypes.cryo.slowDuration;
  enemy.slowFactor=1-game.towerTypes.cryo.slow;
  return {slow:enemy.slow,slowFactor:enemy.slowFactor,floor:enemy.__difficultyControlFloor};
});
if(Math.abs(cryoProbe.slowFactor-.76)>.001) errors.push(`baseline cryo slow should retain 76% movement speed: ${JSON.stringify(cryoProbe)}`);
if(Math.abs(cryoProbe.slow-1.15)>.001) errors.push(`baseline cryo duration mismatch: ${JSON.stringify(cryoProbe)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.state.wave=5;
  const enemy=game.createEnemy('boss',1.96);
  game.state.enemies=[enemy];
});
await page.waitForTimeout(140);
await page.evaluate(()=>{
  const enemy=window.__NEON_TEST__.state.enemies[0];
  enemy.slow=2;
  enemy.slowFactor=.3;
});
await page.waitForTimeout(140);
const resistanceProbe=await page.evaluate(()=>{
  const enemy=window.__NEON_TEST__.state.enemies[0];
  return {slowFactor:enemy.slowFactor,floor:enemy.__difficultyControlFloor};
});
if(resistanceProbe.slowFactor<.919) errors.push(`late boss control resistance not enforced: ${JSON.stringify(resistanceProbe)}`);

await page.screenshot({path:`${out}/01-movement-control-tuning.png`,fullPage:true});

const report={
  errors,
  runtime,
  samples:{wave1Drone,wave4Shield,wave5Runner,wave5Boss},
  impactProbe,
  cryoProbe,
  resistanceProbe,
  note:'This QA validates requested movement/control mechanics only; it intentionally does not score gameplay difficulty or require a win/loss outcome.'
};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(errors.length) process.exit(1);
