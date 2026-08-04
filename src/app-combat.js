'use strict';
const PROTOCOL_POOL=[
  {icon:'➶',name:'轨道超频',desc:'轨道箭塔伤害 +20%',color:'#5ce9ff',apply:()=>state.mods.damage.rail*=1.2},
  {icon:'❄',name:'极寒领域',desc:'寒冰减速强度 +18%',color:'#8abfff',apply:()=>state.mods.cryoSlow*=1.18},
  {icon:'●',name:'聚变弹头',desc:'等离子爆炸范围 +20%',color:'#ff9b37',apply:()=>state.mods.plasmaSplash*=1.2},
  {icon:'△',name:'奥术分裂',desc:'奥术连锁目标 +1',color:'#df69ff',apply:()=>state.mods.arcaneChain++},
  {icon:'◎',name:'超视距阵列',desc:'所有炮塔射程 +10%',color:'#83f4e0',apply:()=>state.mods.range*=1.1},
  {icon:'✚',name:'纳米修复',desc:'每波额外恢复 1 点核心装甲',color:'#75ffa3',apply:()=>state.mods.coreRegen++},
  {icon:'ϟ',name:'全域增幅',desc:'所有炮塔伤害 +10%',color:'#ffe171',apply:()=>Object.keys(state.mods.damage).forEach(k=>state.mods.damage[k]*=1.1)},
  {icon:'⬡',name:'能源回收',desc:'立即获得 90 能源币',color:'#ffd35f',apply:()=>state.credits+=90}
];
function showProtocolChoices(){
  state.paused=true;ui.protocolChoices.innerHTML='';
  const choices=[...PROTOCOL_POOL].sort(()=>Math.random()-.5).slice(0,3);
  choices.forEach(c=>{const b=document.createElement('button');b.className='protocol-choice';b.style.setProperty('--pc',c.color);b.innerHTML=`<i>${c.icon}</i><b>${c.name}</b><small>${c.desc}</small>`;b.onclick=()=>{c.apply();ui.protocol.classList.add('hidden');state.paused=false;audioTone(620,.14,'triangle',.05,360);showToast(`战术协议已加载：${c.name}`);updateUI();};ui.protocolChoices.appendChild(b);});
  ui.protocol.classList.remove('hidden');
}

function endGame(win) {
  state.running=false; state.paused=true;
  ui.result.classList.remove('hidden');
  ui.resultEyebrow.textContent=win?'MISSION COMPLETE':'CORE COLLAPSED';
  ui.resultTitle.textContent=win?'霓虹下城区已守住':'能量核心失守';
  ui.resultScore.textContent=String(Math.round(state.score)).padStart(6,'0');
  ui.resultWave.textContent=state.wave; ui.resultHp.textContent=Math.max(0,state.hp); ui.resultKills.textContent=state.kills;
  audioTone(win?660:100,.5,win?'triangle':'sawtooth',.06,win?440:-60);
}

function slotAt(x,y,limit=58) {
  let best=-1,bd=limit;
  LEVEL.slots.forEach((p,i)=>{const d=Math.hypot(x-p.x,y-p.y);if(d<bd){bd=d;best=i;}}); return best;
}
function towerAtSlot(slot){return state.towers.find(t=>t.slot===slot)||null;}
function towerAtPoint(x,y){const s=slotAt(x,y,64);return s>=0?towerAtSlot(s):null;}

function selectBuild(type) {
  state.selectedBuild=type; state.selectedTower=null;
  document.querySelectorAll('.tower-card').forEach(el=>el.classList.toggle('selected',el.dataset.type===type));
  const d=TOWER_TYPES[type]; ui.selectedTowerName.textContent=d.name; ui.selectedTowerDesc.textContent=d.desc; showCoreInspector();
}

function buildTower(type,slot) {
  const def=TOWER_TYPES[type];
  if(towerAtSlot(slot)){showToast('该塔位已占用，可拖动炮塔调整');return false;}
  if(state.credits<def.cost){showToast('能源币不足');audioTone(90,.08,'square',.025,-30);return false;}
  if(state.towers.length>=8){showToast('部署容量已满，请合成或升级');return false;}
  state.credits-=def.cost; const tower=createTower(type,slot); state.towers.push(tower); state.selectedTower=tower; state.selectedBuild=null;
  burstAt(LEVEL.slots[slot].x,LEVEL.slots[slot].y,def.color,34,150); addFx('hit',LEVEL.slots[slot].x,LEVEL.slots[slot].y,.42,1.1,0,'screen');
  audioTone(type==='plasma'?180:type==='arcane'?480:360,.1,'triangle',.045,220); recomputeResonance(); updateUI(); showTowerInspector(tower); return true;
}

