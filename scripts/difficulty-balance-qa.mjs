import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/difficulty-balance';
const BUILD='enemy-pressure-v2-20260807';
const HP_CURVE=[1.03,1.07,1.12,1.18,1.25];
const SPEED_CURVE=[1.03,1.07,1.12,1.17,1.22];
const TYPE_HP={drone:1,runner:1,brute:1.06,shield:1.07,boss:1.12};
const TYPE_SPEED={drone:1,runner:1.06,brute:1.02,shield:1.02,boss:1.04};
const WAVE_PLAN=[
  [{type:'drone',count:9,gap:.58}],
  [{type:'runner',count:11,gap:.36},{type:'drone',count:6,gap:.40}],
  [{type:'brute',count:6,gap:.62},{type:'runner',count:13,gap:.27}],
  [{type:'shield',count:8,gap:.50},{type:'drone',count:14,gap:.22}],
  [{type:'runner',count:15,gap:.18},{type:'brute',count:8,gap:.34},{type:'shield',count:2,gap:.48},{type:'boss',count:1,gap:.90}]
];
const BASE={
  drone:{hp:38,speed:88},
  runner:{hp:29,speed:132},
  brute:{hp:105,speed:58},
  shield:{hp:130,speed:52,shield:58},
  boss:{hp:980,speed:38}
};

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
if(!runtime.script.includes('enemy-pressure-v2-20260807')) errors.push(`difficulty script cache token missing: ${runtime.script}`);
if(runtime.difficulty.design!=='pressure-over-sponge') errors.push(`difficulty design marker mismatch: ${runtime.difficulty.design}`);
if(JSON.stringify(runtime.difficulty.hpCurve)!==JSON.stringify(HP_CURVE)) errors.push(`hp curve mismatch: ${JSON.stringify(runtime.difficulty.hpCurve)}`);
if(JSON.stringify(runtime.difficulty.speedCurve)!==JSON.stringify(SPEED_CURVE)) errors.push(`speed curve mismatch: ${JSON.stringify(runtime.difficulty.speedCurve)}`);
if(JSON.stringify(runtime.liveWavePlan)!==JSON.stringify(WAVE_PLAN)) errors.push(`live wave plan mismatch: ${JSON.stringify(runtime.liveWavePlan)}`);

async function sample(wave,type){
  await page.evaluate(({wave,type})=>{
    const game=window.__NEON_TEST__;
    game.state.enemies=[];
    game.state.wave=wave;
    const scale=1+(wave-1)*.24;
    game.state.enemies=[game.createEnemy(type,scale)];
  },{wave,type});
  await page.waitForTimeout(120);
  return page.evaluate(()=>{
    const enemy=window.__NEON_TEST__.state.enemies[0];
    return {
      wave:window.__NEON_TEST__.state.wave,
      type:enemy.type,
      hp:enemy.hp,
      maxHp:enemy.maxHp,
      shield:enemy.shield,
      maxShield:enemy.maxShield,
      speed:enemy.def.speed,
      appliedHpMultiplier:enemy.__difficultyMultiplier,
      build:enemy.__difficultyBuild
    };
  });
}

const samples=[];
const plan=[[1,'drone'],[2,'runner'],[3,'brute'],[4,'shield'],[5,'runner'],[5,'boss']];
for(const [wave,type] of plan){
  const result=await sample(wave,type);
  samples.push(result);
  const scale=1+(wave-1)*.24;
  const expectedHp=BASE[type].hp*scale*HP_CURVE[wave-1]*TYPE_HP[type];
  const expectedSpeed=BASE[type].speed*SPEED_CURVE[wave-1]*TYPE_SPEED[type];
  if(Math.abs(result.maxHp-expectedHp)>.05) errors.push(`${type} wave ${wave} hp mismatch: expected ${expectedHp}, got ${result.maxHp}`);
  if(Math.abs(result.speed-expectedSpeed)>.05) errors.push(`${type} wave ${wave} speed mismatch: expected ${expectedSpeed}, got ${result.speed}`);
  if(result.build!==BUILD) errors.push(`${type} wave ${wave} was not difficulty-scaled`);
  if(type==='shield'){
    const expectedShield=BASE.shield.shield*scale*HP_CURVE[wave-1]*TYPE_HP.shield;
    if(Math.abs(result.maxShield-expectedShield)>.05) errors.push(`shield wave ${wave} shield mismatch: expected ${expectedShield}, got ${result.maxShield}`);
  }
}

