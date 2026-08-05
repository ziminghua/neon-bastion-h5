(() => {
'use strict';

const DESIGN = { w: 1600, h: 900, worldBottom: 760 };
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');
const $ = (id) => document.getElementById(id);

const ui = {
  hp: $('hpText'), credits: $('creditsText'), power: $('powerText'), wave: $('waveText'), waveSub: $('waveSubText'),
  frostCount: $('frostCount'), energyCount: $('energyCount'), arcaneCount: $('arcaneCount'),
  inspector: $('inspectorPanel'), inspectName: $('inspectName'), inspectImage: $('inspectImage'),
  inspectA: $('inspectA'), inspectB: $('inspectB'), inspectC: $('inspectC'), inspectD: $('inspectD'), inspectALabel:$('inspectALabel'),inspectBLabel:$('inspectBLabel'),inspectCLabel:$('inspectCLabel'),inspectDLabel:$('inspectDLabel'), inspectTip: $('inspectTip'),
  towerActions: $('towerActions'), upgradeBtn: $('upgradeBtn'), upgradeCost: $('upgradeCost'), sellBtn: $('sellBtn'), sellValue: $('sellValue'),
  startWave: $('startWaveBtn'), startWaveSub: $('startWaveSub'), selectedTowerName: $('selectedTowerName'), selectedTowerDesc: $('selectedTowerDesc'),
  toast: $('toast'), waveBanner: $('waveBanner'), waveBannerText: $('waveBannerText'), bossBanner: $('bossBanner'), intro: $('intro'),
  result: $('resultModal'), resultTitle: $('resultTitle'), resultEyebrow: $('resultEyebrow'), resultScore: $('resultScore'), resultWave: $('resultWave'), resultHp: $('resultHp'), resultKills: $('resultKills'),
  protocol: $('protocolModal'), protocolChoices: $('protocolChoices'),
  pause: $('pauseBtn'), speed: $('speedBtn'), sound: $('soundBtn'), emp: $('empBtn'), empText: $('empText')
};

const ASSET_PATHS = {
  background: 'assets/world/background.webp', core: 'assets/world/core.webp', logo: 'assets/ui/logo.webp',
  rail: 'assets/towers/rail.webp', cryo: 'assets/towers/cryo.webp', plasma: 'assets/towers/plasma.webp', arcane: 'assets/towers/arcane.webp',
  drone: 'assets/enemies/drone.webp', runner: 'assets/enemies/runner.webp', brute: 'assets/enemies/brute.webp', shield: 'assets/enemies/shield.webp', boss: 'assets/enemies/boss.webp',
  rail_bolt: 'assets/fx/rail_bolt.webp', ice_burst: 'assets/fx/ice_burst.webp', plasma_blast: 'assets/fx/plasma_blast.webp',
  arcane_bolt: 'assets/fx/arcane_bolt.webp', chain: 'assets/fx/chain.webp', hit: 'assets/fx/hit.webp', coin: 'assets/fx/coin.webp'
};
const img = {};

const TOWER_TYPES = {
  rail: { name: 'RAILGUN', desc: 'Fast single-target fire', cost: 100, damage: 13, interval: 0.48, range: 190, projectileSpeed: 900, color: '#55e9ff', asset: 'rail', projectile: 'rail', targeting: 'first' },
  cryo: { name: 'CRYO SPIRE', desc: 'Slows and controls lanes', cost: 120, damage: 8, interval: 0.95, range: 175, projectileSpeed: 620, color: '#83bfff', asset: 'cryo', projectile: 'cryo', slow: 0.42, slowDuration: 1.8, targeting: 'first' },
  plasma: { name: 'PLASMA CANNON', desc: 'Heavy area damage', cost: 150, damage: 23, interval: 1.16, range: 170, projectileSpeed: 500, color: '#ff9c38', asset: 'plasma', projectile: 'plasma', splash: 72, targeting: 'cluster' },
  arcane: { name: 'ARCANE RELAY', desc: 'Long-range chain attacks', cost: 180, damage: 16, interval: 0.86, range: 205, projectileSpeed: 680, color: '#df6bff', asset: 'arcane', projectile: 'arcane', chain: 2, targeting: 'first' }
};

const ENEMY_TYPES = {
  drone: { name: 'Scout Drone', hp: 38, speed: 88, reward: 14, radius: 22, asset: 'drone', color: '#57e5ff' },
  runner: { name: 'Neon Runner', hp: 29, speed: 132, reward: 15, radius: 21, asset: 'runner', color: '#ff57df' },
  brute: { name: 'Siege Brute', hp: 105, speed: 58, reward: 24, radius: 31, asset: 'brute', armor: 0.18, color: '#ff6951' },
  shield: { name: 'Prism Guard', hp: 130, speed: 52, reward: 28, radius: 32, asset: 'shield', shield: 58, color: '#ffad45' },
  boss: { name: 'Abyss Executor', hp: 980, speed: 38, reward: 180, radius: 56, asset: 'boss', armor: 0.20, boss: true, color: '#c477ff' }
};

const LEVEL = {
  name: 'LOWER DISTRICT', waves: 5,
  path: [
    {x:70,y:535},{x:235,y:535},{x:320,y:450},{x:282,y:340},{x:395,y:245},
    {x:650,y:230},{x:850,y:258},{x:1050,y:345},{x:1120,y:475},{x:1075,y:610},
    {x:1190,y:690},{x:1385,y:650},{x:1490,y:515}
  ],
  slots: [
    {x:360,y:390},{x:535,y:350},{x:720,y:365},{x:900,y:405},
    {x:460,y:550},{x:650,y:585},{x:850,y:575},{x:1045,y:530},{x:1210,y:480}
  ],
  wavesData: [
    [{type:'drone',count:9,gap:.58}],
    [{type:'runner',count:10,gap:.42},{type:'drone',count:6,gap:.46}],
    [{type:'brute',count:6,gap:.78},{type:'runner',count:11,gap:.34}],
    [{type:'shield',count:7,gap:.68},{type:'drone',count:13,gap:.30}],
    [{type:'runner',count:13,gap:.25},{type:'brute',count:7,gap:.48},{type:'boss',count:1,gap:1.05}]
  ]
};

const state = {
  ready: false, running: false, paused: false, speed: 1, sound: true,
  hp: 20, maxHp: 20, credits: 360, score: 0, kills: 0, wave: 0,
  selectedBuild: 'rail', selectedTower: null, drag: null,
  towers: [], enemies: [], projectiles: [], particles: [], fx: [], floating: [], beams: [],
  spawnQueue: [], spawnTimer: 0, waveActive: false, buildPhase: true,
  screenShake: 0, flash: 0, hoverSlot: -1, pointer: {x:0,y:0},
  resonance: { frost: 0, energy: 0, arcane: 0 },
  mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},
  lastTime: performance.now(), ambientTime: 0, nextEnemyId: 1, empCooldown: 0
};

let audioCtx = null;
function audioTone(freq=440, duration=.06, type='sine', gain=.03, slide=0) {
  if (!state.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq,audioCtx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),audioCtx.currentTime+duration);
    g.gain.setValueAtTime(gain,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);
    osc.connect(g).connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime+duration);
  } catch {}
}

