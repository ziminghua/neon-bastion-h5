'use strict';
function render(){
  const shake=state.screenShake>0?{x:rand(-state.screenShake,state.screenShake),y:rand(-state.screenShake*.6,state.screenShake*.6)}:{x:0,y:0};
  ctx.save();ctx.translate(shake.x,shake.y);drawBackground();drawPath();drawSpawnGate();drawCore();drawSlots();state.towers.forEach(drawTower);state.enemies.forEach(drawEnemy);drawProjectiles();drawEffects();drawAmbient();ctx.restore();
  if(state.flash>0){ctx.fillStyle=`rgba(255,90,120,${state.flash*.25})`;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);}
}

function drawMinimap(){
  const w=minimap.width,h=minimap.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#031020';mctx.fillRect(0,0,w,h);mctx.strokeStyle='#1edcff';mctx.lineWidth=2;mctx.beginPath();LEVEL.path.forEach((p,i)=>{const x=p.x/DESIGN.w*w,y=p.y/760*h;i?mctx.lineTo(x,y):mctx.moveTo(x,y);});mctx.stroke();LEVEL.slots.forEach((p,i)=>{mctx.fillStyle=towerAtSlot(i)?TOWER_TYPES[towerAtSlot(i).type].color:'#143a51';mctx.beginPath();mctx.arc(p.x/DESIGN.w*w,p.y/760*h,4,0,Math.PI*2);mctx.fill();});mctx.fillStyle='#ff4c68';mctx.fillRect(LEVEL.path[0].x/DESIGN.w*w-4,LEVEL.path[0].y/760*h-4,8,8);const core=LEVEL.path.at(-1);mctx.fillStyle='#66e9ff';mctx.fillRect(core.x/DESIGN.w*w-5,core.y/760*h-5,10,10);
}

function updateUI(expensive=true){
  ui.hp.textContent=`${Math.max(0,state.hp)}/${state.maxHp}`;ui.credits.textContent=Math.floor(state.credits);ui.power.textContent=`${state.towers.length}/8`;ui.wave.textContent=state.wave;
  if(state.waveActive){ui.waveSub.textContent=`敌人剩余：${state.enemies.length+state.spawnQueue.length}`;ui.startWave.disabled=true;ui.startWaveSub.textContent='战斗进行中';}
  else {ui.waveSub.textContent=state.wave>=LEVEL.waves?'区域已清除':'部署防线';ui.startWave.disabled=state.wave>=LEVEL.waves;ui.startWaveSub.textContent=state.wave>=LEVEL.waves?'已完成':`第 ${state.wave+1} 波`;}
  ui.speed.querySelector('span').textContent=`×${state.speed}`;ui.pause.textContent=state.paused?'▶':'Ⅱ';
  if(expensive){document.querySelectorAll('.tower-card').forEach(el=>{const d=TOWER_TYPES[el.dataset.type];el.disabled=state.credits<d.cost||state.towers.length>=8;});drawMinimap();}
}
function showTowerInspector(t){
  if(!t)return;state.selectedTower=t;const p=t.def;ui.inspectName.textContent=`${p.name} · Lv.${t.level}`;ui.inspectImage.src=ASSET_PATHS[p.asset];ui.inspectALabel.textContent='攻击';ui.inspectBLabel.textContent='射速';ui.inspectCLabel.textContent='射程';ui.inspectDLabel.textContent='击毁';ui.inspectA.textContent=Math.round(p.damage*Math.pow(1.62,t.level-1)*state.mods.damage[t.type]);ui.inspectB.textContent=`${(p.interval/(1+.16*(t.level-1))).toFixed(2)}s`;ui.inspectC.textContent=Math.round(p.range*(1+.08*(t.level-1))*state.mods.range);ui.inspectD.textContent=t.kills;ui.inspectTip.textContent=`${p.desc}。累计造成 ${Math.round(t.totalDamage)} 点伤害。`;ui.towerActions.classList.remove('hidden');const cost=Math.round(p.cost*(.75+t.level*.65));ui.upgradeCost.textContent=cost;ui.sellValue.textContent=Math.round(p.cost*(.45+.18*(t.level-1)));
}
function showCoreInspector(){ui.inspectName.textContent='能量核心';ui.inspectImage.src=ASSET_PATHS.core;ui.inspectALabel.textContent='装甲';ui.inspectBLabel.textContent='护盾恢复';ui.inspectCLabel.textContent='状态';ui.inspectDLabel.textContent='威胁';ui.inspectA.textContent=`${Math.max(0,state.hp)} / ${state.maxHp}`;ui.inspectB.textContent=`每波 +${1+state.mods.coreRegen}`;ui.inspectC.textContent=state.hp>10?'稳定':state.hp>5?'警戒':'危险';ui.inspectD.textContent=state.wave<5?'低':state.wave<9?'中':'高';ui.inspectTip.textContent='部署炮塔并守住通往核心的霓虹运输线。';ui.towerActions.classList.add('hidden');}
function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>ui.toast.classList.remove('show'),1600);}
function showWaveBanner(text){ui.waveBannerText.textContent=text;ui.waveBanner.classList.remove('show');void ui.waveBanner.offsetWidth;ui.waveBanner.classList.add('show');}
function showBossBanner(){ui.bossBanner.classList.remove('show');void ui.bossBanner.offsetWidth;ui.bossBanner.classList.add('show');}

