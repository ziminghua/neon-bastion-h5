import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out='artifacts/visual-qa';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('requestfailed',r=>errors.push(`requestfailed: ${r.url()} :: ${r.failure()?.errorText||'unknown'}`));

await page.goto('http://127.0.0.1:8080/?qa=level&draftSeed=20260805',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__NEON_TEST__?.level?.path?.length>=2,null,{timeout:20000});
await page.waitForTimeout(650);
const metrics=await page.evaluate(()=>{
  const {level,pathInfo}=window.__NEON_TEST__,distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const sample=Array.from({length:501},(_,index)=>{const target=pathInfo.total*index/500;let s=pathInfo.seg.at(-1);for(const c of pathInfo.seg){if(target<=c.start+c.len){s=c;break}}const t=Math.max(0,Math.min(1,(target-s.start)/s.len));return{x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t}});
  const coverage=range=>{const counts=sample.map(p=>level.slots.filter(s=>distance(p,s)<=range).length);return{covered:counts.filter(Boolean).length/counts.length,maxOverlap:Math.max(...counts),uncovered:counts.filter(v=>!v).length}};
  const pointSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2)):0;return distance(p,{x:a.x+dx*t,y:a.y+dy*t})};
  const slotPath=level.slots.map(slot=>Math.min(...level.path.slice(0,-1).map((p,i)=>pointSegment(slot,p,level.path[i+1]))));
  const pairs=[];for(let i=0;i<level.slots.length;i++)for(let j=i+1;j<level.slots.length;j++)pairs.push(distance(level.slots[i],level.slots[j]));
  const hidden=level.slots.filter(s=>(s.x>=145&&s.x<=365&&s.y>=80&&s.y<=310)||(s.x>=1380&&s.y>=80&&s.y<=390)||s.y>=755);
  const bends=[];for(let i=1;i<level.path.length-1;i++){const a=level.path[i-1],b=level.path[i],c=level.path[i+1],v1={x:a.x-b.x,y:a.y-b.y},v2={x:c.x-b.x,y:c.y-b.y},dot=v1.x*v2.x+v1.y*v2.y,mag=Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y);bends.push(180-Math.acos(Math.max(-1,Math.min(1,dot/mag)))*180/Math.PI)}
  return{pathLength:pathInfo.total,direct:distance(level.path[0],level.path.at(-1)),points:level.path.length,slots:level.slots.length,landmarks:level.landmarks?.length||0,minPathDistance:Math.min(...slotPath),maxPathDistance:Math.max(...slotPath),minSlotSeparation:Math.min(...pairs),coverage175:coverage(175),coverage205:coverage(205),meaningfulBends:bends.filter(v=>v>=30).length,maxSegment:Math.max(...pathInfo.seg.map(s=>s.len)),hidden,bounds:{minX:Math.min(...level.path.map(p=>p.x)),maxX:Math.max(...level.path.map(p=>p.x)),minY:Math.min(...level.path.map(p=>p.y)),maxY:Math.max(...level.path.map(p=>p.y))},page:{scrollX:document.documentElement.scrollWidth-innerWidth,scrollY:document.documentElement.scrollHeight-innerHeight}};
});
if(metrics.pathLength<1900||metrics.pathLength>2150)errors.push(`path length outside delivery range: ${metrics.pathLength}`);
if(metrics.pathLength/metrics.direct<1.32||metrics.pathLength/metrics.direct>1.5)errors.push(`route traversal ratio is not readable: ${metrics.pathLength/metrics.direct}`);
if(metrics.points<14||metrics.points>17)errors.push(`route control point count is not production-ready: ${metrics.points}`);
if(metrics.slots<9||metrics.slots>10)errors.push(`invalid node count: ${metrics.slots}`);
if(metrics.landmarks!==3)errors.push(`scene needs exactly three visual districts: ${metrics.landmarks}`);
if(metrics.minPathDistance<65||metrics.maxPathDistance>155)errors.push(`node distance to road is invalid: ${metrics.minPathDistance}-${metrics.maxPathDistance}`);
if(metrics.minSlotSeparation<145)errors.push(`nodes are visually overcrowded: ${metrics.minSlotSeparation}`);
if(metrics.meaningfulBends<7)errors.push(`route lacks meaningful tactical bends: ${metrics.meaningfulBends}`);
if(metrics.maxSegment<195)errors.push(`street section lacks a readable damage corridor: ${metrics.maxSegment}`);
if(metrics.coverage175.covered<.9||metrics.coverage175.maxOverlap>3)errors.push(`standard range coverage is unbalanced: ${JSON.stringify(metrics.coverage175)}`);
if(metrics.coverage205.covered<.98||metrics.coverage205.maxOverlap>4)errors.push(`long range coverage is unbalanced: ${JSON.stringify(metrics.coverage205)}`);
if(metrics.hidden.length)errors.push(`nodes hidden by HUD: ${JSON.stringify(metrics.hidden)}`);
if(metrics.bounds.minX>75||metrics.bounds.maxX<1495||metrics.bounds.minY>300||metrics.bounds.maxY<640)errors.push(`route underuses battlefield: ${JSON.stringify(metrics.bounds)}`);
if(metrics.page.scrollX>0||metrics.page.scrollY>0)errors.push(`page overflow: ${JSON.stringify(metrics.page)}`);
await page.screenshot({path:`${out}/20-level-layout-1600x900.png`});
await page.evaluate(()=>{const g=window.__NEON_TEST__;g.state.credits=5000;[['rail',0],['cryo',3],['plasma',4],['arcane',6],['rail',7],['cryo',9]].forEach(([t,s])=>g.buildTower(t,s));g.startWave();g.state.speed=2});
await page.waitForTimeout(6200);await page.screenshot({path:`${out}/21-level-battle-1600x900.png`});
await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(350);const responsive=await page.evaluate(()=>({scrollX:document.documentElement.scrollWidth-innerWidth,scrollY:document.documentElement.scrollHeight-innerHeight,shell:(()=>{const r=document.getElementById('game-shell').getBoundingClientRect();return{width:r.width,height:r.height,left:r.left,top:r.top}})()}));
if(responsive.scrollX>0||responsive.scrollY>0||Math.abs(responsive.shell.width-1280)>1||Math.abs(responsive.shell.height-720)>1)errors.push(`responsive layout failed: ${JSON.stringify(responsive)}`);
await page.screenshot({path:`${out}/22-level-layout-1280x720.png`});
const report={errors,metrics,responsive};await fs.writeFile(`${out}/level-design-report.json`,JSON.stringify(report,null,2));await browser.close();if(errors.length){console.error(JSON.stringify(report,null,2));process.exit(1)}console.log(JSON.stringify(report,null,2));
