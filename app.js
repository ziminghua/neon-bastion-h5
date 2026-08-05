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
  background: 'assets/world/lower-district-map.svg', core: 'assets/world/core.webp', logo: 'assets/ui/logo.webp',
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

// SCENE_MAP_FOUNDATION_V2
const LEVEL = {
  name: 'LOWER DISTRICT', waves: 5,
  path: [
    {x:70,y:590},{x:300,y:590},{x:430,y:530},{x:500,y:445},{x:610,y:380},
    {x:690,y:295},{x:840,y:270},{x:980,y:325},{x:1070,y:415},{x:1045,y:515},
    {x:950,y:590},{x:1030,y:655},{x:1230,y:650},{x:1365,y:585},{x:1460,y:520},{x:1510,y:500}
  ],
  slots: [
    {x:250,y:485,zone:'street'},{x:355,y:675,zone:'street'},{x:500,y:320,zone:'street'},
    {x:615,y:520,zone:'reactor'},{x:760,y:395,zone:'reactor'},{x:900,y:185,zone:'reactor'},
    {x:900,y:505,zone:'reactor'},{x:1110,y:545,zone:'bridge'},
    {x:1245,y:720,zone:'bridge'},{x:1340,y:430,zone:'core'}
  ],
  landmarks: [
    {id:'street',x:345,y:570,r:230},{id:'reactor',x:820,y:395,r:205},{id:'bridge',x:1250,y:610,r:230}
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
  towers: [], enemies: [], projectiles: [], particles: [], fx: [], floating: [], beams: [], rings: [], runes: [], decals: [],
  spawnQueue: [], spawnTimer: 0, waveActive: false, buildPhase: true,
  screenShake: 0, flash: 0, hoverSlot: -1, pointer: {x:0,y:0},
  resonance: { frost: 0, energy: 0, arcane: 0 },
  mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},
  lastTime: performance.now(), ambientTime: 0, nextEnemyId: 1, empCooldown: 0
};

const sceneStyle=document.createElement('style');
sceneStyle.textContent=`
  .mission-panel,.inspector,.bottom-deck{transition:opacity .28s ease,transform .28s ease,filter .28s ease}
  body.combat-active .mission-panel{opacity:.24;transform:translateX(-15px);filter:saturate(.7)}
  body.combat-active .inspector:not(:hover){opacity:.32;transform:translateX(14px);filter:saturate(.72)}
  body.combat-active .bottom-deck:not(:hover){opacity:.82;transform:translateX(-50%) translateY(5px)}
`;
document.head.appendChild(sceneStyle);

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
    slow:0,slowFactor:1,frost:0,hit:0,impact:0,impactKind:'rail',dead:false,bob:Math.random()*Math.PI*2,angle:0,alpha:0,spawnScale:0.2
  };
}
function createTower(type, slot, level=1) {
  return { type, def:TOWER_TYPES[type], slot, level, cooldown:rand(0,.15), recoil:0, charge:0, selected:false, kills:0, totalDamage:0, flash:0, muzzle:0, aim:-Math.PI/2 };
}

function resetGame() {
  Object.assign(state,{running:true,paused:false,speed:1,hp:20,maxHp:20,credits:360,score:0,kills:0,wave:0,selectedBuild:'rail',selectedTower:null,drag:null,towers:[],enemies:[],projectiles:[],particles:[],fx:[],floating:[],beams:[],rings:[],runes:[],decals:[],spawnQueue:[],spawnTimer:0,waveActive:false,buildPhase:true,screenShake:0,flash:0,resonance:{frost:0,energy:0,arcane:0},mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},lastTime:performance.now(),nextEnemyId:1,empCooldown:0});
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
  const core=LEVEL.path.at(-1);burstAt(core.x,core.y,'#5eeaff',24,140);
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

