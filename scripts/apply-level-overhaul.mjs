import fs from 'node:fs/promises';

const file = new URL('../app.js', import.meta.url);
let source = await fs.readFile(file, 'utf8');

if (source.includes('// LEVEL_LAYOUT_OVERHAUL_V1')) {
  console.log('level overhaul already materialized');
  process.exit(0);
}

function replaceOnce(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Unable to patch ${label}`);
  source = source.replace(pattern, replacement);
}

const level = `// LEVEL_LAYOUT_OVERHAUL_V1
const LEVEL = {
  name: 'LOWER DISTRICT', waves: 5,
  path: [
    {x:60,y:610},{x:260,y:610},{x:380,y:545},{x:410,y:455},{x:350,y:370},
    {x:405,y:275},{x:620,y:220},{x:820,y:225},{x:980,y:295},{x:1055,y:390},
    {x:1025,y:495},{x:945,y:575},{x:980,y:660},{x:1190,y:690},{x:1340,y:645},
    {x:1410,y:560},{x:1385,y:475},{x:1435,y:430},{x:1510,y:530}
  ],
  slots: [
    {x:245,y:510,zone:'corridor'},{x:330,y:680,zone:'corridor'},
    {x:505,y:470,zone:'control'},{x:300,y:270,zone:'control'},
    {x:610,y:360,zone:'crossfire'},{x:800,y:370,zone:'crossfire'},
    {x:900,y:500,zone:'burn'},{x:1090,y:565,zone:'burn'},
    {x:1190,y:550,zone:'recovery'},{x:1290,y:390,zone:'last-stand'},
    {x:1320,y:285,zone:'last-stand'}
  ],
  zones: [
    {x:172,y:665,label:'KILL CORRIDOR',color:'#ff5f86'},
    {x:438,y:322,label:'CONTROL TURN',color:'#7fe8ff'},
    {x:735,y:288,label:'CROSSFIRE',color:'#9a8cff'},
    {x:1012,y:630,label:'BURN ZONE',color:'#ff9a47'},
    {x:1338,y:354,label:'LAST STAND',color:'#68f0d0'}
  ],
  wavesData: [
    [{type:'drone',count:9,gap:.58}],
    [{type:'runner',count:10,gap:.42},{type:'drone',count:6,gap:.46}],
    [{type:'brute',count:6,gap:.78},{type:'runner',count:11,gap:.34}],
    [{type:'shield',count:7,gap:.68},{type:'drone',count:13,gap:.30}],
    [{type:'runner',count:13,gap:.25},{type:'brute',count:7,gap:.48},{type:'boss',count:1,gap:1.05}]
  ]
};`;
replaceOnce(/const LEVEL = \{[\s\S]*?\n\};\n\nconst state =/, `${level}\n\nconst state =`, 'level data');

replaceOnce(/function drawBackground\(\)\{[^\n]*\}\nfunction drawPath/, `const DISTRICT_BLOCKS = [
  {x:92,y:184,w:118,h:54,t:0},{x:232,y:176,w:84,h:42,t:1},{x:470,y:154,w:112,h:48,t:2},
  {x:600,y:158,w:78,h:36,t:0},{x:1088,y:178,w:102,h:46,t:1},{x:1210,y:206,w:82,h:38,t:2},
  {x:1260,y:302,w:78,h:42,t:0},{x:1445,y:194,w:84,h:54,t:1},{x:88,y:696,w:130,h:40,t:2},
  {x:520,y:688,w:90,h:34,t:0},{x:720,y:684,w:108,h:38,t:1},{x:1208,y:718,w:92,h:30,t:2}
];
function drawDistrictStructures(){
  ctx.save();
  for(const b of DISTRICT_BLOCKS){
    const accent=b.t===0?'#1bdfff':b.t===1?'#8b63ff':'#ff5a92';
    ctx.fillStyle='rgba(3,13,27,.76)';ctx.strokeStyle=rgba(accent,.18);ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,5);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(12,35,54,.72)';ctx.fillRect(b.x+8,b.y+8,b.w-16,5);
    ctx.fillStyle=rgba(accent,.24);
    for(let x=b.x+10;x<b.x+b.w-8;x+=18)ctx.fillRect(x,b.y+b.h-12,8,2);
    ctx.strokeStyle=rgba(accent,.14);ctx.beginPath();ctx.moveTo(b.x+b.w*.72,b.y);ctx.lineTo(b.x+b.w*.72,b.y-12);ctx.stroke();
  }
  ctx.restore();
}
function drawBackground(){
  ctx.drawImage(img.background,0,0,img.background.width,img.background.height,0,0,DESIGN.w,DESIGN.h);
  ctx.fillStyle='rgba(1,7,16,.44)';ctx.fillRect(0,0,DESIGN.w,DESIGN.h);
  ctx.save();ctx.strokeStyle='rgba(68,151,188,.07)';ctx.lineWidth=1;
  for(let x=90;x<1540;x+=70){ctx.beginPath();ctx.moveTo(x,145);ctx.lineTo(x-90,748);ctx.stroke();}
  for(let y=170;y<750;y+=58){ctx.beginPath();ctx.moveTo(55,y);ctx.lineTo(1545,y);ctx.stroke();}
  ctx.restore();drawDistrictStructures();
  const g=ctx.createRadialGradient(790,430,150,790,430,900);g.addColorStop(0,'rgba(18,45,72,.02)');g.addColorStop(1,'rgba(0,0,0,.58)');ctx.fillStyle=g;ctx.fillRect(0,0,DESIGN.w,DESIGN.h);
}
function drawRouteZones(){
  ctx.save();ctx.font='800 9px sans-serif';ctx.textAlign='center';
  for(const z of LEVEL.zones){
    ctx.strokeStyle=rgba(z.color,.25);ctx.fillStyle=rgba(z.color,.8);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(z.x-52,z.y);ctx.lineTo(z.x-22,z.y);ctx.moveTo(z.x+22,z.y);ctx.lineTo(z.x+52,z.y);ctx.stroke();
    ctx.fillText(z.label,z.x,z.y+3);
  }
  ctx.restore();
}
function drawPath`, 'background');

replaceOnce(/function drawPath\(\) \{[\s\S]*?\n\}\nfunction pathStroke/, `function drawPath() {
  const pts=LEVEL.path;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowBlur=24;ctx.shadowColor='#d941ff';ctx.strokeStyle='rgba(179,40,255,.14)';ctx.lineWidth=50;pathStroke(pts);
  ctx.shadowBlur=12;ctx.shadowColor='#ef4aff';ctx.strokeStyle='rgba(253,66,255,.58)';ctx.lineWidth=30;pathStroke(pts);
  const grad=ctx.createLinearGradient(70,650,1510,400);grad.addColorStop(0,'#ff466f');grad.addColorStop(.36,'#d54cff');grad.addColorStop(.72,'#6a7cff');grad.addColorStop(1,'#55e7ff');ctx.shadowBlur=0;ctx.strokeStyle=grad;ctx.lineWidth=22;pathStroke(pts);
  ctx.strokeStyle='rgba(7,18,34,.98)';ctx.lineWidth=14;pathStroke(pts);
  ctx.strokeStyle='rgba(207,147,255,.68)';ctx.lineWidth=1.5;ctx.setLineDash([9,12]);pathStroke(pts);ctx.setLineDash([]);
  drawRouteZones();
  for(let i=0;i<15;i++){const prog=((state.ambientTime*.055+i/15)%1),p=pathPoint(prog);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='rgba(255,188,255,.72)';ctx.shadowColor='#f85cff';ctx.shadowBlur=8;ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-4,-5);ctx.lineTo(0,0);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.restore();
}
function pathStroke`, 'path rendering');

replaceOnce(/function drawSpawnGate\(\)\{[^\n]*\}\nfunction drawCore\(\)\{[^\n]*\}/, `function drawSpawnGate(){const p=LEVEL.path[0];ctx.save();ctx.translate(p.x-24,p.y);ctx.shadowColor='#ff365f';ctx.shadowBlur=24;ctx.fillStyle='rgba(62,7,19,.9)';ctx.strokeStyle='#ff436a';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-38,-42,62,84,9);ctx.fill();ctx.stroke();ctx.fillStyle='#ff4d6d';for(let i=-24;i<=24;i+=16)ctx.fillRect(-28,i,38,3);ctx.fillStyle='#fff';ctx.font='700 10px sans-serif';ctx.textAlign='center';ctx.fillText('SPAWN',-7,58);ctx.restore();}
function drawCore(){const p=LEVEL.path.at(-1),pulse=1+Math.sin(state.ambientTime*2.6)*.028;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor='#c75cff';ctx.shadowBlur=26;ctx.globalAlpha=.98;ctx.drawImage(img.core,-72,-88,144,144);ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(105,232,255,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,34,48,15,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='rgba(199,92,255,.34)';ctx.beginPath();ctx.arc(0,0,64+Math.sin(state.ambientTime*2)*3,0,Math.PI*2);ctx.stroke();ctx.restore();}`, 'spawn and core');

replaceOnce(/function drawSlots\(\)\{[\s\S]*?\n\}\nfunction polygon/, `function drawSlots(){
  const dragging=state.drag?.moved&&state.drag.tower;
  LEVEL.slots.forEach((p,i)=>{
    const t=towerAtSlot(i),hover=i===state.hoverSlot,selected=t&&t===state.selectedTower,target=Boolean(dragging&&hover);
    const merge=target&&t&&t!==dragging&&t.type===dragging.type&&t.level===dragging.level;
    const swap=target&&t&&t!==dragging&&!merge;
    const color=merge?'#ffd86f':swap?'#8db5ff':target?'#76ffc2':t?t.def.color:hover?'#8affd3':'#45d9ff';
    const pulse=target?1+Math.sin(performance.now()*.012)*.07:1;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor=color;ctx.shadowBlur=target?28:hover||selected?22:11;ctx.fillStyle=target?rgba(color,.12):'rgba(5,16,31,.88)';ctx.strokeStyle=color;ctx.lineWidth=target?3:hover||selected?2.5:1.5;polygon(0,0,target?41:35,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.11)';ctx.lineWidth=1;polygon(0,0,26,8);ctx.stroke();
    if(!t||t===dragging){ctx.strokeStyle=target?color:'rgba(72,224,255,.64)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();}
    if(target){ctx.fillStyle=color;ctx.font='800 9px sans-serif';ctx.textAlign='center';ctx.fillText(merge?'MERGE':swap?'SWAP':'DEPLOY',0,52);}
    ctx.restore();
  });
}
function polygon`, 'tower nodes');

source = source.replace("baseScale=(.31+.018*(t.level-1))", "baseScale=(.265+.016*(t.level-1))");
source = source.replace("e.def.boss?.32:e.type==='brute'||e.type==='shield'?.26:e.type==='runner'?.23:.21", "e.def.boss?.27:e.type==='brute'||e.type==='shield'?.22:e.type==='runner'?.19:.18");
source = source.replace("burstAt(1490,515,'#5eeaff',24,140);", "const core=LEVEL.path.at(-1);burstAt(core.x,core.y,'#5eeaff',24,140);");
source = source.replace("burstAt(1390,580,'#ff496f',40,190);addFloating(1360,500,`CORE -${damage}`", "const core=LEVEL.path.at(-1);burstAt(core.x,core.y,'#ff496f',40,190);addFloating(core.x-28,core.y-70,`CORE -${damage}`");
source = source.replace("window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img};", "window.__NEON_TEST__={state,resetGame,buildTower,startWave,useEMP,showProtocolChoices,endGame,assets:img,level:LEVEL,pathInfo};");

await fs.writeFile(file, source);
console.log('level overhaul materialized');
