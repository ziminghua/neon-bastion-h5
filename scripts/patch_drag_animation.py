from pathlib import Path

app_path = Path('app.js')
text = app_path.read_text(encoding='utf-8')

old_move = """function moveOrMerge(tower,toSlot) {
  if(toSlot<0||tower.slot===toSlot)return;
  const other=towerAtSlot(toSlot);
  if(!other){tower.slot=toSlot;showToast('TOWER RELOCATED');audioTone(260,.06,'triangle',.03,80);}
  else if(other.type===tower.type&&other.level===tower.level){
    other.level++; other.cooldown=0; state.towers=state.towers.filter(t=>t!==tower); state.selectedTower=other;
    const p=LEVEL.slots[toSlot]; burstAt(p.x,p.y,other.def.color,58,210); addFx('hit',p.x,p.y,.6,1.5,0,'screen'); addFloating(p.x,p.y-65,`LV.${other.level}  OVERCLOCK`,'#fff3a2',26);
    state.score+=450*other.level;audioTone(530,.14,'triangle',.06,520);showToast(`${other.def.name} MERGED TO LV.${other.level}`);
  } else {
    const old=tower.slot;tower.slot=other.slot;other.slot=old;showToast('TOWER POSITIONS SWAPPED');audioTone(230,.06,'sine',.025,70);
  }
  recomputeResonance();updateUI();if(state.selectedTower)showTowerInspector(state.selectedTower);
}
"""
new_move = """function setTowerMotion(tower,from,to,duration=240) {
  tower.motion={fromX:from.x,fromY:from.y,toX:to.x,toY:to.y,start:performance.now(),duration};
}
function moveOrMerge(tower,toSlot,dropPoint=state.pointer) {
  if(toSlot<0||tower.slot===toSlot)return;
  const sourceSlot=tower.slot, source=LEVEL.slots[sourceSlot], target=LEVEL.slots[toSlot], other=towerAtSlot(toSlot);
  if(!other){
    tower.slot=toSlot;setTowerMotion(tower,{x:dropPoint.x,y:dropPoint.y-18},target);showToast('TOWER RELOCATED');audioTone(260,.06,'triangle',.03,80);
  } else if(other.type===tower.type&&other.level===tower.level){
    other.level++;other.cooldown=0;other.mergePulse=1;state.towers=state.towers.filter(t=>t!==tower);state.selectedTower=other;
    burstAt(target.x,target.y,other.def.color,58,210);addFx('hit',target.x,target.y,.6,1.5,0,'screen');addFloating(target.x,target.y-65,`LV.${other.level}  OVERCLOCK`,'#fff3a2',26);
    state.score+=450*other.level;audioTone(530,.14,'triangle',.06,520);showToast(`${other.def.name} MERGED TO LV.${other.level}`);
  } else {
    tower.slot=toSlot;other.slot=sourceSlot;
    setTowerMotion(tower,{x:dropPoint.x,y:dropPoint.y-18},target);setTowerMotion(other,target,source,280);
    showToast('TOWER POSITIONS SWAPPED');audioTone(230,.06,'sine',.025,70);
  }
  recomputeResonance();updateUI();if(state.selectedTower)showTowerInspector(state.selectedTower);
}
"""
if old_move not in text:
    raise SystemExit('moveOrMerge block not found')
text = text.replace(old_move, new_move)

old_update = """function updateTowers(dt) {
  for(const t of state.towers){
    t.cooldown-=dt;t.recoil=Math.max(0,t.recoil-dt*6);t.flash=Math.max(0,t.flash-dt*5);
    const target=findTarget(t);t.charge=target?Math.min(1,t.charge+dt*4):Math.max(0,t.charge-dt*3);
    if(target&&t.cooldown<=0){fireTower(t,target);t.cooldown=t.def.interval/(1+.16*(t.level-1));}
  }
}
"""
new_update = """function updateTowers(dt) {
  for(const t of state.towers){
    t.cooldown-=dt;t.recoil=Math.max(0,t.recoil-dt*6);t.flash=Math.max(0,t.flash-dt*5);t.mergePulse=Math.max(0,(t.mergePulse||0)-dt*3.8);
    const target=findTarget(t);t.charge=target?Math.min(1,t.charge+dt*4):Math.max(0,t.charge-dt*3);
    if(target&&t.cooldown<=0){fireTower(t,target);t.cooldown=t.def.interval/(1+.16*(t.level-1));}
  }
}
"""
if old_update not in text:
    raise SystemExit('updateTowers block not found')
