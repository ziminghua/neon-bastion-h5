import fs from 'node:fs/promises';

const file = new URL('../app.js', import.meta.url);
let source = await fs.readFile(file, 'utf8');
if (source.includes('// PRODUCTION_SCENE_VFX_V1')) {
  console.log('production scene and VFX already materialized');
  process.exit(0);
}

function replaceOnce(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Unable to patch ${label}`);
  source = source.replace(pattern, replacement);
}

const level = `// PRODUCTION_SCENE_VFX_V1
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
};`;
replaceOnce(/\/\/ LEVEL_LAYOUT_OVERHAUL_V1\nconst LEVEL = \{[\s\S]*?\n\};\n\nconst state =/, `${level}\n\nconst state =`, 'level data');

source = source.replace(
  'towers: [], enemies: [], projectiles: [], particles: [], fx: [], floating: [], beams: [],',
  'towers: [], enemies: [], projectiles: [], particles: [], fx: [], floating: [], beams: [], rings: [], runes: [], decals: [],'
);
source = source.replace(
  'towers:[],enemies:[],projectiles:[],particles:[],fx:[],floating:[],beams:[],',
  'towers:[],enemies:[],projectiles:[],particles:[],fx:[],floating:[],beams:[],rings:[],runes:[],decals:[],'
);
source = source.replace(
  'slow:0,slowFactor:1,hit:0,dead:false,bob:Math.random()*Math.PI*2,angle:0,alpha:0,spawnScale:0.2',
  "slow:0,slowFactor:1,frost:0,hit:0,impact:0,impactKind:'rail',dead:false,bob:Math.random()*Math.PI*2,angle:0,alpha:0,spawnScale:0.2"
);
source = source.replace(
  'return { type, def:TOWER_TYPES[type], slot, level, cooldown:rand(0,.15), recoil:0, charge:0, selected:false, kills:0, totalDamage:0, flash:0 };',
  'return { type, def:TOWER_TYPES[type], slot, level, cooldown:rand(0,.15), recoil:0, charge:0, selected:false, kills:0, totalDamage:0, flash:0, muzzle:0, aim:-Math.PI/2 };'
);

replaceOnce(/nextEnemyId: 1, empCooldown: 0\n\};\n\nlet audioCtx = null;/, `nextEnemyId: 1, empCooldown: 0
};

const sceneStyle=document.createElement('style');
sceneStyle.textContent=\`
  .mission-panel,.inspector,.bottom-deck{transition:opacity .28s ease,transform .28s ease,filter .28s ease}
  body.combat-active .mission-panel{opacity:.24;transform:translateX(-15px);filter:saturate(.7)}
  body.combat-active .inspector:not(:hover){opacity:.32;transform:translateX(14px);filter:saturate(.72)}
  body.combat-active .bottom-deck:not(:hover){opacity:.82;transform:translateX(-50%) translateY(5px)}
\`;
document.head.appendChild(sceneStyle);

let audioCtx = null;`, 'scene UI behavior');

replaceOnce(/function fireTower\(tower,target\) \{[\s\S]*?\n\}\n\nfunction applyDamage/, `function fireTower(tower,target) {
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

function applyDamage`, 'tower firing');

replaceOnce(/function applyDamage\(enemy,amount,tower,kind=tower\?\.type\|\|'rail'\) \{[\s\S]*?\n\}\nfunction killEnemy/, `function applyDamage(enemy,amount,tower,kind=tower?.type||'rail') {
  if(enemy.dead)return 0;
  let dmg=amount*(1-(enemy.def.armor||0));
  if(kind==='arcane'&&enemy.def.armor)dmg*=1.25;
  const pos=pathPoint(enemy.progress);enemy.impact=.13;enemy.impactKind=kind;
  if(enemy.shield>0){const absorbed=Math.min(enemy.shield,dmg);enemy.shield-=absorbed;dmg-=absorbed;addRing(pos.x,pos.y,'#ffc25a',18,48,.2,3);spawnSparks(pos.x,pos.y,'#ffd786',10,120);}
  if(dmg>0){enemy.hp-=dmg;enemy.hit=.16;tower&&(tower.totalDamage+=dmg);addFloating(pos.x+rand(-9,9),pos.y-36,Math.round(dmg),kind==='plasma'?'#ffd078':kind==='cryo'?'#c4f7ff':kind==='arcane'?'#f0a2ff':'#fff',kind==='plasma'?19:14);}
  if(enemy.hp<=0&&!enemy.dead)killEnemy(enemy,tower);
  return dmg;
}
function killEnemy`, 'damage feedback');

