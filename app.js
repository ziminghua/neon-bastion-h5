(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (id) => document.getElementById(id);
  const W = 1600;
  const H = 900;
  const TAU = Math.PI * 2;

  const ui = {
    hp: $('hpText'), credits: $('creditsText'), wave: $('waveText'), best: $('bestText'),
    speed: $('speedBtn'), pause: $('pauseBtn'), sound: $('soundBtn'), start: $('startWaveBtn'), startLabel: $('startWaveLabel'),
    emp: $('empBtn'), empText: $('empText'), toast: $('toast'), intro: $('intro'), protocol: $('protocolModal'),
    protocolChoices: $('protocolChoices'), result: $('resultModal'), resultEyebrow: $('resultEyebrow'), resultTitle: $('resultTitle'),
    resultScore: $('resultScore'), resultWave: $('resultWave'), resultHp: $('resultHp'), resultKills: $('resultKills'),
    inspector: $('inspector'), inspectName: $('inspectName'), inspectDesc: $('inspectDesc'), inspectDamage: $('inspectDamage'),
    inspectRange: $('inspectRange'), inspectLevel: $('inspectLevel'), inspectKills: $('inspectKills'), upgrade: $('upgradeBtn'),
    upgradeCost: $('upgradeCost'), sell: $('sellBtn'), sellValue: $('sellValue'), waveBanner: $('waveBanner'), waveBannerText: $('waveBannerText')
  };

  const TOWERS = {
    rail: { name: '轨道箭塔', desc: '高速单体输出', cost: 100, damage: 13, interval: .43, range: 190, color: '#52e9ff', projectile: 'beam' },
    cryo: { name: '寒冰塔', desc: '减速与冻结控制', cost: 120, damage: 7, interval: .82, range: 172, color: '#9fc4ff', projectile: 'cryo', slow: .36 },
    plasma: { name: '等离子炮塔', desc: '高伤范围爆破', cost: 150, damage: 24, interval: 1.12, range: 165, color: '#ff9b52', projectile: 'plasma', splash: 72 },
    arcane: { name: '奥术塔', desc: '远程连锁穿透', cost: 180, damage: 17, interval: .9, range: 205, color: '#d486ff', projectile: 'arcane', chain: 2 }
  };

  const ENEMIES = {
    drone: { hp: 40, speed: 88, reward: 12, radius: 15, color: '#56e6ff' },
    runner: { hp: 28, speed: 134, reward: 14, radius: 13, color: '#f45fe8' },
    brute: { hp: 112, speed: 55, reward: 24, radius: 21, color: '#ff725c', armor: .16 },
    shield: { hp: 120, speed: 49, reward: 28, radius: 20, color: '#ffc25c', shield: 55 },
    boss: { hp: 980, speed: 34, reward: 170, radius: 34, color: '#b676ff', armor: .2, boss: true }
  };

  const path = [
    {x:70,y:540},{x:250,y:540},{x:330,y:445},{x:280,y:325},{x:395,y:230},
    {x:650,y:220},{x:850,y:250},{x:1055,y:340},{x:1128,y:475},{x:1080,y:610},
    {x:1190,y:690},{x:1400,y:650},{x:1532,y:510}
  ];
  const pads = [
    {x:360,y:390},{x:535,y:350},{x:720,y:365},{x:900,y:405},
    {x:460,y:550},{x:650,y:585},{x:850,y:575},{x:1050,y:530},{x:1210,y:480}
  ];
  const waves = [
    [{type:'drone',count:9,gap:.58}],
    [{type:'runner',count:10,gap:.42},{type:'drone',count:7,gap:.44}],
    [{type:'brute',count:6,gap:.8},{type:'runner',count:12,gap:.32}],
    [{type:'shield',count:7,gap:.7},{type:'drone',count:14,gap:.3}],
    [{type:'runner',count:14,gap:.26},{type:'brute',count:8,gap:.48},{type:'boss',count:1,gap:1.1}]
  ];

  const metrics = (() => {
    let total = 0;
    const segments = [];
    for (let i=0;i<path.length-1;i++) {
      const a=path[i], b=path[i+1], len=Math.hypot(b.x-a.x,b.y-a.y);
      segments.push({a,b,len,start:total}); total+=len;
    }
    return {segments,total};
  })();

  const state = {
    running: false, paused: false, ready: true, sound: true, speed: 1,
    hp: 20, maxHp: 20, credits: 320, score: 0, kills: 0, wave: 0,
    selectedBuild: 'rail', selectedTower: null, hoverPad: -1,
    towers: [], enemies: [], projectiles: [], particles: [], beams: [], rings: [], floating: [],
    spawnQueue: [], spawnTime: 0, waveActive: false, buildPhase: true,
    ambient: 0, flash: 0, shake: 0, last: performance.now(), enemyId: 1,
    empCooldown: 0, protocolLevel: 0,
    mods: { railPierce: 0, cryoShatter: 0, plasmaBurn: 0, arcaneBounce: 0, globalDamage: 1, income: 1, coreRegen: 0 }
  };

  let audio = null;
  const storage = {
    get(key, fallback='0') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch {} }
  };
  const savedBest = Number(storage.get('neonBastionBest', '0'));
  ui.best.textContent = String(savedBest);

  function tone(freq=440, duration=.06, type='sine', gain=.025, slide=0) {
    if (!state.sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc=audio.createOscillator(), g=audio.createGain();
      osc.type=type; osc.frequency.setValueAtTime(freq,audio.currentTime);
      if(slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),audio.currentTime+duration);
      g.gain.setValueAtTime(gain,audio.currentTime); g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);
      osc.connect(g).connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration);
    } catch {}
  }

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const rand=(a,b)=>a+Math.random()*(b-a);

  function pointAt(progress) {
    const d=clamp(progress,0,1)*metrics.total;
    let s=metrics.segments.at(-1);
    for(const seg of metrics.segments){if(d<=seg.start+seg.len){s=seg;break;}}
    const t=clamp((d-s.start)/s.len,0,1);
    return {x:lerp(s.a.x,s.b.x,t),y:lerp(s.a.y,s.b.y,t),angle:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x)};
  }

  function resetGame() {
    Object.assign(state, {
      running:true, paused:false, speed:1, hp:20, maxHp:20, credits:320, score:0, kills:0, wave:0,
      selectedBuild:'rail', selectedTower:null, hoverPad:-1, towers:[], enemies:[], projectiles:[], particles:[], beams:[], rings:[], floating:[],
      spawnQueue:[], spawnTime:0, waveActive:false, buildPhase:true, ambient:0, flash:0, shake:0, last:performance.now(), enemyId:1,
      empCooldown:0, protocolLevel:0,
      mods:{railPierce:0,cryoShatter:0,plasmaBurn:0,arcaneBounce:0,globalDamage:1,income:1,coreRegen:0}
    });
    selectBuild('rail'); updateUI();
  }

  function createEnemy(type, scale=1) {
    const def=ENEMIES[type];
    return { id:state.enemyId++, type, def, progress:0, hp:def.hp*scale, maxHp:def.hp*scale, shield:(def.shield||0)*scale,
      maxShield:(def.shield||0)*scale, slow:0, slowFactor:1, frozen:0, dead:false, alpha:0, scale:.2, hit:0, burn:0 };
  }
  function createTower(type,pad,level=1) { return {type,def:TOWERS[type],pad,level,cooldown:rand(0,.15),kills:0,totalDamage:0,flash:0}; }

  function showToast(text) {
    ui.toast.textContent=text; ui.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>ui.toast.classList.remove('show'),1700);
  }

  function selectBuild(type) {
    state.selectedBuild=type; state.selectedTower=null; ui.inspector.classList.add('hidden');
    document.querySelectorAll('.tower-card').forEach(b=>b.classList.toggle('selected',b.dataset.type===type));
  }

  function towerAtPad(index){return state.towers.find(t=>t.pad===index)||null;}
  function padAt(x,y,limit=44){let best=-1,bd=limit; pads.forEach((p,i)=>{const d=Math.hypot(p.x-x,p.y-y);if(d<bd){bd=d;best=i;}});return best;}

  function buildTower(type,pad) {
    const def=TOWERS[type];
    if(towerAtPad(pad)){showToast('该节点已部署炮塔');return;}
    if(state.credits<def.cost){showToast('能源不足');tone(90,.08,'square',.02,-30);return;}
    state.credits-=def.cost; const t=createTower(type,pad); state.towers.push(t); state.selectedTower=t; state.selectedBuild=null;
    burst(pads[pad].x,pads[pad].y,def.color,34,130); ring(pads[pad].x,pads[pad].y,def.color,18,58,.35); tone(380,.08,'triangle',.035,220);
    showInspector(t); updateUI();
  }

  function showInspector(t) {
    if(!t)return; state.selectedTower=t; state.selectedBuild=null;
    document.querySelectorAll('.tower-card').forEach(b=>b.classList.remove('selected'));
    const dmg=Math.round(t.def.damage*Math.pow(1.58,t.level-1)*state.mods.globalDamage);
    ui.inspectName.textContent=`${t.def.name} · Lv.${t.level}`; ui.inspectDesc.textContent=t.def.desc;
    ui.inspectDamage.textContent=dmg; ui.inspectRange.textContent=Math.round(t.def.range*(1+.07*(t.level-1)));
    ui.inspectLevel.textContent=t.level; ui.inspectKills.textContent=t.kills;
    const cost=Math.round(t.def.cost*(.62+t.level*.62)); ui.upgradeCost.textContent=cost;
    ui.sellValue.textContent=Math.round(t.def.cost*(.48+.16*(t.level-1)));
    ui.inspector.classList.remove('hidden');
  }

  function upgradeTower() {
    const t=state.selectedTower;if(!t)return;const cost=Math.round(t.def.cost*(.62+t.level*.62));
    if(state.credits<cost){showToast('能源不足');return;}
    state.credits-=cost;t.level++;burst(pads[t.pad].x,pads[t.pad].y,t.def.color,42,155);ring(pads[t.pad].x,pads[t.pad].y,t.def.color,24,78,.45);tone(520,.11,'triangle',.045,360);showInspector(t);updateUI();
  }
  function sellTower() {
    const t=state.selectedTower;if(!t)return;const value=Math.round(t.def.cost*(.48+.16*(t.level-1)));state.credits+=value;
    state.towers=state.towers.filter(x=>x!==t);state.selectedTower=null;ui.inspector.classList.add('hidden');showToast(`回收 ${value} 能源`);updateUI();
  }

  function startWave() {
    if(!state.running||state.waveActive||state.wave>=waves.length)return;
    state.wave++;state.waveActive=true;state.buildPhase=false;state.spawnQueue=[];state.spawnTime=0;
    const scale=1+(state.wave-1)*.23;let at=.2;
    for(const g of waves[state.wave-1]){for(let i=0;i<g.count;i++){state.spawnQueue.push({type:g.type,at,scale});at+=g.gap;}at+=.65;}
    ui.waveBannerText.textContent=`WAVE ${state.wave}`;ui.waveBanner.classList.remove('hidden');setTimeout(()=>ui.waveBanner.classList.add('hidden'),1750);
    tone(170,.16,'sawtooth',.03,180);updateUI();
  }

  function finishWave() {
    state.waveActive=false;state.buildPhase=true;const reward=Math.round((46+state.wave*12)*state.mods.income);state.credits+=reward;
    const heal=1+state.mods.coreRegen;state.hp=Math.min(state.maxHp,state.hp+heal);state.score+=state.wave*280;
    showToast(`波次清除 · +${reward} 能源 · 核心 +${heal}`);tone(560,.11,'triangle',.035,260);
    if(state.wave>=waves.length){setTimeout(()=>endGame(true),700);} else {setTimeout(showProtocols,500);} updateUI();
  }

  const protocols=[
    {icon:'⌁',name:'穿透弹道',desc:'轨道攻击可穿透额外目标',color:'#52e9ff',apply:()=>state.mods.railPierce++},
    {icon:'❄',name:'碎冰反应',desc:'冻结单位死亡时造成范围伤害',color:'#9fc4ff',apply:()=>state.mods.cryoShatter++},
    {icon:'●',name:'熔融地带',desc:'等离子爆炸留下灼烧效果',color:'#ff9b52',apply:()=>state.mods.plasmaBurn++},
    {icon:'△',name:'奥术回路',desc:'奥术连锁增加 1 个目标',color:'#d486ff',apply:()=>state.mods.arcaneBounce++},
    {icon:'ϟ',name:'全域增幅',desc:'所有炮塔伤害提升 12%',color:'#f3d878',apply:()=>state.mods.globalDamage*=1.12},
    {icon:'⬡',name:'能源回收',desc:'波次奖励提升 25%',color:'#5df0a7',apply:()=>state.mods.income*=1.25},
    {icon:'✚',name:'纳米修复',desc:'每波额外恢复 1 点核心装甲',color:'#5df0a7',apply:()=>state.mods.coreRegen++}
  ];

  function showProtocols() {
    state.paused=true;ui.protocolChoices.innerHTML='';
    const picks=[...protocols].sort(()=>Math.random()-.5).slice(0,3);
    for(const p of picks){const b=document.createElement('button');b.className='protocol-choice';b.style.setProperty('--pc',p.color);b.innerHTML=`<i>${p.icon}</i><b>${p.name}</b><small>${p.desc}</small>`;
      b.onclick=()=>{p.apply();state.protocolLevel++;ui.protocol.classList.add('hidden');state.paused=false;showToast(`已加载：${p.name}`);tone(650,.12,'triangle',.04,300);updateUI();};ui.protocolChoices.appendChild(b);}
    ui.protocol.classList.remove('hidden');
  }

  function endGame(win) {
    state.running=false;state.paused=true;ui.result.classList.remove('hidden');
    ui.resultEyebrow.textContent=win?'MISSION COMPLETE':'CORE COLLAPSED';ui.resultTitle.textContent=win?'核心已守住':'防线已失守';
    const score=Math.round(state.score+state.hp*120+state.kills*14);ui.resultScore.textContent=String(score).padStart(6,'0');
    ui.resultWave.textContent=state.wave;ui.resultHp.textContent=Math.max(0,state.hp);ui.resultKills.textContent=state.kills;
    const best=Math.max(score,Number(storage.get('neonBastionBest','0')));storage.set('neonBastionBest',best);ui.best.textContent=best;
    tone(win?660:100,.45,win?'triangle':'sawtooth',.05,win?420:-50);
  }

  function useEMP() {
    if(state.empCooldown>0||!state.waveActive)return;
    state.empCooldown=20;state.shake=12;state.flash=.22;ring(800,450,'#b676ff',60,860,.55);tone(95,.28,'sawtooth',.05,360);
    for(const e of state.enemies){if(e.dead)continue;applyDamage(e,e.maxHp*.18,null,'emp');e.slow=3;e.slowFactor=.35;}
    showToast('EMP 脉冲已释放');updateUI();
  }

  function applyDamage(e,amount,tower,kind='rail') {
    if(e.dead)return;let dmg=amount*(1-(e.def.armor||0));
    if(e.shield>0){const a=Math.min(e.shield,dmg);e.shield-=a;dmg-=a;}
    if(dmg>0){e.hp-=dmg;e.hit=.11;if(tower)tower.totalDamage+=dmg;floating(pointAt(e.progress).x+rand(-6,6),pointAt(e.progress).y-28,Math.round(dmg),kind==='plasma'?'#ffc47a':kind==='arcane'?'#e2a8ff':'#dffbff');}
    if(e.hp<=0)killEnemy(e,tower,kind);
  }

  function killEnemy(e,tower,kind) {
    if(e.dead)return;e.dead=true;state.kills++;state.credits+=Math.round(e.def.reward*state.mods.income);state.score+=Math.round(e.maxHp*(e.def.boss?4:1.15));if(tower)tower.kills++;
    const p=pointAt(e.progress);burst(p.x,p.y,e.def.color,e.def.boss?68:18,e.def.boss?220:110);ring(p.x,p.y,e.def.color,8,e.def.boss?110:42,e.def.boss?.5:.22);
    if(state.mods.cryoShatter&&e.frozen>0){for(const q of state.enemies){if(!q.dead&&dist(p,pointAt(q.progress))<80)applyDamage(q,22*state.mods.cryoShatter,tower,'cryo');}}
    if(e.def.boss){state.shake=18;state.flash=.25;tone(80,.3,'sawtooth',.06,-30);} else tone(300,.035,'triangle',.012,70);
  }

  function fire(t,target) {
    const a=pads[t.pad], b=pointAt(target.progress), def=t.def, dmg=def.damage*Math.pow(1.58,t.level-1)*state.mods.globalDamage;
    t.flash=1;
    if(def.projectile==='beam'){
      state.beams.push({x1:a.x,y1:a.y-12,x2:b.x,y2:b.y,color:def.color,life:.08,max:.08,width:3});applyDamage(target,dmg,t,'rail');
      if(state.mods.railPierce){const next=state.enemies.filter(e=>!e.dead&&e!==target&&Math.abs(e.progress-target.progress)<.08).sort((x,y)=>y.progress-x.progress)[0];if(next)applyDamage(next,dmg*.55,t,'rail');}
      tone(740,.028,'square',.012,-180);
    } else {state.projectiles.push({type:def.projectile,x:a.x,y:a.y-14,target,damage:dmg,speed:def.projectile==='plasma'?440:610,color:def.color,tower:t});tone(def.projectile==='plasma'?170:420,.045,'sine',.014,70);}
  }

  function updateProjectiles(dt) {
    for(const p of state.projectiles){if(!p.target||p.target.dead){p.dead=true;continue;}const tp=pointAt(p.target.progress);const dx=tp.x-p.x,dy=tp.y-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;
      if(d<=step+7){applyDamage(p.target,p.damage,p.tower,p.type);if(p.type==='cryo'){p.target.slow=1.8;p.target.slowFactor=.58;p.target.frozen=1.8;ring(tp.x,tp.y,'#9fc4ff',4,34,.22);}if(p.type==='plasma'){ring(tp.x,tp.y,'#ff9b52',8,74,.28);for(const e of state.enemies){if(!e.dead&&dist(tp,pointAt(e.progress))<=p.tower.def.splash)applyDamage(e,p.damage*.52,p.tower,'plasma');}if(state.mods.plasmaBurn){for(const e of state.enemies){if(!e.dead&&dist(tp,pointAt(e.progress))<=p.tower.def.splash)e.burn=Math.max(e.burn,2.4);}}}if(p.type==='arcane'){let from=tp;const qs=state.enemies.filter(e=>!e.dead&&e!==p.target&&dist(tp,pointAt(e.progress))<150).sort((x,y)=>dist(tp,pointAt(x.progress))-dist(tp,pointAt(y.progress))).slice(0,p.tower.def.chain+state.mods.arcaneBounce);qs.forEach((e,i)=>{const q=pointAt(e.progress);state.beams.push({x1:from.x,y1:from.y,x2:q.x,y2:q.y,color:'#d486ff',life:.14,max:.14,width:2});applyDamage(e,p.damage*(.62-i*.08),p.tower,'arcane');from=q;});}p.dead=true;
      } else {p.x+=dx/d*step;p.y+=dy/d*step;}
    }state.projectiles=state.projectiles.filter(p=>!p.dead);
  }

  function update(dt) {
    if(!state.running||state.paused)return;dt*=state.speed;state.ambient+=dt;state.flash=Math.max(0,state.flash-dt);state.shake=Math.max(0,state.shake-dt*30);state.empCooldown=Math.max(0,state.empCooldown-dt);
    if(state.waveActive){state.spawnTime+=dt;while(state.spawnQueue.length&&state.spawnQueue[0].at<=state.spawnTime){const d=state.spawnQueue.shift();state.enemies.push(createEnemy(d.type,d.scale));}}
    for(const e of state.enemies){e.alpha=Math.min(1,e.alpha+dt*5);e.scale=Math.min(1,e.scale+dt*5);e.hit=Math.max(0,e.hit-dt);if(e.slow>0){e.slow-=dt;if(e.slow<=0)e.slowFactor=1;}if(e.frozen>0)e.frozen-=dt;if(e.burn>0){e.burn-=dt;applyDamage(e,7*dt,null,'plasma');}
      e.progress+=(e.def.speed*e.slowFactor*dt)/metrics.total;if(e.progress>=1&&!e.dead){e.dead=true;const damage=e.def.boss?7:e.type==='brute'||e.type==='shield'?2:1;state.hp-=damage;state.shake=12;state.flash=.22;burst(1510,510,'#ff5d78',28,160);floating(1450,455,`核心 -${damage}`,'#ff7188');tone(110,.15,'sawtooth',.04,-45);if(state.hp<=0){endGame(false);break;}}}
    state.enemies=state.enemies.filter(e=>!e.dead);
    for(const t of state.towers){t.cooldown-=dt;t.flash=Math.max(0,t.flash-dt*5);const a=pads[t.pad],range=t.def.range*(1+.07*(t.level-1));const candidates=state.enemies.filter(e=>!e.dead&&dist(a,pointAt(e.progress))<=range);const target=candidates.sort((x,y)=>y.progress-x.progress)[0];if(target&&t.cooldown<=0){fire(t,target);t.cooldown=t.def.interval/(1+.14*(t.level-1));}}
    updateProjectiles(dt);
    for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=40*dt;p.life-=dt;}for(const b of state.beams)b.life-=dt;for(const r of state.rings){r.radius=lerp(r.radius,r.target,dt*7);r.life-=dt;}for(const f of state.floating){f.y-=28*dt;f.life-=dt;}
    state.particles=state.particles.filter(p=>p.life>0);state.beams=state.beams.filter(b=>b.life>0);state.rings=state.rings.filter(r=>r.life>0);state.floating=state.floating.filter(f=>f.life>0);
    if(state.waveActive&&!state.spawnQueue.length&&!state.enemies.length)finishWave();updateUI();
  }

  function burst(x,y,color,count=18,speed=110){for(let i=0;i<count;i++){const a=Math.random()*TAU,v=rand(speed*.35,speed);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.22,.48),max:.48,size:rand(1.5,3.5),color});}}
  function ring(x,y,color,radius,target,life){state.rings.push({x,y,color,radius,target,life,max:life});}
  function floating(x,y,text,color){state.floating.push({x,y,text:String(text),color,life:.65,max:.65});}

  function strokePath(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
  function drawBackground() {
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#071020');g.addColorStop(.55,'#060b16');g.addColorStop(1,'#02050b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.55;for(let i=0;i<36;i++){const x=(i*97)%W,h=70+(i*53)%180,w=42+(i*29)%70;ctx.fillStyle=i%3===0?'#0d1d34':'#091526';ctx.fillRect(x,H-130-h,w,h);ctx.fillStyle='rgba(82,233,255,.08)';for(let y=H-120-h;y<H-145;y+=26){for(let xx=x+10;xx<x+w-8;xx+=18){if((xx+y+i)%4<2)ctx.fillRect(xx,y,5,2);}}}
    ctx.restore();
    ctx.save();ctx.strokeStyle='rgba(73,128,170,.08)';ctx.lineWidth=1;for(let x=-600;x<W+600;x+=70){ctx.beginPath();ctx.moveTo(W/2,H*.33);ctx.lineTo(x,H);ctx.stroke();}for(let y=H*.44;y<H;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.restore();
    const glow=ctx.createRadialGradient(1470,510,20,1470,510,210);glow.addColorStop(0,'rgba(82,233,255,.15)');glow.addColorStop(1,'rgba(82,233,255,0)');ctx.fillStyle=glow;ctx.fillRect(1260,300,340,420);
  }
  function drawRoute(){ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowBlur=24;ctx.shadowColor='#b65cff';ctx.strokeStyle='rgba(177,78,255,.17)';ctx.lineWidth=54;strokePath(path);ctx.shadowBlur=12;ctx.shadowColor='#f45fe8';ctx.strokeStyle='rgba(236,85,225,.55)';ctx.lineWidth=28;strokePath(path);ctx.shadowBlur=0;ctx.strokeStyle='#10192e';ctx.lineWidth=20;strokePath(path);ctx.strokeStyle='rgba(143,216,255,.72)';ctx.lineWidth=2;ctx.setLineDash([10,13]);strokePath(path);ctx.setLineDash([]);ctx.restore();for(let i=0;i<9;i++){const p=pointAt((state.ambient*.045+i/9)%1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='rgba(181,235,255,.78)';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,-5);ctx.lineTo(-1,0);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.restore();}}
  function drawCore(){ctx.save();ctx.translate(1510,510);const pulse=1+Math.sin(state.ambient*3)*.035;ctx.scale(pulse,pulse);ctx.strokeStyle='rgba(82,233,255,.8)';ctx.lineWidth=3;ctx.shadowColor='#52e9ff';ctx.shadowBlur=22;ctx.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*TAU/8,x=Math.cos(a)*62,y=Math.sin(a)*62;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();ctx.fillStyle='rgba(82,233,255,.09)';ctx.fill();ctx.rotate(-state.ambient*.35);ctx.strokeStyle='rgba(212,134,255,.8)';ctx.beginPath();ctx.arc(0,0,38,0,TAU);ctx.stroke();ctx.fillStyle='#e8fbff';ctx.shadowBlur=30;ctx.beginPath();ctx.arc(0,0,12,0,TAU);ctx.fill();ctx.restore();}
  function drawPads(){pads.forEach((p,i)=>{const t=towerAtPad(i),hover=i===state.hoverPad,sel=t&&t===state.selectedTower;ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=t?t.def.color:'#52e9ff';ctx.shadowBlur=hover||sel?22:10;ctx.fillStyle=t?'rgba(7,17,32,.92)':'rgba(7,17,32,.72)';ctx.strokeStyle=t?t.def.color:hover?'#8ff7ff':'rgba(82,233,255,.48)';ctx.lineWidth=hover||sel?3:2;ctx.beginPath();for(let k=0;k<8;k++){const a=Math.PI/8+k*TAU/8,x=Math.cos(a)*37,y=Math.sin(a)*37;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;if(!t){ctx.strokeStyle='rgba(82,233,255,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(9,0);ctx.moveTo(0,-9);ctx.lineTo(0,9);ctx.stroke();}ctx.restore();});}
  function drawTower(t){const p=pads[t.pad],c=t.def.color,level=t.level;ctx.save();ctx.translate(p.x,p.y);if(t===state.selectedTower){const range=t.def.range*(1+.07*(level-1));ctx.strokeStyle=rgba(c,.36);ctx.fillStyle=rgba(c,.035);ctx.setLineDash([7,9]);ctx.beginPath();ctx.arc(0,0,range,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash([]);}ctx.shadowColor=c;ctx.shadowBlur=16+t.flash*12;ctx.fillStyle='#081322';ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,24,0,TAU);ctx.fill();ctx.stroke();ctx.rotate(state.ambient*(t.type==='arcane'?.7:.22));ctx.strokeStyle=rgba(c,.72);ctx.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.moveTo(Math.cos(a)*10,Math.sin(a)*10);ctx.lineTo(Math.cos(a)*29,Math.sin(a)*29);}ctx.stroke();ctx.rotate(-state.ambient*(t.type==='arcane'?.7:.22));ctx.fillStyle=c;if(t.type==='rail')ctx.fillRect(-5,-20,10,28);else if(t.type==='cryo'){ctx.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6,x=Math.cos(a)*12,y=Math.sin(a)*12;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();}else if(t.type==='plasma'){ctx.beginPath();ctx.arc(0,0,12,0,TAU);ctx.fill();}else{ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(13,12);ctx.lineTo(-13,12);ctx.closePath();ctx.fill();}ctx.shadowBlur=0;ctx.fillStyle='rgba(3,8,16,.92)';ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(18,17,30,19,7);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 10px sans-serif';ctx.textAlign='center';ctx.fillText(`L${level}`,33,30);ctx.restore();}
  function drawEnemy(e){const p=pointAt(e.progress),r=e.def.radius*e.scale;ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=e.alpha;ctx.shadowColor=e.def.color;ctx.shadowBlur=e.def.boss?22:11;ctx.fillStyle=e.hit>0?'#fff':e.def.color;ctx.beginPath();if(e.def.boss){for(let i=0;i<8;i++){const a=Math.PI/8+i*TAU/8,x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}else if(e.type==='runner'){ctx.moveTo(r,0);ctx.lineTo(-r*.65,-r*.7);ctx.lineTo(-r*.4,0);ctx.lineTo(-r*.65,r*.7);ctx.closePath();}else{ctx.arc(0,0,r,0,TAU);}ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#09111f';ctx.beginPath();ctx.arc(0,0,r*.45,0,TAU);ctx.fill();if(e.shield>0){ctx.strokeStyle='rgba(255,194,92,.95)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r+7,0,TAU);ctx.stroke();}if(e.slow>0){ctx.strokeStyle='rgba(159,196,255,.9)';ctx.beginPath();ctx.arc(0,0,r+4,0,TAU);ctx.stroke();}ctx.restore();const bw=e.def.boss?92:44,y=p.y-r-12;ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(p.x-bw/2,y,bw,4);ctx.fillStyle=e.def.boss?'#b676ff':'#5df0a7';ctx.fillRect(p.x-bw/2,y,bw*clamp(e.hp/e.maxHp,0,1),4);}
  function drawEffects(){for(const p of state.projectiles){ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=p.color;ctx.shadowBlur=15;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.type==='plasma'?7:4,0,TAU);ctx.fill();ctx.restore();}for(const b of state.beams){ctx.save();ctx.globalAlpha=b.life/b.max;ctx.shadowColor=b.color;ctx.shadowBlur=14;ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.beginPath();ctx.moveTo(b.x1,b.y1);ctx.lineTo(b.x2,b.y2);ctx.stroke();ctx.restore();}for(const r of state.rings){ctx.save();ctx.globalAlpha=clamp(r.life/r.max,0,1);ctx.strokeStyle=r.color;ctx.lineWidth=3;ctx.shadowColor=r.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(r.x,r.y,r.radius,0,TAU);ctx.stroke();ctx.restore();}for(const p of state.particles){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.restore();}for(const f of state.floating){ctx.save();ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.font='800 13px sans-serif';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.restore();}}
  function draw(){ctx.save();if(state.shake>0)ctx.translate(rand(-state.shake,state.shake),rand(-state.shake,state.shake));drawBackground();drawRoute();drawCore();drawPads();state.towers.forEach(drawTower);state.enemies.forEach(drawEnemy);drawEffects();ctx.restore();if(state.flash>0){ctx.fillStyle=`rgba(212,134,255,${state.flash})`;ctx.fillRect(0,0,W,H);}}

  function updateUI(){ui.hp.textContent=Math.max(0,state.hp);ui.credits.textContent=Math.round(state.credits);ui.wave.textContent=state.wave;ui.start.disabled=state.waveActive||!state.running||state.wave>=waves.length;ui.startLabel.textContent=state.wave>=waves.length?'战斗完成':state.waveActive?'敌潮进行中':`开始第 ${state.wave+1} 波`;ui.speed.textContent=`×${state.speed}`;ui.pause.textContent=state.paused?'▶':'Ⅱ';ui.sound.textContent=state.sound?'♪':'×';ui.emp.disabled=state.empCooldown>0||!state.waveActive;ui.empText.textContent=state.empCooldown>0?`${state.empCooldown.toFixed(1)}s`:state.waveActive?'READY':'WAITING';if(state.selectedTower&&!ui.inspector.classList.contains('hidden'))showInspector(state.selectedTower);}

  function canvasPoint(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
  canvas.addEventListener('pointermove',e=>{const p=canvasPoint(e);state.hoverPad=padAt(p.x,p.y);});
  canvas.addEventListener('pointerleave',()=>state.hoverPad=-1);
  canvas.addEventListener('pointerdown',e=>{if(!state.running||state.paused)return;const p=canvasPoint(e),pad=padAt(p.x,p.y);if(pad>=0){const t=towerAtPad(pad);if(t)showInspector(t);else if(state.selectedBuild)buildTower(state.selectedBuild,pad);}});

  document.querySelectorAll('.tower-card').forEach(b=>b.addEventListener('click',()=>selectBuild(b.dataset.type)));
  $('enterBtn').addEventListener('click',()=>{ui.intro.classList.add('hidden');resetGame();tone(420,.1,'triangle',.035,280);});
  $('restartBtn').addEventListener('click',()=>{ui.result.classList.add('hidden');resetGame();});
  ui.start.addEventListener('click',startWave);ui.emp.addEventListener('click',useEMP);ui.upgrade.addEventListener('click',upgradeTower);ui.sell.addEventListener('click',sellTower);
  $('closeInspector').addEventListener('click',()=>{state.selectedTower=null;ui.inspector.classList.add('hidden');});
  ui.speed.addEventListener('click',()=>{state.speed=state.speed===1?2:1;updateUI();});
  ui.pause.addEventListener('click',()=>{if(!state.running)return;state.paused=!state.paused;updateUI();});
  ui.sound.addEventListener('click',()=>{state.sound=!state.sound;updateUI();});
  addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();startWave();}if(e.key.toLowerCase()==='e')useEMP();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running)state.paused=true;updateUI();});

  function frame(now){const dt=Math.min(.033,(now-state.last)/1000||0);state.last=now;update(dt);draw();requestAnimationFrame(frame);} requestAnimationFrame(frame);updateUI();draw();

  window.__NEON_TEST__={state,startWave,useEMP,resetGame,buildTower,version:'2.0.0-visual-rebuild'};
})();