text = text.replace(old_update, new_update)

old_slots = """function drawSlots(){
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower;ctx.save();ctx.translate(p.x,p.y);const color=t?t.def.color:hover?'#8affd3':'#45d9ff';ctx.shadowColor=color;ctx.shadowBlur=hover||selected?28:15;ctx.fillStyle='rgba(5,16,31,.86)';ctx.strokeStyle=color;ctx.lineWidth=hover||selected?3:2;polygon(0,0,44,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=1;polygon(0,0,33,8);ctx.stroke();if(!t){ctx.strokeStyle='rgba(72,224,255,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.moveTo(0,-11);ctx.lineTo(0,11);ctx.stroke();}ctx.restore();
  });
}
"""
new_slots = """function drawSlots(){
  const dragging=state.drag?.moved&&state.drag.tower;
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower,target=Boolean(dragging&&hover);
    const merge=target&&t&&t!==dragging&&t.type===dragging.type&&t.level===dragging.level;
    const swap=target&&t&&t!==dragging&&!merge;
    const color=merge?'#ffd86f':swap?'#8db5ff':target?'#76ffc2':t?t.def.color:hover?'#8affd3':'#45d9ff';
    const pulse=target?1+Math.sin(performance.now()*.012)*.08:1;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor=color;ctx.shadowBlur=target?36:hover||selected?28:15;ctx.fillStyle=target?rgba(color,.13):'rgba(5,16,31,.86)';ctx.strokeStyle=color;ctx.lineWidth=target?4:hover||selected?3:2;polygon(0,0,target?50:44,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=1;polygon(0,0,33,8);ctx.stroke();
    if(!t||t===dragging){ctx.strokeStyle=target?color:'rgba(72,224,255,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.moveTo(0,-11);ctx.lineTo(0,11);ctx.stroke();}
    if(target){ctx.fillStyle=color;ctx.font='800 11px sans-serif';ctx.textAlign='center';ctx.fillText(merge?'MERGE':swap?'SWAP':'DEPLOY',0,68);}
    ctx.restore();
  });
}
"""
if old_slots not in text:
    raise SystemExit('drawSlots block not found')
text = text.replace(old_slots, new_slots)