function setTowerMotion(tower,from,to,duration=240) {
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
  const angle=Math.atan2(ep.y-(p.y-28),ep.x-p.x);tower.aim=angle;tower.recoil=1;tower.flash=1;tower.muzzle=.16;
  const muzzle={x:p.x+Math.cos(angle)*30,y:p.y-28+Math.sin(angle)*30};
  if(tower.type==='rail'){
    state.beams.push({kind:'rail',x1:muzzle.x,y1:muzzle.y,x2:ep.x,y2:ep.y,color:def.color,life:.12,max:.12,width:8});
    state.beams.push({kind:'rail-core',x1:muzzle.x,y1:muzzle.y,x2:ep.x,y2:ep.y,color:'#ffffff',life:.07,max:.07,width:2});
    addRing(ep.x,ep.y,'#8cf6ff',8,46,.22,3);addRing(muzzle.x,muzzle.y,def.color,4,25,.14,2);
    applyDamage(target,damage,tower,'rail');spawnSparks(ep.x,ep.y,'#b9fbff',18,180);spawnSparks(muzzle.x,muzzle.y,def.color,7,90);
    audioTone(1080,.04,'square',.024,-620);
  } else {
    state.projectiles.push({type:tower.type,x:muzzle.x,y:muzzle.y,target,damage,speed:def.projectileSpeed,color:def.color,splash:def.splash||0,slow:(def.slow||0)*state.mods.cryoSlow,slowDuration:def.slowDuration||0,chain:(def.chain||0)+state.mods.arcaneChain,tower,trail:[],spin:Math.random()*Math.PI*2});
    if(tower.type==='cryo'){addRing(muzzle.x,muzzle.y,'#a8eeff',3,18,.18,2);audioTone(370,.08,'sine',.026,240);}
    if(tower.type==='plasma'){addRing(muzzle.x,muzzle.y,'#ffb14f',4,22,.18,3);audioTone(145,.11,'sawtooth',.038,-45);}
    if(tower.type==='arcane'){addRune(muzzle.x,muzzle.y,'#df74ff',.35,.55);audioTone(540,.09,'triangle',.03,230);}
  }
}

function applyDamage(enemy,amount,tower,kind=tower?.type||'rail') {
  if(enemy.dead)return 0;
  let dmg=amount*(1-(enemy.def.armor||0));
  if(kind==='arcane'&&enemy.def.armor)dmg*=1.25;
  const pos=pathPoint(enemy.progress);enemy.impact=.13;enemy.impactKind=kind;
  if(enemy.shield>0){const absorbed=Math.min(enemy.shield,dmg);enemy.shield-=absorbed;dmg-=absorbed;addRing(pos.x,pos.y,'#ffc25a',18,48,.2,3);spawnSparks(pos.x,pos.y,'#ffd786',10,120);}
  if(dmg>0){enemy.hp-=dmg;enemy.hit=.16;tower&&(tower.totalDamage+=dmg);addFloating(pos.x+rand(-9,9),pos.y-36,Math.round(dmg),kind==='plasma'?'#ffd078':kind==='cryo'?'#c4f7ff':kind==='arcane'?'#f0a2ff':'#fff',kind==='plasma'?19:14);}
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
    const tp=pathPoint(p.target.progress),dx=tp.x-p.x,dy=tp.y-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;
    p.spin+=dt*(p.type==='arcane'?9:p.type==='cryo'?6:3);
    p.trail.push({x:p.x,y:p.y,life:p.type==='plasma'?.28:.22,spin:p.spin});if(p.trail.length>(p.type==='plasma'?13:16))p.trail.shift();p.trail.forEach(t=>t.life-=dt);
    if(d<=step+9){
      applyDamage(p.target,p.damage,p.tower,p.type);
      if(p.type==='cryo'){
        p.target.slow=p.slowDuration;p.target.slowFactor=1-p.slow;p.target.frost=Math.min(1,p.target.frost+.58);
        addRing(tp.x,tp.y,'#a9efff',12,62,.42,3);addDecal('frost',tp.x,tp.y,1.3,.8);spawnIceShards(tp.x,tp.y,22);
        if(p.target.frost>.9){addRing(tp.x,tp.y,'#ffffff',6,78,.28,2);spawnIceShards(tp.x,tp.y,34);}
      }
      if(p.type==='plasma'){
        const radius=p.splash*state.mods.plasmaSplash*(1+state.resonance.energy*.15);
        addRing(tp.x,tp.y,'#ffb043',10,radius,.48,7);addRing(tp.x,tp.y,'#ff5b8d',18,radius*.72,.32,3);addDecal('scorch',tp.x,tp.y,3.2,radius/80);
        state.screenShake=Math.max(state.screenShake,10);spawnSparks(tp.x,tp.y,'#ffb05a',42,250);
        for(const e of state.enemies){if(e!==p.target&&!e.dead&&dist(tp,pathPoint(e.progress))<=radius)applyDamage(e,p.damage*.54,p.tower,'plasma');}
      }
      if(p.type==='arcane'){
        addRune(tp.x,tp.y,'#df75ff',.62,1);addRing(tp.x,tp.y,'#e994ff',8,46,.3,2);
        let prev=p.target;const targets=state.enemies.filter(e=>e!==prev&&!e.dead&&dist(tp,pathPoint(e.progress))<150).sort((a,b)=>dist(tp,pathPoint(a.progress))-dist(tp,pathPoint(b.progress))).slice(0,p.chain+state.resonance.arcane);
        let from=tp;targets.forEach((e,i)=>{const q=pathPoint(e.progress);state.beams.push({kind:'arcane',x1:from.x,y1:from.y,x2:q.x,y2:q.y,color:'#dc70ff',life:.25,max:.25,width:4,zigzag:true,seed:Math.random()*99});addRune(q.x,q.y,'#bf63ff',.42,.65);applyDamage(e,p.damage*(.6-i*.1),p.tower,'arcane');from=q;});
      }
      p.dead=true;
    } else {p.x+=dx/d*step;p.y+=dy/d*step;}
  }
  state.projectiles=state.projectiles.filter(p=>!p.dead);
}