function moveOrMerge(tower,toSlot) {
  if(toSlot<0||tower.slot===toSlot)return;
  const other=towerAtSlot(toSlot);
  if(!other){tower.slot=toSlot;showToast('炮塔已重新部署');audioTone(260,.06,'triangle',.03,80);}
  else if(other.type===tower.type&&other.level===tower.level){
    other.level++; other.cooldown=0; state.towers=state.towers.filter(t=>t!==tower); state.selectedTower=other;
    const p=LEVEL.slots[toSlot]; burstAt(p.x,p.y,other.def.color,58,210); addFx('hit',p.x,p.y,.6,1.5,0,'screen'); addFloating(p.x,p.y-65,`LV.${other.level}  OVERCLOCK`,'#fff3a2',26);
    state.score+=450*other.level;audioTone(530,.14,'triangle',.06,520);showToast(`${other.def.name} 合成至 Lv.${other.level}`);
  } else {
    const old=tower.slot;tower.slot=other.slot;other.slot=old;showToast('炮塔位置已交换');audioTone(230,.06,'sine',.025,70);
  }
  recomputeResonance();updateUI();if(state.selectedTower)showTowerInspector(state.selectedTower);
}

function upgradeTower(tower) {
  if(!tower)return; const cost=Math.round(tower.def.cost*(.75+tower.level*.65));
  if(state.credits<cost){showToast('能源币不足');return;}
  state.credits-=cost;tower.level++;const p=LEVEL.slots[tower.slot];burstAt(p.x,p.y,tower.def.color,50,200);addFx('hit',p.x,p.y,.55,1.4,0,'screen');addFloating(p.x,p.y-70,`UPGRADE  LV.${tower.level}`,'#ffe183',24);audioTone(500,.12,'triangle',.06,400);updateUI();showTowerInspector(tower);
}
function sellTower(tower) {
  if(!tower)return;const value=Math.round(tower.def.cost*(.45+.18*(tower.level-1)));state.credits+=value;state.towers=state.towers.filter(t=>t!==tower);state.selectedTower=null;showToast(`已回收 ${value} 能源币`);recomputeResonance();updateUI();showCoreInspector();
}

function recomputeResonance() {
  const counts={rail:0,cryo:0,plasma:0,arcane:0}; state.towers.forEach(t=>counts[t.type]++);
  state.resonance.frost=Math.floor(counts.cryo/2);state.resonance.energy=Math.floor(counts.plasma/2);state.resonance.arcane=Math.floor(counts.arcane/2);
  ui.frostCount.textContent=`${Math.min(counts.cryo,2)}/2`;ui.energyCount.textContent=`${Math.min(counts.plasma,2)}/2`;ui.arcaneCount.textContent=`${Math.min(counts.arcane,2)}/2`;
}

function findTarget(tower) {
  const p=LEVEL.slots[tower.slot]; const range=tower.def.range*(1+.08*(tower.level-1))*state.mods.range;
  const cand=state.enemies.filter(e=>!e.dead&&dist(p,pathPoint(e.progress))<=range);
  if(!cand.length)return null;
  if(tower.def.targeting==='cluster'){
    let best=cand[0],score=-1;for(const e of cand){const ep=pathPoint(e.progress);let s=0;for(const q of cand){if(dist(ep,pathPoint(q.progress))<tower.def.splash)s++;}if(s>score){score=s;best=e;}}return best;
  }
  return cand.sort((a,b)=>b.progress-a.progress)[0];
}

function fireTower(tower,target) {
  const p=LEVEL.slots[tower.slot], ep=pathPoint(target.progress), def=tower.def;
  const damage=def.damage*Math.pow(1.62,tower.level-1)*state.mods.damage[tower.type];
  tower.recoil=1;tower.flash=1;
  if(tower.type==='rail'){
    state.beams.push({x1:p.x,y1:p.y-25,x2:ep.x,y2:ep.y,color:def.color,life:.09,max:.09,width:4});
    applyDamage(target,damage,tower);addFx('hit',ep.x,ep.y,.18,.42,0,'screen');spawnSparks(ep.x,ep.y,def.color,8,90);audioTone(720,.035,'square',.018,-210);
  } else {
    state.projectiles.push({type:tower.type,x:p.x,y:p.y-30,target,damage,speed:def.projectileSpeed,color:def.color,splash:def.splash||0,slow:(def.slow||0)*state.mods.cryoSlow,slowDuration:def.slowDuration||0,chain:(def.chain||0)+state.mods.arcaneChain,tower,trail:[]});
    audioTone(tower.type==='plasma'?170:tower.type==='arcane'?490:310,.055,tower.type==='plasma'?'sawtooth':'sine',.025,tower.type==='plasma'?-45:90);
  }
}

