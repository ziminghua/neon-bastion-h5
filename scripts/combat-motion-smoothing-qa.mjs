import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/combat-motion';
const BUILD='combat-motion-smoothing-v1-20260807';
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

await page.goto(`${base}?qa=build&motionQa=${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(expected=>
  window.__NEON_TEST__?.state?.ready&&
  window.__COMBAT_MOTION_RUNTIME?.ready&&
  window.__COMBAT_MOTION_RUNTIME.build===expected,
BUILD,{timeout:45000});
await page.waitForTimeout(150);

const loaded=await page.evaluate(expected=>({
  expected,
  runtime:{...window.__COMBAT_MOTION_RUNTIME},
  script:[...document.scripts].map(script=>script.src).find(src=>src.includes('combat-motion-smoothing-v1.js'))||''
}),BUILD);
if(!loaded.script.includes(`build=${BUILD}`)) errors.push(`motion cache token missing: ${loaded.script}`);
if(loaded.runtime.routinePlasmaCameraShake!==false) errors.push(`routine plasma shake policy wrong: ${JSON.stringify(loaded.runtime)}`);
if(loaded.runtime.enemyHitStop!==false) errors.push(`enemy hit-stop policy wrong: ${JSON.stringify(loaded.runtime)}`);

async function setupShot(towerType,slot=3){
  await page.evaluate(({towerType,slot})=>{
    const game=window.__NEON_TEST__;
    game.resetGame();
    game.state.credits=9999;
    game.state.enemies=[];
    game.state.projectiles=[];
    game.state.beams=[];
    game.state.screenShake=0;
    game.buildTower(towerType,slot);
    const tower=game.state.towers[0];
    tower.cooldown=999;
    let bestProgress=0;
    let bestDistance=Infinity;
    const anchor=game.level.slots[slot];
    for(let i=0;i<=1000;i+=1){
      const progress=i/1000;
      const p=game.pathPoint(progress);
      const d=Math.hypot(p.x-anchor.x,p.y-anchor.y);
      if(d<bestDistance){bestDistance=d;bestProgress=progress;}
    }
    const enemy=game.createEnemy('drone',1);
    enemy.progress=bestProgress;
    enemy.hp=9999;
    enemy.maxHp=9999;
    game.state.enemies=[enemy];
  },{towerType,slot});
  await page.waitForTimeout(90);
}

// Rail: instantaneous hit should not pause enemy motion or shake the camera.
await setupShot('rail');
const rail=await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const tower=game.state.towers[0];
  const enemy=game.state.enemies[0];
  game.fireTower(tower,enemy);
  tower.cooldown=999;
  return {
    recoil:tower.recoil,
    recoilCap:tower.__smoothRecoilCap,
    impact:enemy.impact,
    rawImpact:enemy.__rawVisualImpact,
    screenShake:game.state.screenShake
  };
});
if(rail.recoil>0.421) errors.push(`rail recoil too large: ${JSON.stringify(rail)}`);
if(rail.impact!==0) errors.push(`rail hit still creates movement hit-stop: ${JSON.stringify(rail)}`);
if(rail.screenShake!==0) errors.push(`rail hit shakes camera: ${JSON.stringify(rail)}`);

// Plasma: keep blast visuals but suppress the routine 10px whole-screen shake.
await setupShot('plasma');
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const tower=game.state.towers[0];
  game.fireTower(tower,game.state.enemies[0]);
  tower.cooldown=999;
});
await page.waitForFunction(()=>window.__NEON_TEST__.state.projectiles.length===0,null,{timeout:5000});
await page.waitForTimeout(60);
const plasma=await page.evaluate(()=>({
  recoil:window.__NEON_TEST__.state.towers[0].recoil,
  recoilCap:window.__NEON_TEST__.state.towers[0].__smoothRecoilCap,
  impact:window.__NEON_TEST__.state.enemies[0]?.impact??0,
  screenShake:window.__NEON_TEST__.state.screenShake,
  suppressed:window.__COMBAT_MOTION_RUNTIME.suppressedRoutineShakes
}));
if(plasma.recoil>0.481) errors.push(`plasma recoil too large: ${JSON.stringify(plasma)}`);
if(plasma.impact!==0) errors.push(`plasma hit still creates movement hit-stop: ${JSON.stringify(plasma)}`);
if(plasma.screenShake!==0) errors.push(`routine plasma hit still shakes camera: ${JSON.stringify(plasma)}`);
if(plasma.suppressed<1) errors.push(`plasma shake suppression did not trigger: ${JSON.stringify(plasma)}`);

// Cryo should still slow through slowFactor, but without the separate impactDrag pause.
await setupShot('cryo');
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const tower=game.state.towers[0];
  game.fireTower(tower,game.state.enemies[0]);
  tower.cooldown=999;
});
await page.waitForFunction(()=>window.__NEON_TEST__.state.projectiles.length===0,null,{timeout:5000});
await page.waitForTimeout(60);
const cryo=await page.evaluate(()=>{
  const enemy=window.__NEON_TEST__.state.enemies[0];
  const tower=window.__NEON_TEST__.state.towers[0];
  return {
    slow:enemy?.slow??0,
    slowFactor:enemy?.slowFactor??1,
    impact:enemy?.impact??0,
    recoil:tower.recoil,
    recoilCap:tower.__smoothRecoilCap
  };
});
if(!(cryo.slow>0&&cryo.slowFactor<1)) errors.push(`cryo lost its continuous slow: ${JSON.stringify(cryo)}`);
if(cryo.impact!==0) errors.push(`cryo still has separate hit-stop drag: ${JSON.stringify(cryo)}`);

// Big event shakes must remain available; only the routine Plasma value is suppressed.
const bigShake=await page.evaluate(()=>{
  const state=window.__NEON_TEST__.state;
  state.screenShake=12;
  const core=state.screenShake;
  state.screenShake=18;
  const boss=state.screenShake;
  state.screenShake=8;
  const emp=state.screenShake;
  state.screenShake=0;
  return {core,boss,emp};
});
if(bigShake.core!==12||bigShake.boss!==18||bigShake.emp!==8) errors.push(`big-event shake was incorrectly suppressed: ${JSON.stringify(bigShake)}`);

// Capture a normal mixed-fire scene for visual regression; no full-screen random jitter is required for routine hits.
await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  [['rail',1],['cryo',3],['plasma',5],['arcane',7]].forEach(([type,slot])=>game.buildTower(type,slot));
  game.state.wave=1;
  game.state.speed=1;
  game.startWave();
});
await page.waitForTimeout(1800);
await page.screenshot({path:`${out}/01-smooth-combat-feedback.png`});

const finalRuntime=await page.evaluate(()=>({...window.__COMBAT_MOTION_RUNTIME}));
const report={errors,loaded,rail,plasma,cryo,bigShake,finalRuntime};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();
if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1);}
console.log(JSON.stringify(report,null,2));