replaceOnce(/function updateProjectiles\(dt\) \{[\s\S]*?\n\}\n\nfunction updateEnemies/, `function updateProjectiles(dt) {
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

function updateEnemies`, 'projectile impacts');

replaceOnce(/function updateEnemies\(dt\) \{[\s\S]*?\n\}\n\nfunction updateTowers/, `function updateEnemies(dt) {
  for(const e of state.enemies){
    e.alpha=Math.min(1,e.alpha+dt*5);e.spawnScale=Math.min(1,e.spawnScale+dt*5);e.hit=Math.max(0,e.hit-dt);e.impact=Math.max(0,e.impact-dt);e.bob+=dt*(e.type==='runner'?8:4);
    if(e.slow>0){e.slow-=dt;if(e.slow<=0)e.slowFactor=1;}else e.frost=Math.max(0,e.frost-dt*.18);
    const impactDrag=e.impact>0?.58:1;e.progress+=(e.def.speed*e.slowFactor*impactDrag*dt)/pathInfo.total;
    const p=pathPoint(e.progress);e.angle=p.angle;
    if(e.progress>=1){e.dead=true;const damage=e.def.boss?6:e.type==='brute'||e.type==='shield'?2:1;state.hp-=damage;state.screenShake=12;state.flash=.24;const core=LEVEL.path.at(-1);burstAt(core.x,core.y,'#ff496f',40,190);addFloating(core.x-28,core.y-70,\`CORE -\${damage}\`,'#ff6577',24);audioTone(110,.18,'sawtooth',.055,-50);if(state.hp<=0)endGame(false);}
  }
  state.enemies=state.enemies.filter(e=>!e.dead);
}

function updateTowers`, 'enemy feedback');

replaceOnce(/function updateTowers\(dt\) \{[\s\S]*?\n\}\n\nfunction spawnSparks/, `function updateTowers(dt) {
  for(const t of state.towers){
    t.cooldown-=dt;t.recoil=Math.max(0,t.recoil-dt*7);t.flash=Math.max(0,t.flash-dt*6);t.muzzle=Math.max(0,(t.muzzle||0)-dt);t.mergePulse=Math.max(0,(t.mergePulse||0)-dt*3.8);
    const target=findTarget(t);t.charge=target?Math.min(1,t.charge+dt*4):Math.max(0,t.charge-dt*3);
    if(target){const p=LEVEL.slots[t.slot],q=pathPoint(target.progress);t.aim=Math.atan2(q.y-(p.y-28),q.x-p.x);}
    if(target&&t.cooldown<=0){fireTower(t,target);t.cooldown=t.def.interval/(1+.16*(t.level-1));}
  }
}

function spawnSparks`, 'tower animation');

source = source.replace(
  "function addFloating(x,y,text,color='#fff',size=14){state.floating.push({x,y,text:String(text),color,size,life:.75,max:.75});}",
  `function addFloating(x,y,text,color='#fff',size=14){state.floating.push({x,y,text:String(text),color,size,life:.75,max:.75});}
function addRing(x,y,color,from,to,life=.3,width=3){state.rings.push({x,y,color,from,to,life,max:life,width});}
function addRune(x,y,color,life=.5,scale=1){state.runes.push({x,y,color,life,max:life,scale,rot:Math.random()*Math.PI});}
function addDecal(type,x,y,life=2,scale=1){state.decals.push({type,x,y,life,max:life,scale,rot:Math.random()*Math.PI});}
function spawnIceShards(x,y,count=18){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=rand(70,190);state.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.28,.62),max:.62,size:rand(2,6),color:'#bff7ff',gravity:90,shard:true,angle:a});}}`
);

