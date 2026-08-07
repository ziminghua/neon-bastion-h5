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

const buildReport=await page.evaluate(async()=>{
  document.getElementById('intro')?.classList.add('hidden');
  const game=window.__NEON_TEST__;
  game.resetGame();
  game.state.credits=9999;
  const types=['rail','cryo','plasma','arcane'];
  const results=[];
  for(let slot=0;slot<game.level.slots.length;slot+=1){
    results.push({slot,type:types[slot%types.length],built:Boolean(game.buildTower(types[slot%types.length],slot))});
  }
  await new Promise(resolve=>setTimeout(resolve,500));
  return {
    results,
    towerCount:game.state.towers.length,
    slots:game.state.towers.map(tower=>tower.slot).sort((a,b)=>a-b),
    credits:game.state.credits,
    buildFlow:structuredClone(window.__BUILD_FLOW_RUNTIME),
    powerText:document.getElementById('powerText')?.textContent||'',
    powerCount:document.getElementById('powerText')?.dataset.towerCount||'',
    cardDisabled:Object.fromEntries([...document.querySelectorAll('.tower-card[data-type]')].map(card=>[card.dataset.type,card.disabled]))
  };
});

if(buildReport.results.some(item=>!item.built)) errors.push(`failed tower builds: ${JSON.stringify(buildReport.results)}`);
if(buildReport.towerCount!==10) errors.push(`expected 10 placed towers, got ${buildReport.towerCount}`);
if(buildReport.slots.join(',')!=='0,1,2,3,4,5,6,7,8,9') errors.push(`unexpected occupied slots: ${buildReport.slots.join(',')}`);
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
  for(let i=0;i<180;i+=1) state.floating.push({x:800,y:450,text:'13',color:'#fff',size:12,life:1,max:1});
  for(let i=0;i<140;i+=1) state.fx.push({asset:'hit',x:800,y:450,life:1,max:1,scale:.4,rot:0,blend:'screen'});
  return structuredClone(window.__PERFORMANCE_RUNTIME);
});

for(const [name,budget] of Object.entries(budgetProbe.budgets||{})){
  const count=budgetProbe.counts?.[name]??0;
  if(count>budget.hard) errors.push(`${name} exceeded hard budget ${budget.hard}: ${count}`);
}
if(!Object.values(budgetProbe.dropped||{}).some(value=>value>0)) errors.push('effect budget did not drop any overflow visuals during saturation probe');

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
if((perf.fps||0)<20) errors.push(`stress FPS fell below regression floor: ${perf.fps}`);
if((perf.auxiliaryHz?.fusion||0)>22) errors.push(`fusion auxiliary loop not throttled: ${perf.auxiliaryHz?.fusion} Hz`);
if((perf.auxiliaryHz?.network||0)>36) errors.push(`network renderer not throttled: ${perf.auxiliaryHz?.network} Hz`);
if((perf.auxiliaryHz?.draft||0)>16) errors.push(`draft observer not throttled: ${perf.auxiliaryHz?.draft} Hz`);
for(const [name,budget] of Object.entries(perf.budgets||{})){
  const count=perf.counts?.[name]??0;
  if(count>budget.hard) errors.push(`${name} exceeded hard budget under combat stress: ${count}/${budget.hard}`);
}

await page.screenshot({path:`${out}/02-stress-runtime.png`,fullPage:true});

const report={
  errors,
  buildReport,
  budgetProbe,
  stressReport
};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(errors.length) process.exit(1);
