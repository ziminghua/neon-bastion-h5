import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:8080/';
const out='artifacts/build-selection';
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
  window.__RENDERED_MAP_READY&&
  window.__NEON_DRAFT__?.current&&
  window.__BUILD_SELECTION_FIX?.ready&&
  document.querySelector('.tower-card.draft-current:not(.draft-hidden)'),
  null,{timeout:45000}
);
await page.waitForTimeout(250);

const canvas=page.locator('#game');
async function clickSlot(slotIndex){
  const slot=await page.evaluate(index=>window.__NEON_TEST__.level.slots[index],slotIndex);
  const box=await canvas.boundingBox();
  if(!box) throw new Error('Canvas has no bounding box');
  await page.mouse.click(
    box.x+slot.x/1600*box.width,
    box.y+slot.y/900*box.height
  );
  await page.waitForTimeout(120);
}

function snapshot(){
  return page.evaluate(()=>{
    const current=window.__NEON_DRAFT__.current;
    const currentCard=document.querySelector('.tower-card.draft-current:not(.draft-hidden)');
    return {
      draft:{
        current,
        next:window.__NEON_DRAFT__.next,
        cost:window.__NEON_TEST__.towerTypes[current].cost
      },
      state:{
        credits:window.__NEON_TEST__.state.credits,
        selectedBuild:window.__NEON_TEST__.state.selectedBuild,
        selectedTower:window.__NEON_TEST__.state.selectedTower?{
          type:window.__NEON_TEST__.state.selectedTower.type,
          slot:window.__NEON_TEST__.state.selectedTower.slot
        }:null,
        towers:window.__NEON_TEST__.state.towers.map(tower=>({type:tower.type,slot:tower.slot,level:tower.level}))
      },
      runtime:window.__BUILD_SELECTION_FIX,
      currentCard:currentCard?{
        type:currentCard.dataset.type,
        selected:currentCard.classList.contains('selected'),
        disabled:currentCard.disabled,
        hidden:currentCard.classList.contains('draft-hidden')
      }:null,
      selectedCards:[...document.querySelectorAll('.tower-card.selected')].map(card=>card.dataset.type)
    };
  });
}

async function setCredits(value){
  await page.evaluate(credits=>{window.__NEON_TEST__.state.credits=credits;},value);
  await page.waitForTimeout(120);
}

async function buildCurrent(slotIndex){
  const before=await snapshot();
  await setCredits(before.draft.cost);
  const count=before.state.towers.length;
  const type=before.draft.current;
  await clickSlot(slotIndex);
  await page.waitForFunction(({count,type})=>
    window.__NEON_TEST__.state.towers.length===count+1&&
    window.__NEON_TEST__.state.towers.some(tower=>tower.type===type)&&
    window.__NEON_DRAFT__.current!==type,
    {count,type},{timeout:10000}
  );
  await page.waitForTimeout(100);
  return {before,after:await snapshot()};
}

const loaded=await snapshot();
if(loaded.runtime.build!=='build-selection-fix-v2-20260807') errors.push(`runtime build mismatch: ${JSON.stringify(loaded.runtime)}`);
if(loaded.runtime.draftBuild!==loaded.draft.current||loaded.runtime.preferredBuild!==loaded.draft.current) errors.push(`draft offer not recognized as authoritative: ${JSON.stringify(loaded)}`);
if(loaded.state.selectedBuild!==loaded.draft.current||!loaded.currentCard?.selected) errors.push(`initial current tower is not armed: ${JSON.stringify(loaded)}`);

// Build the current random-draft offer by clicking only a map node. Do not click
// the bottom card first; that is the user regression being protected.
const firstBuild=await buildCurrent(1);
if(firstBuild.after.state.towers.length!==1||firstBuild.after.state.towers[0].type!==firstBuild.before.draft.current) errors.push(`first current offer failed to build: ${JSON.stringify(firstBuild)}`);
if(firstBuild.after.state.selectedBuild!==firstBuild.after.draft.current||firstBuild.after.runtime.preferredBuild!==firstBuild.after.draft.current||!firstBuild.after.currentCard?.selected) errors.push(`next draft offer was not automatically armed: ${JSON.stringify(firstBuild)}`);

// A second offer must also build without any card re-selection in between.
const secondBuild=await buildCurrent(3);
if(secondBuild.after.state.towers.length!==2) errors.push(`second offer required reselect: ${JSON.stringify(secondBuild)}`);
if(secondBuild.after.state.towers[1].type!==secondBuild.before.draft.current) errors.push(`second built tower type mismatch: ${JSON.stringify(secondBuild)}`);

// Inspecting/dragging an existing tower makes core app.js set selectedBuild=null.
// The visible CURRENT TOWER card must remain the fallback, so the very next
// empty-node click still deploys it without another card click.
await clickSlot(1);
const afterInspect=await snapshot();
if(afterInspect.state.selectedBuild!==null) errors.push(`placed tower inspection should enter inspector mode: ${JSON.stringify(afterInspect)}`);
if(afterInspect.runtime.preferredBuild!==afterInspect.draft.current||!afterInspect.currentCard?.selected) errors.push(`visible current offer was lost during tower inspection: ${JSON.stringify(afterInspect)}`);

const inspectOffer=afterInspect.draft.current;
const inspectCost=afterInspect.draft.cost;
const countBeforeInspectRecovery=afterInspect.state.towers.length;
await setCredits(inspectCost);
await clickSlot(5);
await page.waitForFunction(({count,type})=>
  window.__NEON_TEST__.state.towers.length===count+1&&
  window.__NEON_TEST__.state.towers.some(tower=>tower.slot===5&&tower.type===type),
  {count:countBeforeInspectRecovery,type:inspectOffer},{timeout:10000}
);
await page.waitForTimeout(120);
const afterInspectRecovery=await snapshot();
if(afterInspectRecovery.state.towers.length!==countBeforeInspectRecovery+1) errors.push(`empty node did not re-arm visible offer after inspection: ${JSON.stringify(afterInspectRecovery)}`);

// Credits often rise from combat kills while updateUI(false) is running. The
// visible current card must switch from disabled to enabled immediately when
// credits reach its cost, with no extra selection click.
const affordability=await snapshot();
await setCredits(Math.max(0,affordability.draft.cost-1));
const beforeAffordable=await snapshot();
if(beforeAffordable.currentCard?.disabled!==true) errors.push(`current card should be disabled below cost: ${JSON.stringify(beforeAffordable)}`);
await setCredits(affordability.draft.cost);
const afterAffordable=await snapshot();
if(afterAffordable.currentCard?.disabled!==false) errors.push(`current card did not enable when credits reached cost: ${JSON.stringify(afterAffordable)}`);

const countBeforeAffordableBuild=afterAffordable.state.towers.length;
const affordableType=afterAffordable.draft.current;
await clickSlot(7);
await page.waitForFunction(({count,type})=>
  window.__NEON_TEST__.state.towers.length===count+1&&
  window.__NEON_TEST__.state.towers.some(tower=>tower.slot===7&&tower.type===type),
  {count:countBeforeAffordableBuild,type:affordableType},{timeout:10000}
);
await page.waitForTimeout(120);
const afterAffordableBuild=await snapshot();
if(afterAffordableBuild.state.towers.length!==countBeforeAffordableBuild+1) errors.push(`affordable current tower still required a reselect: ${JSON.stringify(afterAffordableBuild)}`);

await page.screenshot({path:`${out}/build-selection-persistence.png`});
const report={errors,loaded,firstBuild,secondBuild,afterInspect,afterInspectRecovery,beforeAffordable,afterAffordable,afterAffordableBuild};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();

if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