start = text.index('function drawTower(t){')
end = text.index('\nfunction drawEnemy(e){', start)
new_tower = """function towerDrawPosition(t){
  const slot=LEVEL.slots[t.slot];
  if(state.drag?.tower===t&&state.drag.moved)return{x:state.drag.x,y:state.drag.y-18,dragging:true};
  if(t.motion){
    const elapsed=performance.now()-t.motion.start, raw=clamp(elapsed/t.motion.duration,0,1);
    const eased=1-Math.pow(1-raw,3), overshoot=Math.sin(raw*Math.PI)*.06;
    if(raw>=1){t.motion=null;return{x:slot.x,y:slot.y,dragging:false};}
    return{x:lerp(t.motion.fromX,t.motion.toX,eased),y:lerp(t.motion.fromY,t.motion.toY,eased)-overshoot*42,dragging:false,moving:true};
  }
  return{x:slot.x,y:slot.y,dragging:false};
}
function drawTower(t){
  const home=LEVEL.slots[t.slot], pos=towerDrawPosition(t), def=t.def, baseScale=(.31+.018*(t.level-1))*(1+(t.mergePulse||0)*.11), recoil=t.recoil*8;
  if(pos.dragging){
    ctx.save();ctx.translate(home.x,home.y);ctx.globalAlpha=.2;ctx.strokeStyle=rgba(def.color,.75);ctx.fillStyle=rgba(def.color,.06);ctx.setLineDash([6,7]);ctx.lineWidth=2;polygon(0,0,39,8);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();
    ctx.save();ctx.strokeStyle=rgba(def.color,.36);ctx.setLineDash([6,10]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(home.x,home.y);ctx.quadraticCurveTo((home.x+pos.x)/2,(home.y+pos.y)/2-45,pos.x,pos.y+22);ctx.stroke();ctx.restore();
  }
  if(t===state.selectedTower&&!pos.dragging){const range=def.range*(1+.08*(t.level-1))*state.mods.range;ctx.save();ctx.strokeStyle=rgba(def.color,.55);ctx.fillStyle=rgba(def.color,.06);ctx.setLineDash([8,9]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(home.x,home.y,range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  if(!pos.dragging){for(const other of state.towers){if(other===t||other.slot<t.slot||state.drag?.tower===other)continue;const op=LEVEL.slots[other.slot];if(dist(home,op)<250&&other.type!==t.type){ctx.save();ctx.strokeStyle=rgba(t.def.color,.22);ctx.lineWidth=2;ctx.setLineDash([5,9]);ctx.beginPath();ctx.moveTo(home.x,home.y);ctx.lineTo(op.x,op.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();}}}
  ctx.save();ctx.translate(pos.x,pos.y);if(pos.dragging){ctx.translate(0,-8-Math.sin(performance.now()*.012)*4);ctx.scale(1.1,1.1);ctx.globalAlpha=.94;}ctx.shadowColor=def.color;ctx.shadowBlur=pos.dragging?38:20+t.charge*12;ctx.drawImage(img[def.asset],-210*baseScale,-225*baseScale-recoil,420*baseScale,420*baseScale);ctx.shadowBlur=0;
  if(pos.dragging){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.22;ctx.fillStyle=def.color;ctx.beginPath();ctx.ellipse(0,30,64,20,0,0,Math.PI*2);ctx.fill();}
  if(t.flash>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=t.flash*.45;ctx.fillStyle=def.color;ctx.beginPath();ctx.arc(0,-35,38,0,Math.PI*2);ctx.fill();}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='rgba(2,8,18,.9)';ctx.strokeStyle=def.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(30,18,42,23,10);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 13px sans-serif';ctx.textAlign='center';ctx.fillText(`L${t.level}`,51,34);ctx.restore();
}
"""
text = text[:start] + new_tower + text[end:]

old_pointermove = """canvas.addEventListener('pointermove',e=>{
  const p=pointerPos(e);state.pointer=p;state.hoverSlot=slotAt(p.x,p.y,55);
  if(state.drag){state.drag.x=p.x;state.drag.y=p.y;state.drag.moved=Math.hypot(p.x-state.drag.startX,p.y-state.drag.startY)>8;}
});
"""
new_pointermove = """canvas.addEventListener('pointermove',e=>{
  const p=pointerPos(e);state.pointer=p;state.hoverSlot=slotAt(p.x,p.y,state.drag?72:55);
  if(state.drag){state.drag.x=p.x;state.drag.y=p.y;state.drag.moved=Math.hypot(p.x-state.drag.startX,p.y-state.drag.startY)>8;canvas.style.cursor=state.drag.moved?'grabbing':'grab';}
  else canvas.style.cursor=towerAtPoint(p.x,p.y)?'grab':state.hoverSlot>=0?'crosshair':'default';
});
"""
if old_pointermove not in text:
    raise SystemExit('pointermove block not found')
