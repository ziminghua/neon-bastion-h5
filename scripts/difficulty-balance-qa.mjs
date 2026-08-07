import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/difficulty-balance';
const HP_CURVE=[1.08,1.15,1.24,1.36,1.48];
const SPEED_CURVE=[1.03,1.06,1.09,1.12,1.16];
const TYPE_HP={drone:1,runner:1,brute:1.06,shield:1.08,boss:1.18};
const TYPE_SPEED={drone:1,runner:1.03,brute:1,shield:1,boss:1.02};
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
await page.waitForFunction(()=>window.__NEON_TEST__?.state?.ready&&window.__DIFFICULTY_BALANCE?.ready&&window.__FUSION_RESONANCE_RUNTIME?.ready,null,{timeout:45000});
await page.waitForTimeout(250);

const runtime=await page.evaluate(()=>({
  difficulty:window.__DIFFICULTY_BALANCE,
  script:[...document.scripts].map(script=>script.src).find(src=>src.includes('difficulty-balance-v1.js'))||'',
  fusion:window.__FUSION_RESONANCE_RUNTIME
}));
if(runtime.difficulty.build!=='enemy-pressure-v1-20260807') errors.push(`difficulty build mismatch: ${JSON.stringify(runtime.difficulty)}`);
if(!runtime.script.includes('enemy-pressure-v1-20260807')) errors.push(`difficulty script cache token missing: ${runtime.script}`);
if(JSON.stringify(runtime.difficulty.hpCurve)!==JSON.stringify(HP_CURVE)) errors.push(`hp curve mismatch: ${JSON.stringify(runtime.difficulty.hpCurve)}`);
if(JSON.stringify(runtime.difficulty.speedCurve)!==JSON.stringify(SPEED_CURVE)) errors.push(`speed curve mismatch: ${JSON.stringify(runtime.difficulty.speedCurve)}`);

