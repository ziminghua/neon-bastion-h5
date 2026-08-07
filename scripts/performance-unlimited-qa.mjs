import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/performance';
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

await page.goto(`${base}?draftSeed=424242`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>
  window.__NEON_TEST__?.state?.ready&&
  window.__NEON_DRAFT__&&
  window.__BUILD_FLOW_RUNTIME?.ready&&
  window.__PERFORMANCE_RUNTIME?.ready&&
  window.__FUSION_RESONANCE_RUNTIME?.ready,
  null,
  {timeout:45000}
);

const seeded=await page.evaluate(()=>{
  document.getElementById('intro')?.classList.add('hidden');
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  const types=['rail','cryo','plasma','arcane'];
  const results=[];
  for(let slot=0;slot<8;slot+=1){
    results.push({slot,type:types[slot%types.length],built:Boolean(game.buildTower(types[slot%types.length],slot))});
  }
  return {results,towerCount:game.state.towers.length};
});
if(seeded.results.some(item=>!item.built)||seeded.towerCount!==8) errors.push(`failed to seed eight towers: ${JSON.stringify(seeded)}`);

await page.waitForTimeout(450);
const canvasBox=await page.locator('#game').boundingBox();
if(!canvasBox) throw new Error('game canvas missing');

async function clickLogicalSlot(slotIndex){
  const point=await page.evaluate(index=>window.__NEON_TEST__.level.slots[index],slotIndex);
  const x=canvasBox.x+(point.x/1600)*canvasBox.width;
  const y=canvasBox.y+(point.y/900)*canvasBox.height;
  const before=await page.evaluate(()=>window.__NEON_TEST__.state.towers.length);
  await page.mouse.click(x,y);
  await page.waitForFunction(expected=>window.__NEON_TEST__.state.towers.length===expected,before+1,{timeout:5000});
  await page.waitForTimeout(180);
  return page.evaluate(index=>{
    const game=window.__NEON_TEST__;
    const tower=game.state.towers.find(item=>item.slot===index);
    return {slot:index,type:tower?.type||null,towerCount:game.state.towers.length};
  },slotIndex);
}

const ninth=await clickLogicalSlot(8);
const tenth=await clickLogicalSlot(9);

const buildReport=await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  return {
    towerCount:game.state.towers.length,
    slots:game.state.towers.map(tower=>tower.slot).sort((a,b)=>a-b),
    credits:game.state.credits,
    buildFlow:structuredClone(window.__BUILD_FLOW_RUNTIME),
    powerText:document.getElementById('powerText')?.textContent||'',
    powerCount:document.getElementById('powerText')?.dataset.towerCount||'',
    cardDisabled:Object.fromEntries([...document.querySelectorAll('.tower-card[data-type]')].map(card=>[card.dataset.type,card.disabled]))
  };
});
buildReport.pointerPlacements={ninth,tenth};

if(buildReport.towerCount!==10) errors.push(`expected 10 placed towers, got ${buildReport.towerCount}`);
if(buildReport.slots.join(',')!=='0,1,2,3,4,5,6,7,8,9') errors.push(`unexpected occupied slots: ${buildReport.slots.join(',')}`);
if(!ninth.type||ninth.towerCount!==9) errors.push(`real pointer did not place tower 9: ${JSON.stringify(ninth)}`);
if(!tenth.type||tenth.towerCount!==10) errors.push(`real pointer did not place tower 10: ${JSON.stringify(tenth)}`);
if(buildReport.buildFlow?.artificialTowerLimit!==false) errors.push('build flow still reports an artificial tower limit');
if(buildReport.powerCount!=='10') errors.push(`tower HUD did not expose count 10: ${buildReport.powerCount}`);
if(Object.values(buildReport.cardDisabled).some(Boolean)) errors.push(`high-credit tower offer was disabled: ${JSON.stringify(buildReport.cardDisabled)}`);

await page.screenshot({path:`${out}/01-ten-towers-no-cap.png`,fullPage:true});

const budgetProbe=await page.evaluate(()=>{
  const state=window.__NEON_TEST__.state;
  const makeParticle=index=>({x:400+(index%40),y:360+(index%25),vx:0,vy:0,life:1,max:1,size:2,color:'#8cf6ff',gravity:0});
  for(let i=0;i<1000;i+=1) state.particles.push(makeParticle(i));
  for(let i=0;i<240;i+=1) state.rings.push({x:800,y:450,color:'#8cf6ff',from:4,to:28,life:1,max:1,width:2});
  for(let i=0;i<180;i+=1) state.runes.push({x:800,y:450,color:'#df74ff',life:1,max:1,scale:.5,rot:0});
  for(let i=0;i<140;i+=1) state.decals.push({type:'frost',x:800,y:450,life:1,max:1,scale:.5,rot:0});
  for(let i=0;i<180;i+=1) state.floating.push({x:800,y:450,text:'13',color:'#fff',size:12,life:1,max:.75});
  for(let i=0;i<140;i+=1) state.fx.push({asset:'hit',x:800,y:450,life:1,max:1,scale:.4,rot:0,blend:'screen'});
  return structuredClone(window.__PERFORMANCE_RUNTIME);
});