text = text.replace(old_pointermove, new_pointermove)
text = text.replace(
"""  if(tower){state.selectedTower=tower;state.selectedBuild=null;state.drag={tower,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:false};showTowerInspector(tower);canvas.setPointerCapture(e.pointerId);return;}
""",
"""  if(tower){state.selectedTower=tower;state.selectedBuild=null;state.drag={tower,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:false};showTowerInspector(tower);canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);return;}
"""
)
text = text.replace(
"""  if(!state.drag)return;const p=pointerPos(e),to=slotAt(p.x,p.y,62),drag=state.drag;state.drag=null;if(drag.moved&&to>=0)moveOrMerge(drag.tower,to);else showTowerInspector(drag.tower);updateUI();
""",
"""  if(!state.drag)return;const p=pointerPos(e),to=slotAt(p.x,p.y,72),drag=state.drag;state.drag=null;canvas.style.cursor='default';if(drag.moved&&to>=0)moveOrMerge(drag.tower,to,p);else showTowerInspector(drag.tower);updateUI();
"""
)
text = text.replace(
"""canvas.addEventListener('pointerleave',()=>{state.hoverSlot=-1;});
""",
"""canvas.addEventListener('pointercancel',()=>{state.drag=null;state.hoverSlot=-1;canvas.style.cursor='default';});
canvas.addEventListener('pointerleave',()=>{if(!state.drag){state.hoverSlot=-1;canvas.style.cursor='default';}});
"""
)

app_path.write_text(text, encoding='utf-8')

qa_path = Path('scripts/visual-qa.mjs')
qa = qa_path.read_text(encoding='utf-8')
needle = """await openState('03-built', '?qa=built');
await openState('04-battle', '?qa=battle', 4200);
"""
replacement = """await openState('03-built', '?qa=built');

// Verify the tower follows the pointer, exposes a drop target, and settles on release.
await page.goto(`${base}?qa=built`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__NEON_TEST__, null, { timeout: 20000 });
await page.waitForTimeout(500);
const dragStage = page.locator('#game');
const dragBox = await dragStage.boundingBox();
if (!dragBox) throw new Error('Canvas unavailable for drag QA');
const mapPoint = (x, y) => ({ x: dragBox.x + x / 1600 * dragBox.width, y: dragBox.y + y / 900 * dragBox.height });
const dragFrom = mapPoint(360, 390), dragTo = mapPoint(1210, 480);
await page.mouse.move(dragFrom.x, dragFrom.y);
await page.mouse.down();
await page.mouse.move(dragTo.x, dragTo.y, { steps: 14 });
await page.waitForTimeout(220);
const dragState = await page.evaluate(() => ({
  active: Boolean(window.__NEON_TEST__.state.drag?.moved),
  hoverSlot: window.__NEON_TEST__.state.hoverSlot,
  towerSlot: window.__NEON_TEST__.state.drag?.tower?.slot
}));
await page.screenshot({ path: `${out}/04-drag-active.png` });
if (!dragState.active || dragState.hoverSlot !== 8 || dragState.towerSlot !== 0) errors.push(`drag preview failed: ${JSON.stringify(dragState)}`);
await page.mouse.up();
await page.waitForTimeout(420);
const landedState = await page.evaluate(() => ({
  active: Boolean(window.__NEON_TEST__.state.drag),
  movedTower: window.__NEON_TEST__.state.towers.some(t => t.type === 'rail' && t.slot === 8)
}));
await page.screenshot({ path: `${out}/05-drag-landed.png` });
if (landedState.active || !landedState.movedTower) errors.push(`drag landing failed: ${JSON.stringify(landedState)}`);

await openState('06-battle', '?qa=battle', 4200);
"""
if needle not in qa:
    raise SystemExit('visual QA insertion point not found')
qa = qa.replace(needle, replacement)
qa = qa.replace("`${out}/05-emp.png`", "`${out}/07-emp.png`")
qa = qa.replace("openState('06-protocol'", "openState('08-protocol'")
qa = qa.replace("openState('07-result'", "openState('09-result'")
qa = qa.replace("`${out}/08-full-run-combat.png`", "`${out}/10-full-run-combat.png`")
qa = qa.replace("`${out}/09-full-run-result.png`", "`${out}/11-full-run-result.png`")
qa = qa.replace("`${out}/10-responsive-1280x720.png`", "`${out}/12-responsive-1280x720.png`")
qa_path.write_text(qa, encoding='utf-8')