async function sample(wave,type){
  await page.evaluate(({wave,type})=>{
    const game=window.__NEON_TEST__;
    game.state.enemies=[];
    game.state.wave=wave;
    const scale=1+(wave-1)*.24;
    const enemy=game.createEnemy(type,scale);
    game.state.enemies=[enemy];
  },{wave,type});
  await page.waitForTimeout(120);
  return page.evaluate(()=>{
    const enemy=window.__NEON_TEST__.state.enemies[0];
    return {wave:window.__NEON_TEST__.state.wave,type:enemy.type,hp:enemy.hp,maxHp:enemy.maxHp,shield:enemy.shield,maxShield:enemy.maxShield,speed:enemy.def.speed,appliedHpMultiplier:enemy.__difficultyMultiplier,build:enemy.__difficultyBuild};
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
  if(result.build!=='enemy-pressure-v1-20260807') errors.push(`${type} wave ${wave} was not difficulty-scaled`);
  if(type==='shield'){
    const expectedShield=BASE.shield.shield*scale*HP_CURVE[wave-1]*TYPE_HP.shield;
    if(Math.abs(result.maxShield-expectedShield)>.05) errors.push(`shield wave ${wave} shield mismatch: expected ${expectedShield}, got ${result.maxShield}`);
  }
}

const boss=samples.find(item=>item.type==='boss');
if(!boss||boss.maxHp<3200||boss.maxHp>3500) errors.push(`boss hp outside intended pressure band: ${JSON.stringify(boss)}`);
if(!boss||boss.speed<44||boss.speed>46) errors.push(`boss speed outside intended pressure band: ${JSON.stringify(boss)}`);
const lateRunner=samples.find(item=>item.type==='runner'&&item.wave===5);
if(!lateRunner||lateRunner.speed<157||lateRunner.speed>159) errors.push(`wave 5 runner speed outside intended band: ${JSON.stringify(lateRunner)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.wave=1;
  const enemy=game.createEnemy('drone',1);game.state.enemies=[enemy];
});
await page.waitForTimeout(120);
const resetProbe=await page.evaluate(()=>{const enemy=window.__NEON_TEST__.state.enemies[0];return{id:enemy.id,maxHp:enemy.maxHp,multiplier:enemy.__difficultyMultiplier,build:enemy.__difficultyBuild};});
if(Math.abs(resetProbe.maxHp-38*1.08)>.05||resetProbe.build!=='enemy-pressure-v1-20260807') errors.push(`reset scaling failed: ${JSON.stringify(resetProbe)}`);

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=360;game.buildTower('rail',1);game.buildTower('cryo',3);game.state.speed=8;game.startWave();
});
await page.waitForTimeout(800);
await page.screenshot({path:`${out}/01-wave1-pressure.png`});
await page.waitForFunction(()=>!window.__NEON_TEST__.state.waveActive||window.__NEON_TEST__.state.hp<=0,null,{timeout:45000});
const earlyRun=await page.evaluate(()=>({hp:window.__NEON_TEST__.state.hp,kills:window.__NEON_TEST__.state.kills,wave:window.__NEON_TEST__.state.wave}));
if(earlyRun.hp<=0) errors.push(`wave 1 became unfair for a basic two-tower opening: ${JSON.stringify(earlyRun)}`);

await page.waitForTimeout(650);
const protocolVisible=await page.evaluate(()=>!document.getElementById('protocolModal').classList.contains('hidden'));
if(protocolVisible){await page.locator('.protocol-choice').first().click();await page.waitForFunction(()=>!window.__NEON_TEST__.state.paused,null,{timeout:10000});}

// Diagnostic late-wave pressure benchmark. Sample rather than hanging indefinitely so CI reports the actual combat state.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();game.state.credits=6000;
  const layout=['rail','cryo','plasma','arcane','rail','cryo','plasma','arcane'];
  layout.forEach((type,slot)=>game.buildTower(type,slot));
  game.state.wave=4;game.state.speed=8;game.startWave();
});
const lateTimeline=[];
for(let second=1;second<=14;second+=1){
  await page.waitForTimeout(1000);
  lateTimeline.push(await page.evaluate(second=>{
    const game=window.__NEON_TEST__;
    const progress=game.state.enemies.map(enemy=>enemy.progress).filter(Number.isFinite);
    return {
      second,
      running:game.state.running,
      paused:game.state.paused,
      waveActive:game.state.waveActive,
      hp:game.state.hp,
      enemies:game.state.enemies.length,
      queued:game.state.spawnQueue.length,
      projectiles:game.state.projectiles.length,
      beams:game.state.beams.length,
      rings:game.state.rings.length,
      minProgress:progress.length?Math.min(...progress):null,
      maxProgress:progress.length?Math.max(...progress):null,
      avgProgress:progress.length?progress.reduce((sum,value)=>sum+value,0)/progress.length:null,
      resultVisible:!document.getElementById('resultModal').classList.contains('hidden')
    };
  },second));
  if(!lateTimeline.at(-1).waveActive||lateTimeline.at(-1).hp<=0) break;
}
await page.screenshot({path:`${out}/02-wave5-pressure.png`});
const lateRun=await page.evaluate(()=>({hp:window.__NEON_TEST__.state.hp,kills:window.__NEON_TEST__.state.kills,wave:window.__NEON_TEST__.state.wave,waveActive:window.__NEON_TEST__.state.waveActive,paused:window.__NEON_TEST__.state.paused,title:document.getElementById('resultTitle').textContent,resultVisible:!document.getElementById('resultModal').classList.contains('hidden')}));
if(lateRun.hp<=0) errors.push(`wave 5 full mixed level-1 board collapsed: ${JSON.stringify(lateRun)}`);
if(lateRun.waveActive) errors.push(`wave 5 did not resolve inside pressure benchmark: ${JSON.stringify(lateTimeline)}`);

const report={errors,runtime,samples,resetProbe,earlyRun,lateRun,lateTimeline};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