function loadAssets() {
  const failures=[];
  return Promise.all(Object.entries(ASSET_PATHS).map(([key,src]) => new Promise((resolve,reject) => {
    const image = new Image();
    image.onload=()=>{img[key]=image;resolve();};
    image.onerror=()=>{failures.push(src);reject(new Error(`Asset failed: ${src}`));};
    image.src=src;
  }))).then(()=>{window.__assetLoadFailures=failures;});
}

function fitGame() {
  const scale = Math.min(innerWidth / DESIGN.w, innerHeight / DESIGN.h);
  const shell = $('game-shell');
  shell.style.transform = `scale(${scale})`;
  shell.style.left = `${Math.max(0,(innerWidth - DESIGN.w*scale)/2)}px`;
  shell.style.top = `${Math.max(0,(innerHeight - DESIGN.h*scale)/2)}px`;
}
addEventListener('resize',fitGame); fitGame();

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function rand(a,b){return a+Math.random()*(b-a);}
function hexToRgb(hex){const v=parseInt(hex.slice(1),16);return {r:v>>16,g:(v>>8)&255,b:v&255};}
function rgba(hex,a){const c=hexToRgb(hex);return `rgba(${c.r},${c.g},${c.b},${a})`;}

function pathMetrics(points) {
  let total=0; const seg=[];
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],len=dist(a,b);seg.push({a,b,len,start:total});total+=len;}
  return {seg,total};
}
const pathInfo = pathMetrics(LEVEL.path);
function pathPoint(progress) {
  const d = clamp(progress,0,1)*pathInfo.total;
  let s=pathInfo.seg[pathInfo.seg.length-1];
  for(const k of pathInfo.seg){if(d<=k.start+k.len){s=k;break;}}
  const t=clamp((d-s.start)/s.len,0,1);
  return {x:lerp(s.a.x,s.b.x,t),y:lerp(s.a.y,s.b.y,t),angle:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)};
}

