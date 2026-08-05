from pathlib import Path
import re
p=Path('app.js')
s=p.read_text()
s=s.replace("const DESIGN = { w: 1536, h: 1024, worldBottom: 790 };","const DESIGN = { w: 1600, h: 900, worldBottom: 760 };")
# UI add EMP
s=s.replace("pause: $('pauseBtn'), speed: $('speedBtn'), sound: $('soundBtn')","pause: $('pauseBtn'), speed: $('speedBtn'), sound: $('soundBtn'), emp: $('empBtn'), empText: $('empText')")
# Tower/Enemy definitions translated and tuned
s=re.sub(r"const TOWER_TYPES = \{.*?\n\};\n\nconst ENEMY_TYPES = \{.*?\n\};",'''const TOWER_TYPES = {
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
};''',s,flags=re.S)
# Level block
s=re.sub(r"const LEVEL = \{.*?\n\};\n\nconst state",'''const LEVEL = {
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

const state''',s,flags=re.S)
# State/restart tweaks
s=s.replace("hp: 20, maxHp: 20, credits: 350, score: 0, kills: 0, wave: 0,","hp: 20, maxHp: 20, credits: 360, score: 0, kills: 0, wave: 0,")
s=s.replace("lastTime: performance.now(), ambientTime: 0, nextEnemyId: 1","lastTime: performance.now(), ambientTime: 0, nextEnemyId: 1, empCooldown: 0")
# robust loader
s=re.sub(r"function loadAssets\(\) \{.*?\n\}",'''function loadAssets() {
  const failures=[];
  return Promise.all(Object.entries(ASSET_PATHS).map(([key,src]) => new Promise((resolve,reject) => {
    const image = new Image();
    image.onload=()=>{img[key]=image;resolve();};
    image.onerror=()=>{failures.push(src);reject(new Error(`Asset failed: ${src}`));};
    image.src=src;
  }))).then(()=>{window.__assetLoadFailures=failures;});
}''',s,flags=re.S)
# resetGame body replace
s=re.sub(r"function resetGame\(\) \{.*?\n\}",'''function resetGame() {
  Object.assign(state,{running:true,paused:false,speed:1,hp:20,maxHp:20,credits:360,score:0,kills:0,wave:0,selectedBuild:'rail',selectedTower:null,drag:null,towers:[],enemies:[],projectiles:[],particles:[],fx:[],floating:[],beams:[],spawnQueue:[],spawnTimer:0,waveActive:false,buildPhase:true,screenShake:0,flash:0,resonance:{frost:0,energy:0,arcane:0},mods:{damage:{rail:1,cryo:1,plasma:1,arcane:1},range:1,cryoSlow:1,plasmaSplash:1,arcaneChain:0,coreRegen:0},lastTime:performance.now(),nextEnemyId:1,empCooldown:0});
  recomputeResonance(); updateUI(); selectBuild('rail'); drawMinimap();
}''',s,flags=re.S)
# Boss wave condition
s=s.replace("if(state.wave===5||state.wave===10) showBossBanner();","if(state.wave===5) showBossBanner();")
# finishWave replace
s=re.sub(r"function finishWave\(\) \{.*?\n\}",'''function finishWave() {
  state.waveActive=false; state.buildPhase=true;
  const reward=48+state.wave*12; state.credits += reward;
  const heal=1+state.mods.coreRegen; state.hp=Math.min(state.maxHp,state.hp+heal);
  state.score += state.wave*300;
  showToast(`WAVE ${state.wave} CLEAR  +${reward} CREDITS  +${heal} CORE`);
  burstAt(1490,515,'#5eeaff',24,140);
  audioTone(540,.12,'triangle',.045,260);
  if(state.wave>=LEVEL.waves){setTimeout(()=>endGame(true),850);} else {setTimeout(showProtocolChoices,450);}
  updateUI();
}''',s,flags=re.S)
# protocols English
s=re.sub(r"const PROTOCOL_POOL=\[.*?\n\];",'''const PROTOCOL_POOL=[
  {icon:'➶',name:'PIERCING RAILS',desc:'Railgun damage +20%',color:'#5ce9ff',apply:()=>state.mods.damage.rail*=1.2},
  {icon:'❄',name:'ABSOLUTE ZERO',desc:'Cryo slow strength +18%',color:'#8abfff',apply:()=>state.mods.cryoSlow*=1.18},
  {icon:'●',name:'FUSION WARHEAD',desc:'Plasma blast radius +20%',color:'#ff9b37',apply:()=>state.mods.plasmaSplash*=1.2},
  {icon:'△',name:'ARCANE SPLIT',desc:'Arcane chains to +1 target',color:'#df69ff',apply:()=>state.mods.arcaneChain++},
  {icon:'◎',name:'LONGSIGHT ARRAY',desc:'All tower range +10%',color:'#83f4e0',apply:()=>state.mods.range*=1.1},
  {icon:'✚',name:'NANO REPAIR',desc:'Restore +1 extra core each wave',color:'#75ffa3',apply:()=>state.mods.coreRegen++},
  {icon:'ϟ',name:'GLOBAL AMPLIFIER',desc:'All tower damage +10%',color:'#ffe171',apply:()=>Object.keys(state.mods.damage).forEach(k=>state.mods.damage[k]*=1.1)},
  {icon:'⬡',name:'ENERGY SALVAGE',desc:'Gain 90 credits now',color:'#ffd35f',apply:()=>state.credits+=90}
];''',s,flags=re.S)
s=s.replace("showToast(`战术协议已加载：${c.name}`)","showToast(`PROTOCOL LOADED: ${c.name}`)")
# end game English
s=s.replace("ui.resultTitle.textContent=win?'霓虹下城区已守住':'能量核心失守';","ui.resultTitle.textContent=win?'LOWER DISTRICT SECURED':'CORE COLLAPSED';")
# Add EMP functions before update
marker="function update(dt) {"
emp='''function useEMP() {
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

'''
s=s.replace(marker,emp+marker)
# update function with cooldown
s=s.replace("dt*=state.speed;state.ambientTime+=dt;updateSpawning(dt);", "dt*=state.speed;state.ambientTime+=dt;state.empCooldown=Math.max(0,state.empCooldown-dt);updateSpawning(dt);")
# background and draw path widths
s=s.replace("function drawBackground() {ctx.drawImage(img.background,0,0,DESIGN.w,DESIGN.h);}","function drawBackground(){ctx.drawImage(img.background,0,0,img.background.width,img.background.height,0,0,DESIGN.w,DESIGN.h);const g=ctx.createRadialGradient(800,430,180,800,430,850);g.addColorStop(0,'rgba(18,45,72,.04)');g.addColorStop(1,'rgba(0,0,0,.48)');ctx.fillStyle=g;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);}")
s=s.replace("ctx.lineWidth=84","ctx.lineWidth=64").replace("ctx.lineWidth=45","ctx.lineWidth=36").replace("ctx.lineWidth=32","ctx.lineWidth=28").replace("ctx.lineWidth=22","ctx.lineWidth=18")
# core function
s=re.sub(r"function drawCore\(\)\{.*?\}\n\nfunction drawSlots",'''function drawCore(){const p=LEVEL.path.at(-1),pulse=1+Math.sin(state.ambientTime*2.6)*.035;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor='#c75cff';ctx.shadowBlur=34;ctx.globalAlpha=.98;ctx.drawImage(img.core,-95,-115,190,190);ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(105,232,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,42,66,23,0,0,Math.PI*2);ctx.stroke();ctx.restore();}

function drawSlots''',s,flags=re.S)
# slot size
s=s.replace("polygon(0,0,50,8)","polygon(0,0,44,8)").replace("polygon(0,0,38,8)","polygon(0,0,33,8)")
# draw tower scale
s=s.replace("baseScale=.42+.025*(t.level-1)","baseScale=.31+.018*(t.level-1)")
s=s.replace("-210*baseScale,-245*baseScale-recoil,420*baseScale,420*baseScale","-210*baseScale,-225*baseScale-recoil,420*baseScale,420*baseScale")
# enemy draw function replace just scale and drawImage line
s=s.replace("const p=pathPoint(e.progress), bob=Math.sin(e.bob)*3, scale=(e.def.boss?.38:e.type==='brute'||e.type==='shield'?.29:e.type==='runner'?.24:.22)*e.spawnScale;","const p=pathPoint(e.progress), bob=Math.sin(e.bob)*3, scale=(e.def.boss?.32:e.type==='brute'||e.type==='shield'?.26:e.type==='runner'?.23:.21)*e.spawnScale;")
s=s.replace("ctx.drawImage(img[e.def.asset],-180*scale,-200*scale,360*scale,360*scale);","const sourceSize=e.def.boss?500:360;ctx.drawImage(img[e.def.asset],-sourceSize*scale/2,-sourceSize*scale*.56,sourceSize*scale,sourceSize*scale);")
# minimap denominator and update UI translations/EMP
s=s.replace("p.y/760*h","p.y/760*h")
s=s.replace("ui.waveSub.textContent=`敌人剩余：${state.enemies.length+state.spawnQueue.length}`","ui.waveSub.textContent=`HOSTILES ${state.enemies.length+state.spawnQueue.length}`")
s=s.replace("ui.startWaveSub.textContent='战斗进行中'","ui.startWaveSub.textContent='IN COMBAT'")
s=s.replace("ui.waveSub.textContent=state.wave>=LEVEL.waves?'区域已清除':'部署防线'","ui.waveSub.textContent=state.wave>=LEVEL.waves?'DISTRICT SECURED':'BUILD PHASE'")
s=s.replace("ui.startWaveSub.textContent=state.wave>=LEVEL.waves?'已完成':`第 ${state.wave+1} 波`","ui.startWaveSub.textContent=state.wave>=LEVEL.waves?'COMPLETE':`WAVE ${state.wave+1}`")
insert="ui.speed.querySelector('span').textContent=`×${state.speed}`;ui.pause.textContent=state.paused?'▶':'Ⅱ';"
s=s.replace(insert,insert+"if(ui.emp){ui.emp.disabled=state.empCooldown>0||!state.enemies.length;ui.empText.textContent=state.empCooldown>0?`${Math.ceil(state.empCooldown)}s`:(state.enemies.length?'READY':'STANDBY');}")
# Inspector English labels/tips
s=s.replace("ui.inspectALabel.textContent='攻击';ui.inspectBLabel.textContent='射速';ui.inspectCLabel.textContent='射程';ui.inspectDLabel.textContent='击毁';","ui.inspectALabel.textContent='DAMAGE';ui.inspectBLabel.textContent='RATE';ui.inspectCLabel.textContent='RANGE';ui.inspectDLabel.textContent='KILLS';")
s=s.replace("ui.inspectTip.textContent=`${p.desc}。累计造成 ${Math.round(t.totalDamage)} 点伤害。`;","ui.inspectTip.textContent=`${p.desc}. ${Math.round(t.totalDamage)} total damage.`;")
start=s.index('function showCoreInspector()')
end=s.index('\nfunction showToast', start)
core_fn="function showCoreInspector(){ui.inspectName.textContent='BASTION CORE';ui.inspectImage.src=ASSET_PATHS.core;ui.inspectALabel.textContent='ARMOR';ui.inspectBLabel.textContent='REPAIR';ui.inspectCLabel.textContent='STATUS';ui.inspectDLabel.textContent='THREAT';ui.inspectA.textContent=`${Math.max(0,state.hp)} / ${state.maxHp}`;ui.inspectB.textContent=`+${1+state.mods.coreRegen} / wave`;ui.inspectC.textContent=state.hp>10?'STABLE':state.hp>5?'WARNING':'CRITICAL';ui.inspectD.textContent=state.wave<3?'LOW':state.wave<5?'HIGH':'BOSS';ui.inspectTip.textContent='Protect the core and keep the route locked down.';ui.towerActions.classList.add('hidden');}"
s=s[:start]+core_fn+s[end:]
# Toast strings select/build etc basic replacements
repls={
"能源币不足":"NOT ENOUGH CREDITS","塔位已占用":"NODE OCCUPIED","炮塔上限已达":"TOWER LIMIT REACHED","合成成功：":"MERGED: ","移动完成":"TOWER RELOCATED","升级成功":"UPGRADE COMPLETE","出售获得":"SALVAGED","战斗暂停":"PAUSED","战斗继续":"RESUMED","选择塔卡，然后点击发光塔位部署":"SELECT A TOWER, THEN CLICK A GLOWING NODE"
}
for a,b in repls.items(): s=s.replace(a,b)
# event EMP
s=s.replace("ui.startWave.addEventListener('click',startWave);","ui.startWave.addEventListener('click',startWave);\nui.emp?.addEventListener('click',useEMP);")
# QA/test init replace final loadAssets block
s=re.sub(r"loadAssets\(\)\.then\(\(\)=>\{state.ready=true;drawMinimap\(\);showCoreInspector\(\);updateUI\(\);requestAnimationFrame\(loop\);\}\)\.catch\(err=>\{.*?\}\);",'''loadAssets().then(()=>{
  state.ready=true;drawMinimap();showCoreInspector();updateUI();requestAnimationFrame(loop);
  window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img};
  const qa=new URLSearchParams(location.search).get('qa');
  if(qa){
    ui.intro.classList.add('hidden');resetGame();
    if(['built','battle','protocol','result'].includes(qa)){
      buildTower('rail',0);buildTower('cryo',1);buildTower('plasma',5);buildTower('arcane',7);
    }
    if(qa==='battle'){startWave();state.speed=2;}
    if(qa==='protocol'){showProtocolChoices();}
    if(qa==='result'){state.wave=5;state.score=6840;state.kills=74;endGame(true);}
  }
}).catch(err=>{console.error(err);document.body.innerHTML=`<div style="padding:30px;color:white;font:16px system-ui">${err.message}</div>`;});''',s,flags=re.S)
p.write_text(s)