const boss=samples.find(item=>item.type==='boss');
if(!boss||boss.maxHp<2650||boss.maxHp>2725) errors.push(`boss hp outside non-sponge band: ${JSON.stringify(boss)}`);
if(!boss||boss.speed<47.5||boss.speed>49) errors.push(`boss speed outside pressure band: ${JSON.stringify(boss)}`);
const lateRunner=samples.find(item=>item.type==='runner'&&item.wave===5);
if(!lateRunner||lateRunner.speed<169||lateRunner.speed>172) errors.push(`wave 5 runner speed outside intended band: ${JSON.stringify(lateRunner)}`);

// Wave 1 must remain playable with a basic two-tower opening.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=1000;
  game.buildTower('rail',1);
  game.buildTower('cryo',3);
  game.state.speed=8;
  game.startWave();
});
await page.waitForTimeout(700);
await page.screenshot({path:`${out}/01-wave1-pressure.png`});
await page.waitForFunction(()=>!window.__NEON_TEST__.state.waveActive||window.__NEON_TEST__.state.hp<=0,null,{timeout:30000});
const earlyRun=await page.evaluate(()=>({
  hp:window.__NEON_TEST__.state.hp,
  kills:window.__NEON_TEST__.state.kills,
  wave:window.__NEON_TEST__.state.wave
}));
if(earlyRun.hp<=0) errors.push(`wave 1 became unfair for a basic two-tower opening: ${JSON.stringify(earlyRun)}`);

// Wave 5 should create a dense, fast fight, but a full mixed level-1 board should
// still resolve rather than grind indefinitely. No artificial damage multipliers.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=6000;
  const layout=['rail','cryo','plasma','arcane','rail','cryo','plasma','arcane'];
  layout.forEach((type,slot)=>game.buildTower(type,slot));
  game.state.wave=4;
  game.state.speed=8;
  game.startWave();
});

const lateTimeline=[];
let peakActive=0;
let resolvedAt=null;
for(let tick=1;tick<=25;tick+=1){
  await page.waitForTimeout(1000);
  const sample=await page.evaluate(tick=>{
    const game=window.__NEON_TEST__;
    const progress=game.state.enemies.map(enemy=>enemy.progress).filter(Number.isFinite);
    return {
      second:tick,
      hp:game.state.hp,
      kills:game.state.kills,
      enemies:game.state.enemies.length,
      queued:game.state.spawnQueue.length,
      projectiles:game.state.projectiles.length,
      waveActive:game.state.waveActive,
      avgProgress:progress.length?progress.reduce((sum,value)=>sum+value,0)/progress.length:null,
      maxProgress:progress.length?Math.max(...progress):null
    };
  },tick);
  lateTimeline.push(sample);
  peakActive=Math.max(peakActive,sample.enemies);
  if(!sample.waveActive||sample.hp<=0){resolvedAt=tick;break;}
}
await page.screenshot({path:`${out}/02-wave5-pressure.png`});
const lateRun=await page.evaluate(()=>({
  hp:window.__NEON_TEST__.state.hp,
  kills:window.__NEON_TEST__.state.kills,
  wave:window.__NEON_TEST__.state.wave,
  waveActive:window.__NEON_TEST__.state.waveActive,
  paused:window.__NEON_TEST__.state.paused
}));
if(lateRun.hp<=0) errors.push(`wave 5 full mixed level-1 board collapsed: ${JSON.stringify(lateRun)}`);
if(lateRun.waveActive) errors.push(`wave 5 became a grind and did not resolve in 25s at x8: ${JSON.stringify(lateTimeline)}`);
if(peakActive<5) errors.push(`wave 5 never produced meaningful simultaneous pressure: peak ${peakActive}`);

const report={errors,runtime,samples,earlyRun,lateRun,peakActive,resolvedAt,lateTimeline};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