function createEnemy(type, waveScale) {
  const def=ENEMY_TYPES[type];
  return {
    id:state.nextEnemyId++,type,def,progress:0,hp:def.hp*waveScale,maxHp:def.hp*waveScale,shield:(def.shield||0)*waveScale,maxShield:(def.shield||0)*waveScale,
    slow:0,slowFactor:1,hit:0,dead:false,bob:Math.random()*Math.PI*2,angle:0,alpha:0,spawnScale:0.2
  };
}
function createTower(type, slot, level=1) {
  return { type, def:TOWER_TYPES[type], slot, level, cooldown:rand(0,.15), recoil:0, charge:0, selected:false, kills:0, totalDamage:0, flash:0 };
}

function resetGame() {
  Object.assign(state,{running:true,paused:false,speed:1,hp:20,maxHp:20,credits:360,score:0,kills:0,wave:0,selectedBuild:'rail',selectedTower:null,drag:null,towers:[],enemies:[],projectiles:[],particles:[],fx:[],floating:[],beams:[],spawnQueue:[],spawnTimer:0,waveActive:false,buildPhase:true,screenShake:0,flash:0,resonance:{frost:0,energy:0,arcane:0},mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},lastTime:performance.now(),nextEnemyId:1,empCooldown:0});
  recomputeResonance(); updateUI(); selectBuild('rail'); drawMinimap();
}

function startWave() {
  if(!state.running || state.waveActive || state.wave>=LEVEL.waves) return;
  state.wave++; state.waveActive=true; state.buildPhase=false; state.spawnQueue=[];
  const scale=1+(state.wave-1)*.24;
  let delay=0;
  for(const group of LEVEL.wavesData[state.wave-1]){
    for(let i=0;i<group.count;i++){state.spawnQueue.push({type:group.type,at:delay,scale});delay+=group.gap;}
    delay+=.8;
  }
  state.spawnTimer=0;
  showWaveBanner(`WAVE ${state.wave}`);
  if(state.wave===5) showBossBanner();
  audioTone(160,.18,'sawtooth',.035,180);
  updateUI();
}

function finishWave() {
  state.waveActive=false; state.buildPhase=true;
  const reward=48+state.wave*12; state.credits += reward;
  const heal=1+state.mods.coreRegen; state.hp=Math.min(state.maxHp,state.hp+heal);
  state.score += state.wave*300;
  showToast(`WAVE ${state.wave} CLEAR  +${reward} CREDITS  +${heal} CORE`);
  burstAt(1490,515,'#5eeaff',24,140);
  audioTone(540,.12,'triangle',.045,260);
  if(state.wave>=LEVEL.waves){setTimeout(()=>endGame(true),850);} else {setTimeout(showProtocolChoices,450);}
  updateUI();
}

const PROTOCOL_POOL=[
  {icon:'➶',name:'PIERCING RAILS',desc:'Railgun damage +20%',color:'#5ce9ff',apply:()=>state.mods.damage.rail*=1.2},
  {icon:'❄',name:'ABSOLUTE ZERO',desc:'Cryo slow strength +18%',color:'#8abfff',apply:()=>state.mods.cryoSlow*=1.18},
  {icon:'●',name:'FUSION WARHEAD',desc:'Plasma blast radius +20%',color:'#ff9b37',apply:()=>state.mods.plasmaSplash*=1.2},
  {icon:'△',name:'ARCANE SPLIT',desc:'Arcane chains to +1 target',color:'#df69ff',apply:()=>state.mods.arcaneChain++},
  {icon:'◎',name:'LONGSIGHT ARRAY',desc:'All tower range +10%',color:'#83f4e0',apply:()=>state.mods.range*=1.1},
  {icon:'✚',name:'NANO REPAIR',desc:'Restore +1 extra core each wave',color:'#75ffa3',apply:()=>state.mods.coreRegen++},
  {icon:'ϟ',name:'GLOBAL AMPLIFIER',desc:'All tower damage +10%',color:'#ffe171',apply:()=>Object.keys(state.mods.damage).forEach(k=>state.mods.damage[k]*=1.1)},
  {icon:'⬡',name:'ENERGY SALVAGE',desc:'Gain 90 credits now',color:'#ffd35f',apply:()=>state.credits+=90}
];
function showProtocolChoices(){
  state.paused=true;ui.protocolChoices.innerHTML='';
  const choices=[...PROTOCOL_POOL].sort(()=>Math.random()-.5).slice(0,3);
  choices.forEach(c=>{const b=document.createElement('button');b.className='protocol-choice';b.style.setProperty('--pc',c.color);b.innerHTML=`<i>${c.icon}</i><b>${c.name}</b><small>${c.desc}</small>`;b.onclick=()=>{c.apply();ui.protocol.classList.add('hidden');state.paused=false;audioTone(620,.14,'triangle',.05,360);showToast(`PROTOCOL LOADED: ${c.name}`);updateUI();};ui.protocolChoices.appendChild(b);});
  ui.protocol.classList.remove('hidden');
}