function updateEnemies(dt) {
  for(const e of state.enemies){
    e.alpha=Math.min(1,e.alpha+dt*5);e.spawnScale=Math.min(1,e.spawnScale+dt*5);e.hit=Math.max(0,e.hit-dt);e.impact=Math.max(0,e.impact-dt);e.bob+=dt*(e.type==='runner'?8:4);
    if(e.slow>0){e.slow-=dt;if(e.slow<=0)e.slowFactor=1;}else e.frost=Math.max(0,e.frost-dt*.18);
    const impactDrag=e.impact>0?.58:1;e.progress+=(e.def.speed*e.slowFactor*impactDrag*dt)/pathInfo.total;
    const p=pathPoint(e.progress);e.angle=p.angle;
    if(e.progress>=1){e.dead=true;const damage=e.def.boss?6:e.type==='brute'||e.type==='shield'?2:1;state.hp-=damage;state.screenShake=12;state.flash=.24;const core=LEVEL.path.at(-1);burstAt(core.x,core.y,'#ff496f',40,190);addFloating(core.x-28,core.y-70,`CORE -${damage}`,'#ff6577',24);audioTone(110,.18,'sawtooth',.055,-50);if(state.hp<=0)endGame(false);}
  }
  state.enemies=state.enemies.filter(e=>!e.dead);
}

function updateTowers(dt) {
  for(const t of state.towers){
    t.cooldown-=dt;t.recoil=Math.max(0,t.recoil-dt*7);t.flash=Math.max(0,t.flash-dt*6);t.muzzle=Math.max(0,(t.muzzle||0)-dt);t.mergePulse=Math.max(0,(t.mergePulse||0)-dt*3.8);
    const target=findTarget(t);t.charge=target?Math.min(1,t.charge+dt*4):Math.max(0,t.charge-dt*3);
    if(target){const p=LEVEL.slots[t.slot],q=pathPoint(target.progress);t.aim=Math.atan2(q.y-(p.y-28),q.x-p.x);}
    if(target&&t.cooldown<=0){fireTower(t,target);t.cooldown=t.def.interval/(1+.16*(t.level-1));}
  }
}