function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*DESIGN.w,y:(e.clientY-r.top)/r.height*DESIGN.h};}
canvas.addEventListener('pointermove',e=>{
  const p=pointerPos(e);state.pointer=p;state.hoverSlot=slotAt(p.x,p.y,55);
  if(state.drag){state.drag.x=p.x;state.drag.y=p.y;state.drag.moved=Math.hypot(p.x-state.drag.startX,p.y-state.drag.startY)>8;}
});
canvas.addEventListener('pointerdown',e=>{
  if(!state.ready||!state.running||state.paused)return;const p=pointerPos(e),tower=towerAtPoint(p.x,p.y),slot=slotAt(p.x,p.y,58);
  if(tower){state.selectedTower=tower;state.selectedBuild=null;state.drag={tower,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:false};showTowerInspector(tower);canvas.setPointerCapture(e.pointerId);return;}
  if(slot>=0&&state.selectedBuild){buildTower(state.selectedBuild,slot);return;}
  state.selectedTower=null;showCoreInspector();
});
canvas.addEventListener('pointerup',e=>{
  if(!state.drag)return;const p=pointerPos(e),to=slotAt(p.x,p.y,62),drag=state.drag;state.drag=null;if(drag.moved&&to>=0)moveOrMerge(drag.tower,to);else showTowerInspector(drag.tower);updateUI();
});
canvas.addEventListener('pointerleave',()=>{state.hoverSlot=-1;});

document.querySelectorAll('.tower-card').forEach(card=>{
  card.draggable=true;
  card.addEventListener('click',()=>selectBuild(card.dataset.type));
  card.addEventListener('pointerdown',()=>selectBuild(card.dataset.type));
  card.addEventListener('dragstart',e=>{selectBuild(card.dataset.type);e.dataTransfer.setData('text/tower',card.dataset.type);e.dataTransfer.effectAllowed='copy';card.classList.add('dragging');});
  card.addEventListener('dragend',()=>{card.classList.remove('dragging');state.hoverSlot=-1;});
});
canvas.addEventListener('dragover',e=>{e.preventDefault();const p=pointerPos(e);state.hoverSlot=slotAt(p.x,p.y,62);e.dataTransfer.dropEffect='copy';});
canvas.addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('text/tower');const p=pointerPos(e);const slot=slotAt(p.x,p.y,62);if(type&&slot>=0)buildTower(type,slot);state.hoverSlot=-1;});
ui.startWave.addEventListener('click',startWave);
ui.upgradeBtn.addEventListener('click',()=>upgradeTower(state.selectedTower));
ui.sellBtn.addEventListener('click',()=>sellTower(state.selectedTower));
ui.speed.addEventListener('click',()=>{state.speed=state.speed===1?1.5:state.speed===1.5?2:1;updateUI();});
ui.pause.addEventListener('click',()=>{state.paused=!state.paused;updateUI();showToast(state.paused?'战斗暂停':'战斗继续');});
ui.sound.addEventListener('click',()=>{state.sound=!state.sound;ui.sound.textContent=state.sound?'♪':'×';});
$('enterBtn').addEventListener('click',()=>{ui.intro.classList.add('hidden');resetGame();showToast('选择塔卡，然后点击发光塔位部署');});
$('restartBtn').addEventListener('click',()=>{ui.result.classList.add('hidden');resetGame();});

function loop(now){const dt=Math.min(.033,(now-state.lastTime)/1000||0);state.lastTime=now;update(dt);render();requestAnimationFrame(loop);}

loadAssets().then(()=>{state.ready=true;drawMinimap();showCoreInspector();updateUI();requestAnimationFrame(loop);}).catch(err=>{console.error(err);document.body.innerHTML='<div style="padding:30px;color:white">资源加载失败，请通过 HTTP 服务打开游戏。</div>';});