function endGame(win) {
  state.running=false; state.paused=true;
  ui.result.classList.remove('hidden');
  ui.resultEyebrow.textContent=win?'MISSION COMPLETE':'CORE COLLAPSED';
  ui.resultTitle.textContent=win?'LOWER DISTRICT SECURED':'CORE COLLAPSED';
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
  if(towerAtSlot(slot)){showToast('NODE OCCUPIED — DRAG A TOWER TO REDEPLOY');return false;}
  if(state.credits<def.cost){showToast('NOT ENOUGH CREDITS');audioTone(90,.08,'square',.025,-30);return false;}
  if(state.towers.length>=8){showToast('TOWER LIMIT REACHED — MERGE OR UPGRADE');return false;}
  state.credits-=def.cost; const tower=createTower(type,slot); state.towers.push(tower); state.selectedTower=tower; state.selectedBuild=null;
  burstAt(LEVEL.slots[slot].x,LEVEL.slots[slot].y,def.color,34,150); addFx('hit',LEVEL.slots[slot].x,LEVEL.slots[slot].y,.42,1.1,0,'screen');
  audioTone(type==='plasma'?180:type==='arcane'?480:360,.1,'triangle',.045,220); recomputeResonance(); updateUI(); showTowerInspector(tower); return true;
}

function moveOrMerge(tower,toSlot) {
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

function upgradeTower(tower) {
  if(!tower)return; const cost=Math.round(tower.def.cost*(.75+tower.level*.65));
  if(state.credits<cost){showToast('NOT ENOUGH CREDITS');return;}
  state.credits-=cost;tower.level++;const p=LEVEL.slots[tower.slot];burstAt(p.x,p.y,tower.def.color,50,200);addFx('hit',p.x,p.y,.55,1.4,0,'screen');addFloating(p.x,p.y-70,`UPGRADE  LV.${tower.level}`,'#ffe183',24);audioTone(500,.12,'triangle',.06,400);updateUI();showTowerInspector(tower);
}
function sellTower(tower) {
  if(!tower)return;const value=Math.round(tower.def.cost*(.45+.18*(tower.level-1)));state.credits+=value;state.towers=state.towers.filter(t=>t!==tower);state.selectedTower=null;showToast(`SALVAGED ${value} CREDITS`);recomputeResonance();updateUI();showCoreInspector();
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
    if(e.progress>=1){e.dead=true;const damage=e.def.boss?6:e.type==='brute'||e.type==='shield'?2:1;state.hp-=damage;state.screenShake=12;state.flash=.24;burstAt(1390,580,'#ff496f',40,190);addFloating(1360,500,`CORE -${damage}`,'#ff6577',24);audioTone(110,.18,'sawtooth',.055,-50);if(state.hp<=0)endGame(false);}
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

function spawnSparks(x,y,color,count,speed){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=rand(speed*.35,speed);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.18,.52),max:.52,size:rand(1.5,4),color,gravity:70});}}
function burstAt(x,y,color,count=22,speed=130){spawnSparks(x,y,color,count,speed);for(let i=0;i<5;i++)state.particles.push({x:x+rand(-20,20),y:y+rand(-15,15),vx:rand(-10,10),vy:rand(-34,-8),life:rand(.4,.9),max:.9,size:rand(12,24),color:rgba(color,.18),smoke:true,gravity:-10});}
function addFx(asset,x,y,life=.35,scale=.7,rot=0,blend='screen'){state.fx.push({asset,x,y,life,max:life,scale,rot,blend});}
function addFloating(x,y,text,color='#fff',size=14){state.floating.push({x,y,text:String(text),color,size,life:.75,max:.75});}
function updateEffects(dt){
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.gravity||0)*dt;p.vx*=.985;p.life-=dt;}
  for(const f of state.fx)f.life-=dt;for(const f of state.floating){f.y-=32*dt;f.life-=dt;}for(const b of state.beams)b.life-=dt;
  state.particles=state.particles.filter(p=>p.life>0);state.fx=state.fx.filter(f=>f.life>0);state.floating=state.floating.filter(f=>f.life>0);state.beams=state.beams.filter(b=>b.life>0);
  state.screenShake=Math.max(0,state.screenShake-dt*38);state.flash=Math.max(0,state.flash-dt);
}