function applyDamage(enemy,amount,tower,kind=tower?.type||'rail') {
  if(enemy.dead)return 0;
  let dmg=amount*(1-(enemy.def.armor||0));
  if(kind==='arcane'&&enemy.def.armor)dmg*=1.25;
  if(enemy.shield>0){const absorbed=Math.min(enemy.shield,dmg);enemy.shield-=absorbed;dmg-=absorbed;addFx('hit',pathPoint(enemy.progress).x,pathPoint(enemy.progress).y,.2,.7,0,'screen');}
  if(dmg>0){enemy.hp-=dmg;enemy.hit=.12;tower&&(tower.totalDamage+=dmg);addFloating(pathPoint(enemy.progress).x+rand(-9,9),pathPoint(enemy.progress).y-36,Math.round(dmg),kind==='plasma'?'#ffbd68':kind==='cryo'?'#a9eaff':kind==='arcane'?'#ed9fff':'#fff',kind==='plasma'?18:14);}
  if(enemy.hp<=0&&!enemy.dead)killEnemy(enemy,tower);
  return dmg;
}
function killEnemy(enemy,tower) {
  enemy.dead=true;state.kills++;state.credits+=enemy.def.reward;state.score+=Math.round(enemy.maxHp*(enemy.def.boss?5:1.3));tower&&(tower.kills++);
  const p=pathPoint(enemy.progress);burstAt(p.x,p.y,enemy.def.color,enemy.def.boss?80:24,enemy.def.boss?260:140);addFx(enemy.def.boss?'plasma_blast':'coin',p.x,p.y,enemy.def.boss?.8:.42,enemy.def.boss?1.7:.55,0,'screen');
  if(enemy.def.boss){state.screenShake=18;state.flash=.25;audioTone(80,.35,'sawtooth',.065,-35);} else audioTone(280,.04,'triangle',.015,90);
}

function updateProjectiles(dt) {
  for(const p of state.projectiles){
    if(!p.target||p.target.dead){p.dead=true;continue;}
    const tp=pathPoint(p.target.progress);const dx=tp.x-p.x,dy=tp.y-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;
    p.trail.push({x:p.x,y:p.y,life:.18});if(p.trail.length>8)p.trail.shift();p.trail.forEach(t=>t.life-=dt);
    if(d<=step+8){
      applyDamage(p.target,p.damage,p.tower,p.type);
      if(p.type==='cryo'){p.target.slow=p.slowDuration;p.target.slowFactor=1-p.slow;addFx('ice_burst',tp.x,tp.y,.48,.85,0,'screen');spawnSparks(tp.x,tp.y,'#a9eaff',18,120);}
      if(p.type==='plasma'){
        addFx('plasma_blast',tp.x,tp.y,.55,1.15,0,'screen');state.screenShake=Math.max(state.screenShake,7);spawnSparks(tp.x,tp.y,'#ff9c38',28,180);
        for(const e of state.enemies){if(e!==p.target&&!e.dead&&dist(tp,pathPoint(e.progress))<=p.splash*state.mods.plasmaSplash*(1+state.resonance.energy*.15))applyDamage(e,p.damage*.54,p.tower,'plasma');}
      }
      if(p.type==='arcane'){
        addFx('arcane_bolt',tp.x,tp.y,.35,.75,0,'screen');let prev=p.target;const targets=state.enemies.filter(e=>e!==prev&&!e.dead&&dist(tp,pathPoint(e.progress))<140).sort((a,b)=>dist(tp,pathPoint(a.progress))-dist(tp,pathPoint(b.progress))).slice(0,p.chain+state.resonance.arcane);
        let from=tp;targets.forEach((e,i)=>{const q=pathPoint(e.progress);state.beams.push({x1:from.x,y1:from.y,x2:q.x,y2:q.y,color:'#c879ff',life:.18,max:.18,width:3,zigzag:true});applyDamage(e,p.damage*(.58-i*.1),p.tower,'arcane');from=q;});
      }
      p.dead=true;
    } else {p.x+=dx/d*step;p.y+=dy/d*step;}
  }
  state.projectiles=state.projectiles.filter(p=>!p.dead);
}

function updateEnemies(dt) {
  for(const e of state.enemies){
    e.alpha=Math.min(1,e.alpha+dt*5);e.spawnScale=Math.min(1,e.spawnScale+dt*5);e.hit=Math.max(0,e.hit-dt);e.bob+=dt*(e.type==='runner'?8:4);
    if(e.slow>0){e.slow-=dt;if(e.slow<=0)e.slowFactor=1;}
    e.progress += (e.def.speed*e.slowFactor*dt)/pathInfo.total;
    const p=pathPoint(e.progress);e.angle=p.angle;
    if(e.progress>=1){e.dead=true;const damage=e.def.boss?6:e.type==='brute'||e.type==='shield'?2:1;state.hp-=damage;state.screenShake=12;state.flash=.24;burstAt(1390,580,'#ff496f',40,190);addFloating(1360,500,`核心 -${damage}`,'#ff6577',24);audioTone(110,.18,'sawtooth',.055,-50);if(state.hp<=0)endGame(false);}
  }
  state.enemies=state.enemies.filter(e=>!e.dead);
}

function updateTowers(dt) {
  for(const t of state.towers){
    t.cooldown-=dt;t.recoil=Math.max(0,t.recoil-dt*6);t.flash=Math.max(0,t.flash-dt*5);
    const target=findTarget(t);t.charge=target?Math.min(1,t.charge+dt*4):Math.max(0,t.charge-dt*3);
    if(target&&t.cooldown<=0){fireTower(t,target);t.cooldown=t.def.interval/(1+.16*(t.level-1));}
  }
}