function spawnSparks(x,y,color,count,speed){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=rand(speed*.35,speed);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.18,.52),max:.52,size:rand(1.5,4),color,gravity:70});}}
function burstAt(x,y,color,count=22,speed=130){spawnSparks(x,y,color,count,speed);for(let i=0;i<5;i++)state.particles.push({x:x+rand(-20,20),y:y+rand(-15,15),vx:rand(-10,10),vy:rand(-34,-8),life:rand(.4,.9),max:.9,size:rand(12,24),color:rgba(color,.18),smoke:true,gravity:-10});}
function addFx(asset,x,y,life=.35,scale=.7,rot=0,blend='screen'){state.fx.push({asset,x,y,life,max:life,scale,rot,blend});}
function addFloating(x,y,text,color='#fff',size=14){state.floating.push({x,y,text:String(text),color,size,life:.75,max:.75});}
function addRing(x,y,color,from,to,life=.3,width=3){state.rings.push({x,y,color,from,to,life,max:life,width});}
function addRune(x,y,color,life=.5,scale=1){state.runes.push({x,y,color,life,max:life,scale,rot:Math.random()*Math.PI});}
function addDecal(type,x,y,life=2,scale=1){state.decals.push({type,x,y,life,max:life,scale,rot:Math.random()*Math.PI});}
function spawnIceShards(x,y,count=18){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=rand(70,190);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.28,.62),max:.62,size:rand(2,6),color:'#bff7ff',gravity:90,shard:true,angle:a});}}
function updateEffects(dt){
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.gravity||0)*dt;p.vx*=.985;p.life-=dt;}
  for(const f of state.fx)f.life-=dt;for(const f of state.floating){f.y-=32*dt;f.life-=dt;}for(const b of state.beams)b.life-=dt;
  for(const r of state.rings)r.life-=dt;for(const r of state.runes){r.life-=dt;r.rot+=dt*2.2;}for(const d of state.decals)d.life-=dt;
  state.particles=state.particles.filter(p=>p.life>0);state.fx=state.fx.filter(f=>f.life>0);state.floating=state.floating.filter(f=>f.life>0);state.beams=state.beams.filter(b=>b.life>0);
  state.rings=state.rings.filter(r=>r.life>0);state.runes=state.runes.filter(r=>r.life>0);state.decals=state.decals.filter(d=>d.life>0);
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

function drawBackground(){
  ctx.drawImage(img.background,0,0,img.background.width,img.background.height,0,0,DESIGN.w,DESIGN.h);
  const reactorPulse=.025+.012*Math.sin(state.ambientTime*1.7);
  const reactor=ctx.createRadialGradient(820,400,18,820,400,220);
  reactor.addColorStop(0,'rgba(107,229,255,'+reactorPulse+')');
  reactor.addColorStop(.52,'rgba(56,115,150,'+(reactorPulse*.35)+')');
  reactor.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=reactor;ctx.fillRect(580,160,480,480);
  const core=ctx.createRadialGradient(1495,495,12,1495,495,150);
  core.addColorStop(0,'rgba(208,102,255,.07)');core.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=core;ctx.fillRect(1340,340,260,310);
  const vignette=ctx.createRadialGradient(805,425,280,805,425,980);
  vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.36)');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);
}
function drawPath(){
  const pts=LEVEL.path;ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  ctx.globalAlpha=state.waveActive?.18:.3;
  ctx.strokeStyle='rgba(185,218,232,.58)';ctx.lineWidth=1.2;ctx.setLineDash([15,24]);pathStroke(pts);ctx.setLineDash([]);
  const arrows=state.waveActive?5:7;
  for(let i=0;i<arrows;i++){
    const p=pathPoint((state.ambientTime*.028+i/arrows)%1);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='rgba(116,214,230,.55)';
    ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-4,-3.5);ctx.lineTo(-1,0);ctx.lineTo(-4,3.5);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.restore();
}
function pathStroke(pts){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}