function updateSpawning(dt){
  if(!state.waveActive)return;state.spawnTimer+=dt;
  while(state.spawnQueue.length&&state.spawnQueue[0].at<=state.spawnTimer){const data=state.spawnQueue.shift();state.enemies.push(createEnemy(data.type,data.scale));}
  if(!state.spawnQueue.length&&!state.enemies.length)finishWave();
}

function useEMP() {
  if(!state.running || state.paused || state.empCooldown>0 || !state.enemies.length)return;
  state.empCooldown=24;
  const center={x:800,y:455};
  state.rings ||= [];
  for(const e of state.enemies){
    const p=pathPoint(e.progress); applyDamage(e,Math.max(22,e.maxHp*.24),null,'cryo'); e.slow=Math.max(e.slow,2.4); e.slowFactor=.36;
    addFx('ice_burst',p.x,p.y,.45,e.def.boss?.85:.5,0,'screen');
  }
  state.flash=.22; state.screenShake=8; burstAt(center.x,center.y,'#8bdcff',70,240); audioTone(90,.36,'sawtooth',.07,680); showToast('EMP PULSE DEPLOYED'); updateUI();
}

function update(dt) {
  if(!state.ready||!state.running||state.paused)return;
  dt*=state.speed;state.ambientTime+=dt;state.empCooldown=Math.max(0,state.empCooldown-dt);updateSpawning(dt);updateEnemies(dt);updateTowers(dt);updateProjectiles(dt);updateEffects(dt);updateUI(false);
}

function drawBackground(){ctx.drawImage(img.background,0,0,img.background.width,img.background.height,0,0,DESIGN.w,DESIGN.h);const g=ctx.createRadialGradient(800,430,180,800,430,850);g.addColorStop(0,'rgba(18,45,72,.04)');g.addColorStop(1,'rgba(0,0,0,.48)');ctx.fillStyle=g;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);}
function drawPath() {
  const pts=LEVEL.path;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowBlur=35;ctx.shadowColor='#d941ff';ctx.strokeStyle='rgba(179,40,255,.18)';ctx.lineWidth=64;pathStroke(pts);
  ctx.shadowBlur=17;ctx.shadowColor='#ef4aff';ctx.strokeStyle='rgba(253,66,255,.72)';ctx.lineWidth=36;pathStroke(pts);
  const grad=ctx.createLinearGradient(80,700,1400,400);grad.addColorStop(0,'#ff3f80');grad.addColorStop(.38,'#db4cff');grad.addColorStop(.72,'#6a7cff');grad.addColorStop(1,'#55e7ff');ctx.shadowBlur=0;ctx.strokeStyle=grad;ctx.lineWidth=28;pathStroke(pts);
  ctx.strokeStyle='rgba(10,22,41,.95)';ctx.lineWidth=18;pathStroke(pts);
  ctx.strokeStyle='rgba(207,147,255,.78)';ctx.lineWidth=2;ctx.setLineDash([12,14]);pathStroke(pts);ctx.setLineDash([]);
  // animated route arrows
  for(let i=0;i<11;i++){const prog=((state.ambientTime*.07+i/11)%1),p=pathPoint(prog);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='rgba(255,176,255,.82)';ctx.shadowColor='#f85cff';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-5,-7);ctx.lineTo(0,0);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.restore();
}
function pathStroke(pts){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}