replaceOnce(/function updateEffects\(dt\)\{[\s\S]*?\n\}\n\nfunction updateSpawning/, `function updateEffects(dt){
  for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.gravity||0)*dt;p.vx*=.985;p.life-=dt;}
  for(const f of state.fx)f.life-=dt;for(const f of state.floating){f.y-=32*dt;f.life-=dt;}for(const b of state.beams)b.life-=dt;
  for(const r of state.rings)r.life-=dt;for(const r of state.runes){r.life-=dt;r.rot+=dt*2.2;}for(const d of state.decals)d.life-=dt;
  state.particles=state.particles.filter(p=>p.life>0);state.fx=state.fx.filter(f=>f.life>0);state.floating=state.floating.filter(f=>f.life>0);state.beams=state.beams.filter(b=>b.life>0);
  state.rings=state.rings.filter(r=>r.life>0);state.runes=state.runes.filter(r=>r.life>0);state.decals=state.decals.filter(d=>d.life>0);
  state.screenShake=Math.max(0,state.screenShake-dt*38);state.flash=Math.max(0,state.flash-dt);
}

function updateSpawning`, 'effect lifecycle');

const scene = `const SCENE_BLOCKS=[
  {x:65,y:170,w:250,h:120,c:'#1bdfff'},{x:360,y:145,w:185,h:92,c:'#8b63ff'},
  {x:1080,y:160,w:210,h:105,c:'#22cfe8'},{x:1320,y:170,w:180,h:120,c:'#ff5a92'},
  {x:80,y:680,w:225,h:70,c:'#ff5a92'},{x:430,y:685,w:170,h:55,c:'#1bdfff'},
  {x:1090,y:700,w:170,h:45,c:'#8b63ff'},{x:1370,y:670,w:150,h:65,c:'#1bdfff'}
];
function drawSceneBlock(b){
  ctx.save();ctx.fillStyle='rgba(2,10,21,.92)';ctx.strokeStyle=rgba(b.c,.2);ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,8);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(7,24,39,.9)';ctx.fillRect(b.x+10,b.y+10,b.w-20,9);ctx.fillStyle=rgba(b.c,.18);
  for(let x=b.x+14;x<b.x+b.w-12;x+=24)ctx.fillRect(x,b.y+b.h-16,11,3);
  ctx.strokeStyle=rgba(b.c,.13);for(let x=b.x+28;x<b.x+b.w;x+=54){ctx.beginPath();ctx.moveTo(x,b.y);ctx.lineTo(x-16,b.y-22);ctx.stroke();}
  ctx.restore();
}
function drawBackground(){
  ctx.drawImage(img.background,0,0,img.background.width,img.background.height,0,0,DESIGN.w,DESIGN.h);
  ctx.fillStyle='rgba(0,6,14,.68)';ctx.fillRect(0,0,DESIGN.w,DESIGN.h);
  const sky=ctx.createLinearGradient(0,100,0,760);sky.addColorStop(0,'rgba(3,16,31,.22)');sky.addColorStop(1,'rgba(0,4,10,.82)');ctx.fillStyle=sky;ctx.fillRect(0,0,1600,760);
  SCENE_BLOCKS.forEach(drawSceneBlock);
  // Street plates
  ctx.save();ctx.strokeStyle='rgba(53,116,145,.1)';ctx.lineWidth=1;for(let x=120;x<1520;x+=84){ctx.beginPath();ctx.moveTo(x,205);ctx.lineTo(x-120,740);ctx.stroke();}for(let y=220;y<740;y+=64){ctx.beginPath();ctx.moveTo(70,y);ctx.lineTo(1530,y);ctx.stroke();}ctx.restore();
  // Reactor plaza landmark
  ctx.save();ctx.translate(820,400);ctx.fillStyle='rgba(3,13,28,.76)';ctx.strokeStyle='rgba(91,215,255,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,178,0,Math.PI*2);ctx.fill();ctx.stroke();
  for(let i=0;i<3;i++){ctx.strokeStyle=i===1?'rgba(220,78,255,.18)':'rgba(67,220,255,.13)';ctx.lineWidth=8-i*2;ctx.beginPath();ctx.arc(0,0,72+i*38,state.ambientTime*.08*(i%2?1:-1),Math.PI*1.35+state.ambientTime*.08*(i%2?1:-1));ctx.stroke();}
  ctx.fillStyle='rgba(16,40,61,.86)';ctx.beginPath();ctx.arc(0,0,58,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(113,235,255,.34)';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  // Elevated bridge deck and supports
  ctx.save();ctx.fillStyle='rgba(2,11,23,.88)';ctx.strokeStyle='rgba(71,184,216,.16)';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(1010,606,430,94,18);ctx.fill();ctx.stroke();
  for(let x=1060;x<1410;x+=96){ctx.fillStyle='rgba(4,17,31,.95)';ctx.fillRect(x,694,24,44);ctx.strokeStyle='rgba(62,175,211,.16)';ctx.strokeRect(x,694,24,44);}ctx.restore();
  const vignette=ctx.createRadialGradient(810,430,210,810,430,930);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.68)');ctx.fillStyle=vignette;ctx.fillRect(0,0,1600,900);
}
function drawPath(){
  const pts=LEVEL.path;ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowBlur=13;ctx.shadowColor='rgba(213,72,255,.42)';ctx.strokeStyle='rgba(99,40,125,.34)';ctx.lineWidth=48;pathStroke(pts);
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(18,29,43,.98)';ctx.lineWidth=38;pathStroke(pts);
  ctx.strokeStyle='rgba(66,91,112,.74)';ctx.lineWidth=30;pathStroke(pts);
  ctx.strokeStyle='rgba(5,15,26,.96)';ctx.lineWidth=24;pathStroke(pts);
  const edge=ctx.createLinearGradient(70,590,1510,500);edge.addColorStop(0,'#ff527b');edge.addColorStop(.48,'#b957ff');edge.addColorStop(1,'#5ae8ff');ctx.strokeStyle=edge;ctx.lineWidth=3;pathStroke(pts);
  ctx.strokeStyle='rgba(188,218,235,.38)';ctx.lineWidth=1.3;ctx.setLineDash([18,24]);pathStroke(pts);ctx.setLineDash([]);
  for(let i=0;i<8;i++){const p=pathPoint(((state.ambientTime*.035+i/8)%1));ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='rgba(127,225,255,.55)';ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-4);ctx.lineTo(-1,0);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.restore();
}
function pathStroke`;
replaceOnce(/const DISTRICT_BLOCKS = \[[\s\S]*?function pathStroke/, scene, 'production scene');

replaceOnce(/function drawSpawnGate\(\)\{[^\n]*\}\nfunction drawCore\(\)\{[^\n]*\}/, `function drawSpawnGate(){const p=LEVEL.path[0];ctx.save();ctx.translate(p.x-30,p.y);ctx.fillStyle='rgba(24,7,18,.96)';ctx.strokeStyle='#ff5577';ctx.lineWidth=3;ctx.shadowColor='#ff315f';ctx.shadowBlur=18;ctx.beginPath();ctx.roundRect(-34,-38,54,76,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#ff5878';for(let i=-20;i<=20;i+=14)ctx.fillRect(-24,i,31,3);ctx.fillStyle='rgba(255,255,255,.78)';ctx.font='700 9px sans-serif';ctx.textAlign='center';ctx.fillText('BREACH',-7,52);ctx.restore();}
function drawCore(){const p=LEVEL.path.at(-1),pulse=1+Math.sin(state.ambientTime*2.6)*.022;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(3,12,27,.92)';ctx.strokeStyle='rgba(102,222,255,.34)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,36,69,29,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.scale(pulse,pulse);ctx.shadowColor='#c75cff';ctx.shadowBlur=22;ctx.drawImage(img.core,-62,-80,124,124);ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(105,232,255,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,34,49,16,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(199,92,255,.25)';ctx.beginPath();ctx.arc(0,-4,58+Math.sin(state.ambientTime*2)*2,0,Math.PI*2);ctx.stroke();ctx.restore();}`, 'integrated endpoints');

replaceOnce(/function drawSlots\(\)\{[\s\S]*?\n\}\nfunction polygon/, `function drawSlots(){
  const dragging=state.drag?.moved&&state.drag.tower,reveal=Boolean(state.selectedBuild||dragging||(!state.waveActive&&state.towers.length<2));
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower,target=Boolean(dragging&&hover);
    const merge=target&&t&&t!==dragging&&t.type===dragging.type&&t.level===dragging.level,swap=target&&t&&t!==dragging&&!merge;
    const color=merge?'#ffd86f':swap?'#8db5ff':target?'#76ffc2':t?t.def.color:'#58dfff';
    const alpha=t||hover||target?1:reveal?.62:.13,pulse=target?1+Math.sin(performance.now()*.012)*.07:1;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor=color;ctx.shadowBlur=target?24:hover||selected?18:reveal?8:0;
    ctx.fillStyle=t?'rgba(3,13,27,.86)':'rgba(4,18,31,.58)';ctx.strokeStyle=color;ctx.lineWidth=target?3:hover||selected?2:1.2;polygon(0,0,target?34:28,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;polygon(0,0,21,8);ctx.stroke();
    if(!t||t===dragging){ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();}
    if(target){ctx.fillStyle=color;ctx.font='800 9px sans-serif';ctx.textAlign='center';ctx.fillText(merge?'MERGE':swap?'SWAP':'DEPLOY',0,45);}ctx.restore();
  });
}
function polygon`, 'subtle tower pads');

replaceOnce(/function drawTower\(t\)\{[\s\S]*?\n\}\n\nfunction drawEnemy/, `function drawTower(t){
  const home=LEVEL.slots[t.slot],pos=towerDrawPosition(t),def=t.def,baseScale=(.245+.015*(t.level-1))*(1+(t.mergePulse||0)*.11),recoil=t.recoil*7;
  if(pos.dragging){ctx.save();ctx.translate(home.x,home.y);ctx.globalAlpha=.18;ctx.strokeStyle=rgba(def.color,.7);ctx.setLineDash([6,7]);ctx.lineWidth=2;polygon(0,0,31,8);ctx.stroke();ctx.restore();ctx.save();ctx.strokeStyle=rgba(def.color,.3);ctx.setLineDash([6,10]);ctx.beginPath();ctx.moveTo(home.x,home.y);ctx.quadraticCurveTo((home.x+pos.x)/2,(home.y+pos.y)/2-42,pos.x,pos.y+18);ctx.stroke();ctx.restore();}
  if(t===state.selectedTower&&!pos.dragging){const range=def.range*(1+.08*(t.level-1))*state.mods.range;ctx.save();ctx.strokeStyle=rgba(def.color,.42);ctx.fillStyle=rgba(def.color,.035);ctx.setLineDash([8,10]);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(home.x,home.y,range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  ctx.save();ctx.translate(pos.x,pos.y);if(pos.dragging){ctx.translate(0,-8-Math.sin(performance.now()*.012)*4);ctx.scale(1.08,1.08);ctx.globalAlpha=.95;}ctx.shadowColor=def.color;ctx.shadowBlur=pos.dragging?32:14+t.charge*10;ctx.drawImage(img[def.asset],-210*baseScale,-225*baseScale-recoil,420*baseScale,420*baseScale);ctx.shadowBlur=0;
  if(t.muzzle>0){const a=t.aim||-Math.PI/2,mx=Math.cos(a)*31,my=-28+Math.sin(a)*31,k=t.muzzle/.16;ctx.globalCompositeOperation='screen';ctx.globalAlpha=k;ctx.translate(mx,my);ctx.rotate(a);if(t.type==='rail'){ctx.fillStyle='#fff';ctx.fillRect(-5,-2,28,4);ctx.fillStyle=def.color;ctx.fillRect(-9,-6,17,12);}else if(t.type==='cryo'){ctx.strokeStyle='#c7f8ff';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(15,0);ctx.stroke();}}else if(t.type==='plasma'){const g=ctx.createRadialGradient(0,0,1,0,0,22);g.addColorStop(0,'#fff');g.addColorStop(.35,'#ffd36a');g.addColorStop(1,'rgba(255,78,92,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();}else{ctx.strokeStyle='#ef9fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.stroke();ctx.rotate(state.ambientTime*2);ctx.strokeRect(-9,-9,18,18);}}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='rgba(2,8,18,.88)';ctx.strokeStyle=def.color;ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(25,16,38,21,9);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 12px sans-serif';ctx.textAlign='center';ctx.fillText(\`L\${t.level}\`,44,31);ctx.restore();
}

function drawEnemy`, 'tower firing visuals');

replaceOnce(/function drawEnemy\(e\)\{[\s\S]*?\n\}\n\nfunction drawProjectiles/, `function drawEnemy(e){
  const p=pathPoint(e.progress),bob=Math.sin(e.bob)*3,scale=(e.def.boss?.26:e.type==='brute'||e.type==='shield'?.21:e.type==='runner'?.185:.175)*e.spawnScale;
  const kick=e.impact>0?Math.sin(e.impact*90)*5:0;
  ctx.save();ctx.translate(p.x-Math.cos(e.angle)*kick,p.y+bob-Math.sin(e.angle)*kick);ctx.rotate(Math.sin(e.bob*.3)*.025);ctx.globalAlpha=e.alpha;
  ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.ellipse(0,22,e.def.boss?48:27,e.def.boss?16:9,0,0,Math.PI*2);ctx.fill();
  ctx.shadowColor=e.frost>.2?'#8be9ff':e.def.color;ctx.shadowBlur=e.def.boss?20:10;const sourceSize=e.def.boss?500:360;ctx.drawImage(img[e.def.asset],-sourceSize*scale/2,-sourceSize*scale*.56,sourceSize*scale,sourceSize*scale);ctx.shadowBlur=0;
  if(e.frost>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=.18+e.frost*.35;ctx.fillStyle='#9cecff';ctx.beginPath();ctx.ellipse(0,0,e.def.boss?51:32,e.def.boss?44:29,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.5+e.frost*.35;ctx.strokeStyle='#c7f8ff';ctx.lineWidth=2;for(let i=0;i<6;i++){const a=i*Math.PI/3+state.ambientTime*.45,r=e.def.boss?55:37;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.72,Math.sin(a)*r*.55);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.75);ctx.stroke();}}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  if(e.type==='shield'&&e.shield>0){ctx.strokeStyle='rgba(255,190,78,.9)';ctx.fillStyle='rgba(255,160,50,.06)';ctx.lineWidth=2.5;polygon(0,0,42,6);ctx.fill();ctx.stroke();}
  if(e.hit>0){const hitColor=e.impactKind==='cryo'?'160,240,255':e.impactKind==='plasma'?'255,156,72':e.impactKind==='arcane'?'226,120,255':'255,255,255';ctx.globalCompositeOperation='screen';ctx.fillStyle=\`rgba(\${hitColor},\${clamp(e.hit*4.8,0,.72)})\`;ctx.beginPath();ctx.arc(0,0,e.def.boss?57:33,0,Math.PI*2);ctx.fill();}ctx.restore();
  const barW=e.def.boss?100:50,y=p.y-(e.def.boss?74:45);ctx.fillStyle='rgba(0,0,0,.8)';ctx.beginPath();ctx.roundRect(p.x-barW/2,y,barW,6,4);ctx.fill();ctx.fillStyle=e.def.boss?'#ff4168':'#67f3a1';ctx.beginPath();ctx.roundRect(p.x-barW/2,y,barW*clamp(e.hp/e.maxHp,0,1),6,4);ctx.fill();if(e.shield>0){ctx.fillStyle='#ffc45b';ctx.fillRect(p.x-barW/2,y+8,barW*clamp(e.shield/e.maxShield,0,1),3);}if(e.def.boss){ctx.fillStyle='#ff819a';ctx.font='800 13px sans-serif';ctx.textAlign='center';ctx.fillText('BOSS',p.x,y-8);}
}

function drawProjectiles`, 'enemy status visuals');

replaceOnce(/function drawProjectiles\(\)\{[\s\S]*?\n\}\nfunction drawEffects/, `function drawProjectiles(){
  for(const p of state.projectiles){
    for(let i=0;i<p.trail.length;i++){const t=p.trail[i],a=Math.max(0,t.life/(p.type==='plasma'?.28:.22))*(i+1)/p.trail.length;ctx.save();ctx.globalAlpha=a;ctx.globalCompositeOperation='screen';if(p.type==='cryo'){ctx.fillStyle='#a8f3ff';ctx.beginPath();ctx.arc(t.x,t.y,2+i*.18,0,Math.PI*2);ctx.fill();}else if(p.type==='plasma'){ctx.fillStyle=i%2?'#ff7c51':'#ffca65';ctx.beginPath();ctx.arc(t.x,t.y,3+i*.34,0,Math.PI*2);ctx.fill();}else{ctx.strokeStyle='#db76ff';ctx.lineWidth=1.5;ctx.translate(t.x,t.y);ctx.rotate(t.spin);ctx.strokeRect(-3-i*.08,-3-i*.08,6+i*.16,6+i*.16);}ctx.restore();}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.spin);ctx.globalCompositeOperation='screen';
    if(p.type==='cryo'){ctx.shadowColor='#a9efff';ctx.shadowBlur=16;ctx.fillStyle='#e7fdff';ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#83dcff';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(13,0);ctx.stroke();}}
    if(p.type==='plasma'){const g=ctx.createRadialGradient(0,0,1,0,0,19);g.addColorStop(0,'#fff');g.addColorStop(.25,'#ffd270');g.addColorStop(.62,'#ff6b54');g.addColorStop(1,'rgba(255,58,122,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();}
    if(p.type==='arcane'){ctx.shadowColor='#dd6fff';ctx.shadowBlur=18;ctx.fillStyle='#f1b2ff';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#df77ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.stroke();ctx.rotate(-p.spin*1.8);ctx.strokeRect(-9,-9,18,18);}ctx.restore();
  }
  for(const b of state.beams){ctx.save();const a=b.life/b.max;ctx.globalAlpha=a;ctx.globalCompositeOperation='screen';ctx.shadowColor=b.color;ctx.shadowBlur=b.kind==='rail'?22:16;ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.beginPath();ctx.moveTo(b.x1,b.y1);if(b.kind==='arcane'){const steps=7;for(let i=1;i<steps;i++){const t=i/steps,phase=(b.seed||0)+i*2.2;ctx.lineTo(lerp(b.x1,b.x2,t)+Math.sin(phase)*9,lerp(b.y1,b.y2,t)+Math.cos(phase)*9);}}ctx.lineTo(b.x2,b.y2);ctx.stroke();ctx.restore();}
}
function drawEffects`, 'distinct projectile rendering');

replaceOnce(/function drawEffects\(\)\{[\s\S]*?\n\}\n\nfunction drawAmbient/, `function drawGroundEffects(){for(const d of state.decals){const a=clamp(d.life/d.max,0,1);ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.globalAlpha=Math.min(.42,a*.55);if(d.type==='scorch'){const g=ctx.createRadialGradient(0,0,4,0,0,55*d.scale);g.addColorStop(0,'rgba(255,116,44,.32)');g.addColorStop(.45,'rgba(90,22,18,.28)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,55*d.scale,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle='rgba(150,235,255,.12)';ctx.strokeStyle='rgba(191,249,255,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,42*d.scale,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();}}
function drawEnergyEffects(){
  for(const r of state.rings){const t=1-r.life/r.max,rad=lerp(r.from,r.to,t);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-t)*.82;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=13;ctx.lineWidth=r.width*(1-t*.45);ctx.beginPath();ctx.arc(r.x,r.y,rad,0,Math.PI*2);ctx.stroke();ctx.restore();}
  for(const r of state.runes){const a=clamp(r.life/r.max,0,1),s=32*r.scale*(1+(1-a)*.28);ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.rot);ctx.globalCompositeOperation='screen';ctx.globalAlpha=a*.82;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=14;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.stroke();ctx.rotate(Math.PI/4);ctx.strokeRect(-s*.55,-s*.55,s*1.1,s*1.1);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(s*.72,0);ctx.lineTo(s,0);ctx.stroke();}ctx.restore();}
}
function drawEffects(){
  for(const f of state.fx){const a=clamp(f.life/f.max,0,1),s=140*f.scale*(1+(1-a)*.35);ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot);ctx.globalAlpha=a;ctx.globalCompositeOperation=f.blend;ctx.drawImage(img[f.asset],-s/2,-s/2,s,s);ctx.restore();}
  for(const p of state.particles){const a=clamp(p.life/p.max,0,1);ctx.save();ctx.globalAlpha=a;ctx.translate(p.x,p.y);if(p.shard){ctx.rotate(p.angle||0);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(p.size*1.8,0);ctx.lineTo(-p.size,p.size*.55);ctx.lineTo(-p.size,-p.size*.55);ctx.closePath();ctx.fill();}else if(p.smoke){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size*(1+(1-a)*.5),0,Math.PI*2);ctx.fill();}else{ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);}ctx.restore();}
  for(const f of state.floating){ctx.save();ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.font=\`800 \${f.size}px sans-serif\`;ctx.textAlign='center';ctx.fillStyle=f.color;ctx.shadowColor=f.color;ctx.shadowBlur=12;ctx.fillText(f.text,f.x,f.y);ctx.restore();}
}

function drawAmbient`, 'effect rendering');

replaceOnce(/function render\(\)\{[\s\S]*?\n\}/, `function render(){
  const shake=state.screenShake>0?{x:rand(-state.screenShake,state.screenShake),y:rand(-state.screenShake*.6,state.screenShake*.6)}:{x:0,y:0};
  ctx.save();ctx.translate(shake.x,shake.y);drawBackground();drawPath();drawGroundEffects();drawSpawnGate();drawCore();drawSlots();state.towers.forEach(drawTower);state.enemies.forEach(drawEnemy);drawProjectiles();drawEnergyEffects();drawEffects();drawAmbient();ctx.restore();
  if(state.flash>0){ctx.fillStyle=\`rgba(255,90,120,\${state.flash*.25})\`;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);}
}`, 'render order');

source = source.replace('function updateUI(expensive=true){', "function updateUI(expensive=true){\n  document.body.classList.toggle('combat-active',Boolean(state.waveActive&&!state.paused));");
source = source.replace(
  'window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img,level:LEVEL,pathInfo};',
  'window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img,level:LEVEL,pathInfo,createEnemy,fireTower,pathPoint,towerTypes:TOWER_TYPES};'
);

await fs.writeFile(file, source);
console.log('production scene and VFX materialized');