for(const [name,budget] of Object.entries(budgetProbe.budgets||{})){
  const count=budgetProbe.counts?.[name]??0;
  if(count>budget.hard) errors.push(`${name} exceeded hard budget ${budget.hard}: ${count}`);
}
if(!Object.values(budgetProbe.dropped||{}).some(value=>value>0)) errors.push('effect budget did not drop any overflow visuals during saturation probe');
if(budgetProbe.mainLoopThrottled!==false) errors.push('main gameplay loop must remain unthrottled');
const targets=budgetProbe.schedulerTargets||{};
if(targets.fusionIdleHz!==15||targets.fusionInteractiveHz!==30||targets.networkHz!==30||targets.draftHz!==12.5){
  errors.push(`unexpected scheduler targets: ${JSON.stringify(targets)}`);
}

await page.evaluate(()=>{
  const game=window.__NEON_TEST__;
  const state=game.state;
  state.particles.length=0;
  state.rings.length=0;
  state.runes.length=0;
  state.decals.length=0;
  state.floating.length=0;
  state.fx.length=0;
  state.projectiles.length=0;
  state.beams.length=0;
  state.hp=999;
  state.maxHp=999;
  state.running=true;
  state.paused=false;
  state.waveActive=true;
  state.buildPhase=false;
  state.spawnQueue=[];
  state.selectedTower=null;
  state.hoverSlot=-1;
  state.drag=null;
  state.speed=1;
  state.enemies=Array.from({length:22},(_,index)=>{
    const type=['runner','drone','brute','shield'][index%4];
    const enemy=game.createEnemy(type,1);
    enemy.progress=.04+(index%15)*.032;
    enemy.hp=10000;
    enemy.maxHp=10000;
    return enemy;
  });
});

await page.waitForTimeout(5500);
const stressReport=await page.evaluate(()=>({
  performance:structuredClone(window.__PERFORMANCE_RUNTIME),
  fusion:structuredClone(window.__FUSION_RESONANCE_RUNTIME),
  board:structuredClone(window.__RESONANCE_BOARD_RUNTIME),
  towers:window.__NEON_TEST__.state.towers.length,
  enemies:window.__NEON_TEST__.state.enemies.length,
  projectiles:window.__NEON_TEST__.state.projectiles.length
}));

const perf=stressReport.performance||{};
// Headless CI software-rasterizes the 1600x900 canvas and its absolute rAF rate
// is not representative of a player's browser. Keep FPS as telemetry only;
// regress deterministic scheduler policy, effect caps and gameplay integrity.
if(perf.mainLoopThrottled!==false) errors.push('stress runtime throttled the main gameplay loop');
if(perf.highLoad!==true) errors.push('stress runtime did not enter high-load mode');
if(perf.projectileTrailCap!==7) errors.push(`high-load projectile trail cap was not applied: ${perf.projectileTrailCap}`);
if((perf.auxiliaryHz?.fusion||0)>31) errors.push(`fusion auxiliary loop exceeded configured max: ${perf.auxiliaryHz?.fusion} Hz`);
if((perf.auxiliaryHz?.network||0)>31) errors.push(`network renderer exceeded configured max: ${perf.auxiliaryHz?.network} Hz`);
if((perf.auxiliaryHz?.draft||0)>13.5) errors.push(`draft observer exceeded configured max: ${perf.auxiliaryHz?.draft} Hz`);
if(!Object.values(perf.dropped||{}).some(value=>value>0)) errors.push('combat stress did not exercise visual effect shedding');
for(const [name,budget] of Object.entries(perf.budgets||{})){
  const count=perf.counts?.[name]??0;
  if(count>budget.hard) errors.push(`${name} exceeded hard budget under combat stress: ${count}/${budget.hard}`);
}
if(stressReport.towers!==10) errors.push(`tower count changed during stress: ${stressReport.towers}`);
if((stressReport.fusion?.linkCount||0)<1||(stressReport.board?.visibleLinkCount||0)<1) errors.push('fusion links disappeared under 10-tower stress');

await page.screenshot({path:`${out}/02-stress-runtime.png`,fullPage:true});

const report={
  errors,
  note:'FPS is telemetry only in headless CI because the full 1600x900 Canvas is software-rasterized.',
  buildReport,
  budgetProbe,
  stressReport
};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(errors.length) process.exit(1);