function drawSpawnGate(){const p=LEVEL.path[0];ctx.save();ctx.translate(p.x-30,p.y);ctx.fillStyle='rgba(24,7,18,.96)';ctx.strokeStyle='#ff5577';ctx.lineWidth=3;ctx.shadowColor='#ff315f';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(-34,-38,54,76,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#ff5878';for(let i=-20;i<=20;i+=14)ctx.fillRect(-24,i,31,3);ctx.fillStyle='rgba(255,255,255,.78)';ctx.font='700 9px sans-serif';ctx.textAlign='center';ctx.fillText('BREACH',-7,52);ctx.restore();}
function drawCore(){const p=LEVEL.path.at(-1),pulse=1+Math.sin(state.ambientTime*2.6)*.022;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(3,12,27,.92)';ctx.strokeStyle='rgba(102,222,255,.34)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,36,69,29,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.scale(pulse,pulse);ctx.shadowColor='#c75cff';ctx.shadowBlur=22;ctx.drawImage(img.core,-62,-80,124,124);ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(105,232,255,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,34,49,16,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(199,92,255,.25)';ctx.beginPath();ctx.arc(0,-4,58+Math.sin(state.ambientTime*2)*2,0,Math.PI*2);ctx.stroke();ctx.restore();}

function drawSlots(){
  const dragging=state.drag?.moved&&state.drag.tower,reveal=Boolean(state.selectedBuild||dragging||(!state.waveActive&&state.towers.length<2));
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower,target=Boolean(dragging&&hover);
    const merge=target&&t&&t!==dragging&&t.type===dragging.type&&t.level===dragging.level,swap=target&&t&&t!==dragging&&!merge;
    const color=merge?'#ffd86f':swap?'#8db5ff':target?'#76ffc2':t?t.def.color:'#58dfff';
    const alpha=t||hover||target?1:reveal?.48:.045,pulse=target?1+Math.sin(performance.now()*.012)*.07:1;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor=color;ctx.shadowBlur=target?24:hover||selected?18:reveal?8:0;
    ctx.fillStyle=t?'rgba(3,13,27,.82)':'rgba(7,20,29,.22)';ctx.strokeStyle=color;ctx.lineWidth=target?3:hover||selected?2:1;polygon(0,0,target?31:25,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;polygon(0,0,18,8);ctx.stroke();
    if(!t||t===dragging){ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();}
    if(target){ctx.fillStyle=color;ctx.font='800 9px sans-serif';ctx.textAlign='center';ctx.fillText(merge?'MERGE':swap?'SWAP':'DEPLOY',0,45);}ctx.restore();
  });
}
function polygon(cx,cy,r,n){ctx.beginPath();for(let i=0;i<n;i++){const a=-Math.PI/8+i*Math.PI*2/n,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}

function towerDrawPosition(t){
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
  const home=LEVEL.slots[t.slot],pos=towerDrawPosition(t),def=t.def,baseScale=(.245+.015*(t.level-1))*(1+(t.mergePulse||0)*.11),recoil=t.recoil*7;
  if(pos.dragging){ctx.save();ctx.translate(home.x,home.y);ctx.globalAlpha=.18;ctx.strokeStyle=rgba(def.color,.7);ctx.setLineDash([6,7]);ctx.lineWidth=2;polygon(0,0,31,8);ctx.stroke();ctx.restore();ctx.save();ctx.strokeStyle=rgba(def.color,.3);ctx.setLineDash([6,10]);ctx.beginPath();ctx.moveTo(home.x,home.y);ctx.quadraticCurveTo((home.x+pos.x)/2,(home.y+pos.y)/2-42,pos.x,pos.y+18);ctx.stroke();ctx.restore();}
  if(t===state.selectedTower&&!pos.dragging){const range=def.range*(1+.08*(t.level-1))*state.mods.range;ctx.save();ctx.strokeStyle=rgba(def.color,.42);ctx.fillStyle=rgba(def.color,.035);ctx.setLineDash([8,10]);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(home.x,home.y,range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  ctx.save();ctx.translate(pos.x,pos.y);if(pos.dragging){ctx.translate(0,-8-Math.sin(performance.now()*.012)*4);ctx.scale(1.08,1.08);ctx.globalAlpha=.95;}ctx.shadowColor=def.color;ctx.shadowBlur=pos.dragging?32:14+t.charge*10;ctx.drawImage(img[def.asset],-210*baseScale,-225*baseScale-recoil,420*baseScale,420*baseScale);ctx.shadowBlur=0;
  if(t.muzzle>0){const a=t.aim||-Math.PI/2,mx=Math.cos(a)*31,my=-28+Math.sin(a)*31,k=t.muzzle/.16;ctx.globalCompositeOperation='screen';ctx.globalAlpha=k;ctx.translate(mx,my);ctx.rotate(a);if(t.type==='rail'){ctx.fillStyle='#fff';ctx.fillRect(-5,-2,28,4);ctx.fillStyle=def.color;ctx.fillRect(-9,-6,17,12);}else if(t.type==='cryo'){ctx.strokeStyle='#c7f8ff';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(15,0);ctx.stroke();}}else if(t.type==='plasma'){const g=ctx.createRadialGradient(0,0,1,0,0,22);g.addColorStop(0,'#fff');g.addColorStop(.35,'#ffd36a');g.addColorStop(1,'rgba(255,78,92,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();}else{ctx.strokeStyle='#ef9fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.stroke();ctx.rotate(state.ambientTime*2);ctx.strokeRect(-9,-9,18,18);}}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='rgba(2,8,18,.88)';ctx.strokeStyle=def.color;ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(25,16,38,21,9);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 12px sans-serif';ctx.textAlign='center';ctx.fillText(`L${t.level}`,44,31);ctx.restore();
}

function drawEnemy(e){
  const p=pathPoint(e.progress),bob=Math.sin(e.bob)*3,scale=(e.def.boss?.26:e.type==='brute'||e.type==='shield'?.21:e.type==='runner'?.185:.175)*e.spawnScale;
  const kick=e.impact>0?Math.sin(e.impact*90)*5:0;
  ctx.save();ctx.translate(p.x-Math.cos(e.angle)*kick,p.y+bob-Math.sin(e.angle)*kick);ctx.rotate(Math.sin(e.bob*.3)*.025);ctx.globalAlpha=e.alpha;
  ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.ellipse(0,22,e.def.boss?48:27,e.def.boss?16:9,0,0,Math.PI*2);ctx.fill();
  ctx.shadowColor=e.frost>.2?'#8be9ff':e.def.color;ctx.shadowBlur=e.def.boss?20:10;const sourceSize=e.def.boss?500:360;ctx.drawImage(img[e.def.asset],-sourceSize*scale/2,-sourceSize*scale*.56,sourceSize*scale,sourceSize*scale);ctx.shadowBlur=0;
  if(e.frost>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.18+e.frost*.35;ctx.fillStyle='#9cecff';ctx.beginPath();ctx.ellipse(0,0,e.def.boss?51:32,e.def.boss?44:29,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.5+e.frost*.35;ctx.strokeStyle='#c7f8ff';ctx.lineWidth=2;for(let i=0;i<6;i++){const a=i*Math.PI/3+state.ambientTime*.45,r=e.def.boss?55:37;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.72,Math.sin(a)*r*.55);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.75);ctx.stroke();}}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  if(e.type==='shield'&&e.shield>0){ctx.strokeStyle='rgba(255,190,78,.9)';ctx.fillStyle='rgba(255,160,50,.06)';ctx.lineWidth=2.5;polygon(0,0,42,6);ctx.fill();ctx.stroke();}
  if(e.hit>0){const hitColor=e.impactKind==='cryo'?'160,240,255':e.impactKind==='plasma'?'255,156,72':e.impactKind==='arcane'?'226,120,255':'255,255,255';ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(${hitColor},${clamp(e.hit*4.8,0,.72)})`;ctx.beginPath();ctx.arc(0,0,e.def.boss?57:33,0,Math.PI*2);ctx.fill();}ctx.restore();
  const barW=e.def.boss?100:50,y=p.y-(e.def.boss?74:45);ctx.fillStyle='rgba(0,0,0,.8)';ctx.beginPath();ctx.roundRect(p.x-barW/2,y,barW,6,4);ctx.fill();ctx.fillStyle=e.def.boss?'#ff4168':'#67f3a1';ctx.beginPath();ctx.roundRect(p.x-barW/2,y,barW*clamp(e.hp/e.maxHp,0,1),6,4);ctx.fill();if(e.shield>0){ctx.fillStyle='#ffc45b';ctx.fillRect(p.x-barW/2,y+8,barW*clamp(e.shield/e.maxShield,0,1),3);}if(e.def.boss){ctx.fillStyle='#ff819a';ctx.font='800 13px sans-serif';ctx.textAlign='center';ctx.fillText('BOSS',p.x,y-8);}
}

function drawProjectiles(){
  for(const p of state.projectiles){
    for(let i=0;i<p.trail.length;i++){const t=p.trail[i],a=Math.max(0,t.life/(p.type==='plasma'?.28:.22))*(i+1)/p.trail.length;ctx.save();ctx.globalAlpha=a;ctx.globalCompositeOperation='screen';if(p.type==='cryo'){ctx.fillStyle='#a8f3ff';ctx.beginPath();ctx.arc(t.x,t.y,2+i*.18,0,Math.PI*2);ctx.fill();}else if(p.type==='plasma'){ctx.fillStyle=i%2?'#ff7c51':'#ffca65';ctx.beginPath();ctx.arc(t.x,t.y,3+i*.34,0,Math.PI*2);ctx.fill();}else{ctx.strokeStyle='#db76ff';ctx.lineWidth=1.5;ctx.translate(t.x,t.y);ctx.rotate(t.spin);ctx.strokeRect(-3-i*.08,-3-i*.08,6+i*.16,6+i*.16);}ctx.restore();}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);ctx.globalCompositeOperation='screen';
    if(p.type==='cryo'){ctx.shadowColor='#a9efff';ctx.shadowBlur=16;ctx.fillStyle='#e7fdff';ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#83dcff';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(13,0);ctx.stroke();}}
    if(p.type==='plasma'){const g=ctx.createRadialGradient(0,0,1,0,0,19);g.addColorStop(0,'#fff');g.addColorStop(.25,'#ffd270');g.addColorStop(.62,'#ff6b54');g.addColorStop(1,'rgba(255,58,122,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();}
    if(p.type==='arcane'){ctx.shadowColor='#dd6fff';ctx.shadowBlur=18;ctx.fillStyle='#f1b2ff';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#df77ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.stroke();ctx.rotate(-p.spin*1.8);ctx.strokeRect(-9,-9,18,18);}ctx.restore();
  }
  for(const b of state.beams){ctx.save();const a=b.life/b.max;ctx.globalAlpha=a;ctx.globalCompositeOperation='screen';ctx.shadowColor=b.color;ctx.shadowBlur=b.kind==='rail'?22:16;ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.beginPath();ctx.moveTo(b.x1,b.y1);if(b.kind==='arcane'){const steps=7;for(let i=1;i<steps;i++){const t=i/steps,phase=(b.seed||0)+i*2.2;ctx.lineTo(lerp(b.x1,b.x2,t)+Math.sin(phase)*9,lerp(b.y1,b.y2,t)+Math.cos(phase)*9);}}ctx.lineTo(b.x2,b.y2);ctx.stroke();ctx.restore();}
}
function drawGroundEffects(){for(const d of state.decals){const a=clamp(d.life/d.max,0,1);ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.globalAlpha=Math.min(.42,a*.55);if(d.type==='scorch'){const g=ctx.createRadialGradient(0,0,4,0,0,55*d.scale);g.addColorStop(0,'rgba(255,116,44,.32)');g.addColorStop(.45,'rgba(90,22,18,.28)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,55*d.scale,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='rgba(150,235,255,.12)';ctx.strokeStyle='rgba(191,249,255,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,42*d.scale,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();}}
function drawEnergyEffects(){
  for(const r of state.rings){const t=1-r.life/r.max,rad=lerp(r.from,r.to,t);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-t)*.82;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=13;ctx.lineWidth=r.width*(1-t*.45);ctx.beginPath();ctx.arc(r.x,r.y,rad,0,Math.PI*2);ctx.stroke();ctx.restore();}
  for(const r of state.runes){const a=clamp(r.life/r.max,0,1),s=32*r.scale*(1+(1-a)*.28);ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.rot);ctx.globalCompositeOperation='screen';ctx.globalAlpha=a*.82;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=14;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.stroke();ctx.rotate(Math.PI/4);ctx.strokeRect(-s*.55,-s*.55,s*1.1,s*1.1);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(s*.72,0);ctx.lineTo(s,0);ctx.stroke();}ctx.restore();}
}
function drawEffects(){
  for(const f of state.fx){const a=clamp(f.life/f.max,0,1),s=140*f.scale*(1+(1-a)*.35);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot);ctx.globalAlpha=a;ctx.globalCompositeOperation=f.blend;ctx.drawImage(img[f.asset],-s/2,-s/2,s,s);ctx.restore();}
  for(const p of state.particles){const a=clamp(p.life/p.max,0,1);ctx.save();ctx.globalAlpha=a;ctx.translate(p.x,p.y);if(p.shard){ctx.rotate(p.angle||0);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(p.size*1.8,0);ctx.lineTo(-p.size,p.size*.55);ctx.lineTo(-p.size,-p.size*.55);ctx.closePath();ctx.fill();}else if(p.smoke){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size*(1+(1-a)*.5),0,Math.PI*2);ctx.fill();}else{ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);}ctx.restore();}
  for(const f of state.floating){ctx.save();ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.font=`800 ${f.size}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=f.color;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.fillText(f.text,f.x,f.y);ctx.restore();}
}

function drawAmbient(){
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<18;i++){const x=(i*173+state.ambientTime*22)%1600-30,y=120+(i*79)%650,a=.05+.04*Math.sin(state.ambientTime+i);ctx.strokeStyle=`rgba(112,211,255,${a})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+28);ctx.stroke();}
  ctx.restore();
}

function render(){
  const shake=state.screenShake>0?{x:rand(-state.screenShake,state.screenShake),y:rand(-state.screenShake*.6,state.screenShake*.6)}:{x:0,y:0};
  ctx.save();ctx.translate(shake.x,shake.y);drawBackground();drawPath();drawGroundEffects();drawSpawnGate();drawCore();drawSlots();state.towers.forEach(drawTower);state.enemies.forEach(drawEnemy);drawProjectiles();drawEnergyEffects();drawEffects();drawAmbient();ctx.restore();
  if(state.flash>0){ctx.fillStyle=`rgba(255,90,120,${state.flash*.25})`;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);}
}

function drawMinimap(){
  const w=minimap.width,h=minimap.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#031020';mctx.fillRect(0,0,w,h);mctx.strokeStyle='#1edcff';mctx.lineWidth=2;mctx.beginPath();LEVEL.path.forEach((p,i)=>{const x=p.x/DESIGN.w*w,y=p.y/760*h;i?mctx.lineTo(x,y):mctx.moveTo(x,y);});mctx.stroke();LEVEL.slots.forEach((p,i)=>{mctx.fillStyle=towerAtSlot(i)?TOWER_TYPES[towerAtSlot(i).type].color:'#143a51';mctx.beginPath();mctx.arc(p.x/DESIGN.w*w,p.y/760*h,4,0,Math.PI*2);mctx.fill();});mctx.fillStyle='#ff4c68';mctx.fillRect(LEVEL.path[0].x/DESIGN.w*w-4,LEVEL.path[0].y/760*h-4,8,8);const core=LEVEL.path.at(-1);mctx.fillStyle='#66e9ff';mctx.fillRect(core.x/DESIGN.w*w-5,core.y/760*h-5,10,10);
}

function updateUI(expensive=true){
  document.body.classList.toggle('combat-active',Boolean(state.waveActive&&!state.paused));
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
  const p=pointerPos(e);state.pointer=p;state.hoverSlot=slotAt(p.x,p.y,state.drag?72:55);
  if(state.drag){state.drag.x=p.x;state.drag.y=p.y;state.drag.moved=Math.hypot(p.x-state.drag.startX,p.y-state.drag.startY)>8;canvas.style.cursor=state.drag.moved?'grabbing':'grab';}
  else canvas.style.cursor=towerAtPoint(p.x,p.y)?'grab':state.hoverSlot>=0?'crosshair':'default';
});
canvas.addEventListener('pointerdown',e=>{
  if(!state.ready||!state.running||state.paused)return;const p=pointerPos(e),tower=towerAtPoint(p.x,p.y),slot=slotAt(p.x,p.y,58);
  if(tower){state.selectedTower=tower;state.selectedBuild=null;state.drag={tower,x:p.x,y:p.y,startX:p.x,startY:p.y,moved:false};showTowerInspector(tower);canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);return;}
  if(slot>=0&&state.selectedBuild){buildTower(state.selectedBuild,slot);return;}
  state.selectedTower=null;showCoreInspector();
});
canvas.addEventListener('pointerup',e=>{
  if(!state.drag)return;const p=pointerPos(e),to=slotAt(p.x,p.y,72),drag=state.drag;state.drag=null;canvas.style.cursor='default';if(drag.moved&&to>=0)moveOrMerge(drag.tower,to,p);else showTowerInspector(drag.tower);updateUI();
});
canvas.addEventListener('pointercancel',()=>{state.drag=null;state.hoverSlot=-1;canvas.style.cursor='default';});
canvas.addEventListener('pointerleave',()=>{if(!state.drag){state.hoverSlot=-1;canvas.style.cursor='default';}});

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
  window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img,level:LEVEL,pathInfo,createEnemy,fireTower,pathPoint,towerTypes:TOWER_TYPES};
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
