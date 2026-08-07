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

await page.goto(`${base}?qa=build`,{waitUntil:'networkidle',timeout:45000});
await page.waitForFunction(()=>
  window.__NEON_TEST__?.state?.ready&&
  window.__RENDERED_MAP_READY&&
  window.__BUILD_SELECTION_FIX?.ready,
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
  return page.evaluate(()=>({
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
    selectedCards:[...document.querySelectorAll('.tower-card.selected')].map(card=>card.dataset.type),
    disabledCards:Object.fromEntries([...document.querySelectorAll('.tower-card')].map(card=>[card.dataset.type,card.disabled]))
  }));
}

const loaded=await snapshot();
if(loaded.runtime.build!=='build-selection-fix-v1-20260807') errors.push(`runtime build mismatch: ${JSON.stringify(loaded.runtime)}`);
if(loaded.state.selectedBuild!=='rail'||loaded.selectedCards.join(',')!=='rail') errors.push(`initial rail selection mismatch: ${JSON.stringify(loaded)}`);

// Regression: one card selection must support consecutive placements.
await page.locator('.tower-card[data-type="rail"]').click();
await clickSlot(1);
const afterFirst=await snapshot();
if(afterFirst.state.towers.length!==1||afterFirst.state.towers[0].type!=='rail') errors.push(`first rail placement failed: ${JSON.stringify(afterFirst)}`);
if(afterFirst.state.selectedBuild!=='rail'||afterFirst.runtime.preferredBuild!=='rail'||afterFirst.selectedCards.join(',')!=='rail') errors.push(`rail selection was lost after first build: ${JSON.stringify(afterFirst)}`);

await clickSlot(3);
const afterSecond=await snapshot();
if(afterSecond.state.towers.length!==2||afterSecond.state.towers.filter(tower=>tower.type==='rail').length!==2) errors.push(`second rail placement required reselect: ${JSON.stringify(afterSecond)}`);
if(afterSecond.state.selectedBuild!=='rail'||afterSecond.selectedCards.join(',')!=='rail') errors.push(`rail selection was lost after second build: ${JSON.stringify(afterSecond)}`);

// Regression: cards must become enabled immediately when credits cross their cost,
// without requiring another expensive updateUI() call or a reselect.
await page.evaluate(()=>{window.__NEON_TEST__.state.credits=170;});
await page.waitForTimeout(100);
const beforeAffordable=await snapshot();
if(beforeAffordable.disabledCards.arcane!==true) errors.push(`arcane should be disabled below cost: ${JSON.stringify(beforeAffordable)}`);
await page.evaluate(()=>{window.__NEON_TEST__.state.credits=180;});
await page.waitForTimeout(100);
const afterAffordable=await snapshot();
if(afterAffordable.disabledCards.arcane!==false) errors.push(`arcane did not enable when credits reached cost: ${JSON.stringify(afterAffordable)}`);

await page.locator('.tower-card[data-type="arcane"]').click();
await clickSlot(5);
const afterArcaneFirst=await snapshot();
if(afterArcaneFirst.state.towers.filter(tower=>tower.type==='arcane').length!==1) errors.push(`first arcane placement failed: ${JSON.stringify(afterArcaneFirst)}`);
if(afterArcaneFirst.state.selectedBuild!=='arcane'||afterArcaneFirst.runtime.preferredBuild!=='arcane') errors.push(`arcane selection was lost after build: ${JSON.stringify(afterArcaneFirst)}`);

await page.evaluate(()=>{window.__NEON_TEST__.state.credits=180;});
await page.waitForTimeout(100);
await clickSlot(7);
const afterArcaneSecond=await snapshot();
if(afterArcaneSecond.state.towers.filter(tower=>tower.type==='arcane').length!==2) errors.push(`second arcane placement required reselect: ${JSON.stringify(afterArcaneSecond)}`);

// Clicking an existing placed tower intentionally changes to inspect/drag mode and
// should visibly clear build mode, avoiding another hidden UI/state mismatch.
await clickSlot(1);
const afterInspect=await snapshot();
if(afterInspect.state.selectedBuild!==null||afterInspect.runtime.preferredBuild!==null||afterInspect.selectedCards.length!==0) errors.push(`placed tower inspection did not clear build mode consistently: ${JSON.stringify(afterInspect)}`);

await page.evaluate(()=>{window.__NEON_TEST__.state.credits=1000;});
await page.waitForTimeout(100);
const countBeforeBlank=afterInspect.state.towers.length;
await clickSlot(9);
const afterBlank=await snapshot();
if(afterBlank.state.towers.length!==countBeforeBlank) errors.push(`blank slot built unexpectedly after explicit tower inspection: ${JSON.stringify(afterBlank)}`);

await page.screenshot({path:`${out}/build-selection-persistence.png`});
const report={errors,loaded,afterFirst,afterSecond,beforeAffordable,afterAffordable,afterArcaneFirst,afterArcaneSecond,afterInspect,afterBlank};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
await browser.close();

if(errors.length){
  console.error(JSON.stringify(report,null,2));
  process.exit(1);
}
console.log(JSON.stringify(report,null,2));
