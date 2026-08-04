'use strict';
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

function update(dt) {
  if(!state.ready||!state.running||state.paused)return;
  dt*=state.speed;state.ambientTime+=dt;updateSpawning(dt);updateEnemies(dt);updateTowers(dt);updateProjectiles(dt);updateEffects(dt);updateUI(false);
}

function drawBackground() {ctx.drawImage(img.background,0,0,DESIGN.w,DESIGN.h);}
function drawPath() {
  const pts=LEVEL.path;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowBlur=35;ctx.shadowColor='#d941ff';ctx.strokeStyle='rgba(179,40,255,.18)';ctx.lineWidth=84;pathStroke(pts);
  ctx.shadowBlur=17;ctx.shadowColor='#ef4aff';ctx.strokeStyle='rgba(253,66,255,.72)';ctx.lineWidth=45;pathStroke(pts);
  const grad=ctx.createLinearGradient(80,700,1400,400);grad.addColorStop(0,'#ff3f80');grad.addColorStop(.38,'#db4cff');grad.addColorStop(.72,'#6a7cff');grad.addColorStop(1,'#55e7ff');ctx.shadowBlur=0;ctx.strokeStyle=grad;ctx.lineWidth=32;pathStroke(pts);
  ctx.strokeStyle='rgba(10,22,41,.95)';ctx.lineWidth=22;pathStroke(pts);
  ctx.strokeStyle='rgba(207,147,255,.78)';ctx.lineWidth=2;ctx.setLineDash([12,14]);pathStroke(pts);ctx.setLineDash([]);
  for(let i=0;i<11;i++){const prog=((state.ambientTime*.07+i/11)%1),p=pathPoint(prog);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='rgba(255,176,255,.82)';ctx.shadowColor='#f85cff';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(-5,-7);ctx.lineTo(0,0);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.restore();
}
function pathStroke(pts){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}

function drawSpawnGate(){const p=LEVEL.path[0];ctx.save();ctx.translate(p.x-30,p.y);ctx.shadowColor='#ff365f';ctx.shadowBlur=35;ctx.fillStyle='rgba(62,7,19,.9)';ctx.strokeStyle='#ff436a';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-52,-52,85,104,12);ctx.fill();ctx.stroke();ctx.fillStyle='#ff4d6d';for(let i=-30;i<=30;i+=20)ctx.fillRect(-38,i,56,4);ctx.fillStyle='#fff';ctx.font='700 13px sans-serif';ctx.textAlign='center';ctx.fillText('SPAWN',-10,76);ctx.restore();}
function drawCore(){const p=LEVEL.path.at(-1),pulse=1+Math.sin(state.ambientTime*2.6)*.035;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor='#c75cff';ctx.shadowBlur=32;ctx.globalAlpha=.96;ctx.drawImage(img.arcane,-125,-145,250,250);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.75;ctx.drawImage(img.core,-140,-160,280,280);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.strokeStyle='rgba(105,232,255,.72)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,38,78,29,0,0,Math.PI*2);ctx.stroke();ctx.restore();}

function drawSlots(){
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower;ctx.save();ctx.translate(p.x,p.y);const color=t?t.def.color:hover?'#8affd3':'#45d9ff';ctx.shadowColor=color;ctx.shadowBlur=hover||selected?28:15;ctx.fillStyle='rgba(5,16,31,.86)';ctx.strokeStyle=color;ctx.lineWidth=hover||selected?3:2;polygon(0,0,50,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=1;polygon(0,0,38,8);ctx.stroke();if(!t){ctx.strokeStyle='rgba(72,224,255,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.moveTo(0,-11);ctx.lineTo(0,11);ctx.stroke();}ctx.restore();
  });
}
function polygon(cx,cy,r,n){ctx.beginPath();for(let i=0;i<n;i++){const a=-Math.PI/8+i*Math.PI*2/n,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}

function drawTower(t){
  const p=LEVEL.slots[t.slot], def=t.def, baseScale=.42+.025*(t.level-1), recoil=t.recoil*8;
  if(t===state.selectedTower){const range=def.range*(1+.08*(t.level-1))*state.mods.range;ctx.save();ctx.strokeStyle=rgba(def.color,.55);ctx.fillStyle=rgba(def.color,.06);ctx.setLineDash([8,9]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,range,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.restore();}
  for(const other of state.towers){if(other===t||other.slot<t.slot)continue;const op=LEVEL.slots[other.slot];if(dist(p,op)<250&&other.type!==t.type){ctx.save();ctx.strokeStyle=rgba(t.def.color,.22);ctx.lineWidth=2;ctx.setLineDash([5,9]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(op.x,op.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();}}
  ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=def.color;ctx.shadowBlur=20+t.charge*12;ctx.globalAlpha=.97;ctx.drawImage(img[def.asset],-210*baseScale,-245*baseScale-recoil,420*baseScale,420*baseScale);ctx.shadowBlur=0;
  if(t.flash>0){ctx.globalCompositeOperation='screen';ctx.globalAlpha=t.flash*.45;ctx.fillStyle=def.color;ctx.beginPath();ctx.arc(0,-35,38,0,Math.PI*2);ctx.fill();}
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='rgba(2,8,18,.9)';ctx.strokeStyle=def.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(30,18,42,23,10);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='700 13px sans-serif';ctx.textAlign='center';ctx.fillText(`L${t.level}`,51,34);ctx.restore();
}

function drawEnemy(e){
  const p=pathPoint(e.progress), bob=Math.sin(e.bob)*3, scale=(e.def.boss?.38:e.type==='brute'||e.type==='shield'?.29:e.type==='runner'?.24:.22)*e.spawnScale;
  ctx.save();ctx.translate(p.x,p.y+bob);ctx.rotate(Math.sin(e.bob*.3)*.03);ctx.globalAlpha=e.alpha;ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(0,23,e.def.boss?52:30,e.def.boss?17:10,0,0,Math.PI*2);ctx.fill();ctx.shadowColor=e.def.color;ctx.shadowBlur=e.def.boss?24:12;ctx.drawImage(img[e.def.asset],-180*scale,-200*scale,360*scale,360*scale);ctx.shadowBlur=0;
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