function drawSpawnGate(){const p=LEVEL.path[0];ctx.save();ctx.translate(p.x-30,p.y);ctx.shadowColor='#ff365f';ctx.shadowBlur=35;ctx.fillStyle='rgba(62,7,19,.9)';ctx.strokeStyle='#ff436a';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-52,-52,85,104,12);ctx.fill();ctx.stroke();ctx.fillStyle='#ff4d6d';for(let i=-30;i<=30;i+=20)ctx.fillRect(-38,i,56,4);ctx.fillStyle='#fff';ctx.font='700 13px sans-serif';ctx.textAlign='center';ctx.fillText('SPAWN',-10,76);ctx.restore();}
function drawCore(){const p=LEVEL.path.at(-1),pulse=1+Math.sin(state.ambientTime*2.6)*.035;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor='#c75cff';ctx.shadowBlur=34;ctx.globalAlpha=.98;ctx.drawImage(img.core,-95,-115,190,190);ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(105,232,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,42,66,23,0,0,Math.PI*2);ctx.stroke();ctx.restore();}

function drawSlots(){
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower;ctx.save();ctx.translate(p.x,p.y);const color=t?t.def.color:hover?'#8affd3':'#45d9ff';ctx.shadowColor=color;ctx.shadowBlur=hover||selected?28:15;ctx.fillStyle='rgba(5,16,31,.86)';ctx.strokeStyle=color;ctx.lineWidth=hover||selected?3:2;polygon(0,0,44,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=1;polygon(0,0,33,8);ctx.stroke();if(!t){ctx.strokeStyle='rgba(72,224,255,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.moveTo(0,-11);ctx.lineTo(0,11);ctx.stroke();}ctx.restore();
  });
}
function polygon(cx,cy,r,n){ctx.beginPath();for(let i=0;i<n;i++){const a=-Math.PI/8+i*Math.PI*2/n,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}

function drawTower(t){
  const p=LEVEL.slots[t.slot], def=t.def, baseScale=.31+.018*(t.level-1), recoil=t.recoil*8;
  if(t===state.selectedTower){const range=def.range*(1+.08*(t.level-1))*state.mods.range;ctx.save();ctx.strokeStyle=rgba(def.color,.55);ctx.fillStyle=rgba(def.color,.06);ctx.setLineDash([8,9]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  // resonance links
  for(const other of state.towers){if(other===t||other.slot<t.slot)continue;const op=LEVEL.slots[other.slot];if(dist(p,op)<250&&other.type!==t.type){ctx.save();ctx.strokeStyle=rgba(t.def.color,.22);ctx.lineWidth=2;ctx.setLineDash([5,9]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(op.x,op.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();}}
  ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=def.color;ctx.shadowBlur=20+t.charge*12;ctx.globalAlpha=.97;ctx.drawImage(img[def.asset],-210*baseScale,-225*baseScale-recoil,420*baseScale,420*baseScale);ctx.shadowBlur=0;
  if(t.flash>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=t.flash*.45;ctx.fillStyle=def.color;ctx.beginPath();ctx.arc(0,-35,38,0,Math.PI*2);ctx.fill();}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='rgba(2,8,18,.9)';ctx.strokeStyle=def.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(30,18,42,23,10);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 13px sans-serif';ctx.textAlign='center';ctx.fillText(`L${t.level}`,51,34);ctx.restore();
}

function drawEnemy(e){
  const p=pathPoint(e.progress), bob=Math.sin(e.bob)*3, scale=(e.def.boss?.32:e.type==='brute'||e.type==='shield'?.26:e.type==='runner'?.23:.21)*e.spawnScale;
  ctx.save();ctx.translate(p.x,p.y+bob);ctx.rotate(Math.sin(e.bob*.3)*.03);ctx.globalAlpha=e.alpha;ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(0,23,e.def.boss?52:30,e.def.boss?17:10,0,0,Math.PI*2);ctx.fill();ctx.shadowColor=e.def.color;ctx.shadowBlur=e.def.boss?24:12;const sourceSize=e.def.boss?500:360;ctx.drawImage(img[e.def.asset],-sourceSize*scale/2,-sourceSize*scale*.56,sourceSize*scale,sourceSize*scale);ctx.shadowBlur=0;
  if(e.type==='shield'&&e.shield>0){ctx.strokeStyle='rgba(255,173,63,.9)';ctx.fillStyle='rgba(255,160,50,.08)';ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a)*43,y=Math.sin(a)*31;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();}
  if(e.slow>0){ctx.strokeStyle='rgba(117,218,255,.86)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,e.def.boss?57:36,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+state.ambientTime;ctx.fillStyle='#a9eaff';ctx.fillRect(Math.cos(a)*41-2,Math.sin(a)*31-2,4,4);}}
  if(e.hit>0){ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,255,255,${clamp(e.hit*5,0,.7)})`;ctx.beginPath();ctx.arc(0,0,e.def.boss?60:35,0,Math.PI*2);ctx.fill();}
  ctx.restore();
  const barW=e.def.boss?105:54, y=p.y-(e.def.boss?78:48);ctx.fillStyle='rgba(0,0,0,.78)';ctx.beginPath();ctx.roundRect(p.x-barW/2,y,barW,7,4);ctx.fill();ctx.fillStyle=e.def.boss?'#ff4168':'#67f3a1';ctx.beginPath();ctx.roundRect(p.x-barW/2,y,barW*clamp(e.hp/e.maxHp,0,1),7,4);ctx.fill();if(e.shield>0){ctx.fillStyle='#ffbb50';ctx.fillRect(p.x-barW/2,y+9,barW*clamp(e.shield/e.maxShield,0,1),3);}if(e.def.boss){ctx.fillStyle='#ff819a';ctx.font='800 14px sans-serif';ctx.textAlign='center';ctx.fillText('BOSS',p.x,y-9);}
}

function drawProjectiles(){
  for(const p of state.projectiles){
    for(let i=0;i<p.trail.length;i++){const t=p.trail[i],a=(i+1)/p.trail.length*.22;ctx.fillStyle=rgba(p.color,a);ctx.beginPath();ctx.arc(t.x,t.y,2+i*.25,0,Math.PI*2);ctx.fill();}
    ctx.save();ctx.translate(p.x,p.y);ctx.globalCompositeOperation='screen';ctx.shadowColor=p.color;ctx.shadowBlur=18;const asset=p.type==='cryo'?'ice_burst':p.type==='plasma'?'plasma_blast':'arcane_bolt';const size=p.type==='plasma'?34:26;ctx.drawImage(img[asset],-size/2,-size/2,size,size);ctx.restore();
  }
  for(const b of state.beams){ctx.save();ctx.globalAlpha=b.life/b.max;ctx.shadowColor=b.color;ctx.shadowBlur=18;ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.beginPath();ctx.moveTo(b.x1,b.y1);if(b.zigzag){const steps=5;for(let i=1;i<steps;i++){const t=i/steps,x=lerp(b.x1,b.x2,t)+rand(-10,10),y=lerp(b.y1,b.y2,t)+rand(-10,10);ctx.lineTo(x,y);}}ctx.lineTo(b.x2,b.y2);ctx.stroke();ctx.restore();}
}
function drawEffects(){
  for(const f of state.fx){const a=clamp(f.life/f.max,0,1),s=140*f.scale*(1+(1-a)*.35);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot);ctx.globalAlpha=a;ctx.globalCompositeOperation=f.blend;ctx.drawImage(img[f.asset],-s/2,-s/2,s,s);ctx.restore();}
  for(const p of state.particles){const a=clamp(p.life/p.max,0,1);ctx.save();ctx.globalAlpha=a;if(p.smoke){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1+(1-a)*.5),0,Math.PI*2);ctx.fill();}else{ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillStyle=p.color;ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}ctx.restore();}
  for(const f of state.floating){ctx.save();ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.font=`800 ${f.size}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=f.color;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.fillText(f.text,f.x,f.y);ctx.restore();}
}

function drawAmbient(){
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<18;i++){const x=(i*173+state.ambientTime*22)%1600-30,y=120+(i*79)%650,a=.05+.04*Math.sin(state.ambientTime+i);ctx.strokeStyle=`rgba(112,211,255,${a})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+28);ctx.stroke();}
  ctx.restore();
}

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
  if(state.waveActive){ui.waveSub.textContent=`HOSTILES ${state.enemies.length+state.spawnQueue.length}`;ui.startWave.disabled=true;ui.startWaveSub.textContent='IN COMBAT';}
  else {ui.waveSub.textContent=state.wave>=LEVEL.waves?'DISTRICT SECURED':'BUILD PHASE';ui.startWave.disabled=state.wave>=LEVEL.waves;ui.startWaveSub.textContent=state.wave>=LEVEL.waves?'COMPLETE':`WAVE ${state.wave+1}`;}
  ui.speed.querySelector('span').textContent=`×${state.speed}`;ui.pause.textContent=state.paused?'▶':'Ⅱ';if(ui.emp){ui.emp.disabled=state.empCooldown>0||!state.enemies.length;ui.empText.textContent=state.empCooldown>0?`${Math.ceil(state.empCooldown)}s`:(state.enemies.length?'READY':'STANDBY');}
  if(expensive){document.querySelectorAll('.tower-card').forEach(el=>{const d=TOWER_TYPES[el.dataset.type];el.disabled=state.credits<d.cost||state.towers.length>=8;});drawMinimap();}
}
function showTowerInspector(t){
  if(!t)return;state.selectedTower=t;const p=t.def;ui.inspectName.textContent=`${p.name} · Lv.${t.level}`;ui.inspectImage.src=ASSET_PATHS[p.asset];ui.inspectALabel.textContent='DAMAGE';ui.inspectBLabel.textContent='RATE';ui.inspectCLabel.textContent='RANGE';ui.inspectDLabel.textContent='KILLS';ui.inspectA.textContent=Math.round(p.damage*Math.pow(1.62,t.level-1)*state.mods.damage[t.type]);ui.inspectB.textContent=`${(p.interval/(1+.16*(t.level-1))).toFixed(2)}s`;ui.inspectC.textContent=Math.round(p.range*(1+.08*(t.level-1))*state.mods.range);ui.inspectD.textContent=t.kills;ui.inspectTip.textContent=`${p.desc}. ${Math.round(t.totalDamage)} total damage.`;ui.towerActions.classList.remove('hidden');const cost=Math.round(p.cost*(.75+t.level*.65));ui.upgradeCost.textContent=cost;ui.sellValue.textContent=Math.round(p.cost*(.45+.18*(t.level-1)));
}
function showCoreInspector(){ui.inspectName.textContent='BASTION CORE';ui.inspectImage.src=ASSET_PATHS.core;ui.inspectALabel.textContent='ARMOR';ui.inspectBLabel.textContent='REPAIR';ui.inspectCLabel.textContent='STATUS';ui.inspectDLabel.textContent='THREAT';ui.inspectA.textContent=`${Math.max(0,state.hp)} / ${state.maxHp}`;ui.inspectB.textContent=`+${1+state.mods.coreRegen} / wave`;ui.inspectC.textContent=state.hp>10?'STABLE':state.hp>5?'WARNING':'CRITICAL';ui.inspectD.textContent=state.wave<3?'LOW':state.wave<5?'HIGH':'BOSS';ui.inspectTip.textContent='Protect the core and keep the route locked down.';ui.towerActions.classList.add('hidden');}
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

// Tower cards support click and native drag-style pointer selection.
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
ui.emp?.addEventListener('click',useEMP);
ui.upgradeBtn.addEventListener('click',()=>upgradeTower(state.selectedTower));
ui.sellBtn.addEventListener('click',()=>sellTower(state.selectedTower));
ui.speed.addEventListener('click',()=>{state.speed=state.speed===1?1.5:state.speed===1.5?2:1;updateUI();});
ui.pause.addEventListener('click',()=>{state.paused=!state.paused;updateUI();showToast(state.paused?'PAUSED':'RESUMED');});
ui.sound.addEventListener('click',()=>{state.sound=!state.sound;ui.sound.textContent=state.sound?'♪':'×';});
$('enterBtn').addEventListener('click',()=>{ui.intro.classList.add('hidden');resetGame();showToast('SELECT A TOWER, THEN CLICK A GLOWING NODE');});
$('restartBtn').addEventListener('click',()=>{ui.result.classList.add('hidden');resetGame();});

function loop(now){const dt=Math.min(.033,(now-state.lastTime)/1000||0);state.lastTime=now;update(dt);render();requestAnimationFrame(loop);}

loadAssets().then(()=>{
  state.ready=true;drawMinimap();showCoreInspector();updateUI();requestAnimationFrame(loop);
  window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img};
  const qa=new URLSearchParams(location.search).get('qa');
  if(qa){
    ui.intro.classList.add('hidden');resetGame();
    if(['built','battle','protocol','result'].includes(qa)){
      state.credits=1000;
      buildTower('rail',0);buildTower('cryo',1);buildTower('plasma',5);buildTower('arcane',7);
    }
    if(qa==='battle'){startWave();state.speed=2;}
    if(qa==='protocol'){showProtocolChoices();}
    if(qa==='result'){state.wave=5;state.score=6840;state.kills=74;endGame(true);}
  }
}).catch(err=>{console.error(err);document.body.innerHTML=`<div style="padding:30px;color:white;font:16px system-ui">${err.message}</div>`;});
})();
