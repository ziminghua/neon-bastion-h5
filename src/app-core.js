'use strict';

const DESIGN = { w: 1536, h: 1024, worldBottom: 790 };
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
  pause: $('pauseBtn'), speed: $('speedBtn'), sound: $('soundBtn')
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
  rail: { name: '轨道箭塔', desc: '高速单体输出', cost: 100, damage: 12, interval: 0.55, range: 180, projectileSpeed: 850, color: '#55e9ff', asset: 'rail', projectile: 'rail', targeting: 'first' },
  cryo: { name: '寒冰塔', desc: '持续减速控制', cost: 120, damage: 8, interval: 1.05, range: 165, projectileSpeed: 580, color: '#83bfff', asset: 'cryo', projectile: 'cryo', slow: 0.42, slowDuration: 1.8, targeting: 'first' },
  plasma: { name: '等离子炮塔', desc: '高伤范围爆破', cost: 150, damage: 21, interval: 1.28, range: 160, projectileSpeed: 470, color: '#ff9c38', asset: 'plasma', projectile: 'plasma', splash: 66, targeting: 'cluster' },
  arcane: { name: '奥术塔', desc: '远程连锁穿透', cost: 180, damage: 15, interval: 0.92, range: 195, projectileSpeed: 650, color: '#df6bff', asset: 'arcane', projectile: 'arcane', chain: 2, targeting: 'first' }
};

const ENEMY_TYPES = {
  drone: { name: '巡猎无人机', hp: 38, speed: 78, reward: 14, radius: 22, asset: 'drone', color: '#57e5ff' },
  runner: { name: '疾行掠夺者', hp: 27, speed: 122, reward: 15, radius: 21, asset: 'runner', color: '#ff57df' },
  brute: { name: '重装机兵', hp: 100, speed: 54, reward: 24, radius: 31, asset: 'brute', armor: 0.18, color: '#ff6951' },
  shield: { name: '棱镜护盾兽', hp: 125, speed: 48, reward: 28, radius: 32, asset: 'brute', shield: 55, color: '#ffad45' },
  boss: { name: '深渊执行者', hp: 1150, speed: 37, reward: 180, radius: 56, asset: 'boss', armor: 0.22, boss: true, color: '#c477ff' }
};

const LEVEL = {
  name: '霓虹下城区', waves: 10,
  path: [
    {x: 94,y: 667}, {x: 233,y: 667}, {x: 271,y: 554}, {x: 219,y: 423}, {x: 320,y: 301},
    {x: 620,y: 286}, {x: 868,y: 302}, {x: 1065,y: 365}, {x: 1120,y: 501}, {x: 1058,y: 640},
    {x: 1135,y: 730}, {x: 1301,y: 712}, {x: 1394,y: 604}
  ],
  slots: [
    {x: 369,y: 402}, {x: 585,y: 412}, {x: 806,y: 419}, {x: 980,y: 510},
    {x: 405,y: 598}, {x: 650,y: 615}, {x: 883,y: 626}, {x: 1186,y: 505}
  ],
  wavesData: [
    [{type:'drone',count:8,gap:.75}],
    [{type:'drone',count:7,gap:.65},{type:'runner',count:5,gap:.55}],
    [{type:'runner',count:9,gap:.48},{type:'drone',count:7,gap:.5}],
    [{type:'brute',count:5,gap:1.05},{type:'drone',count:10,gap:.48}],
    [{type:'shield',count:5,gap:.95},{type:'runner',count:7,gap:.45},{type:'boss',count:1,gap:1.4}],
    [{type:'drone',count:16,gap:.38},{type:'brute',count:7,gap:.75}],
    [{type:'runner',count:18,gap:.34},{type:'shield',count:6,gap:.8}],
    [{type:'brute',count:10,gap:.62},{type:'shield',count:8,gap:.65}],
    [{type:'runner',count:20,gap:.28},{type:'brute',count:10,gap:.55},{type:'drone',count:14,gap:.3}],
    [{type:'shield',count:10,gap:.5},{type:'brute',count:12,gap:.48},{type:'boss',count:1,gap:1.2}]
  ]
};

const state = {
  ready: false, running: false, paused: false, speed: 1, sound: true,
  hp: 20, maxHp: 20, credits: 350, score: 0, kills: 0, wave: 0,
  selectedBuild: 'rail', selectedTower: null, drag: null,
  towers: [], enemies: [], projectiles: [], particles: [], fx: [], floating: [], beams: [],
  spawnQueue: [], spawnTimer: 0, waveActive: false, buildPhase: true,
  screenShake: 0, flash: 0, hoverSlot: -1, pointer: {x:0,y:0},
  resonance: { frost: 0, energy: 0, arcane: 0 },
  mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},
  lastTime: performance.now(), ambientTime: 0, nextEnemyId: 1
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
  return Promise.all(Object.entries(ASSET_PATHS).map(([key,src]) => new Promise((resolve,reject) => {
    const image = new Image(); image.onload=()=>{img[key]=image;resolve();}; image.onerror=reject; image.src=src;
  })));
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
  Object.assign(state,{running:true,paused:false,speed:1,hp:20,maxHp:20,credits:350,score:0,kills:0,wave:0,selectedBuild:'rail',selectedTower:null,drag:null,towers:[],enemies:[],projectiles:[],particles:[],fx:[],floating:[],beams:[],spawnQueue:[],spawnTimer:0,waveActive:false,buildPhase:true,screenShake:0,flash:0,resonance:{frost:0,energy:0,arcane:0},mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},lastTime:performance.now(),nextEnemyId:1});
  state.towers.push(createTower('rail',1,1),createTower('cryo',4,1));
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
  if(state.wave===5||state.wave===10) showBossBanner();
  audioTone(160,.18,'sawtooth',.035,180);
  updateUI();
}

function finishWave() {
  state.waveActive=false; state.buildPhase=true; state.credits += 45 + state.wave*8; const heal=1+state.mods.coreRegen;state.hp=Math.min(state.maxHp,state.hp+heal);
  state.score += state.wave*250;
  showToast(`第 ${state.wave} 波清除 · 核心修复 +${heal} · 能源币 +${45+state.wave*8}`);
  burstAt(1367,563,'#5eeaff',24,140);
  audioTone(540,.12,'triangle',.045,260);
  if(state.wave>=LEVEL.waves){setTimeout(()=>endGame(true),900);}
  else if(state.wave%2===0){setTimeout(showProtocolChoices,450);}
  updateUI();
}
