import fs from 'node:fs/promises';

const appUrl = new URL('../app.js', import.meta.url);
let source = await fs.readFile(appUrl, 'utf8');

if (source.includes('// SCENE_MAP_FOUNDATION_V2')) {
  console.log('scene map foundation already materialized');
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`Unable to patch ${label}`);
  source = next;
}

replaceOnce(
  "background: 'assets/world/background.webp'",
  "background: 'assets/world/lower-district-map.svg'",
  'scene map asset'
);

replaceOnce(
  '// PRODUCTION_SCENE_VFX_V1',
  '// SCENE_MAP_FOUNDATION_V2',
  'scene version marker'
);

const sceneRenderer = String.raw`function drawBackground(){
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

function drawSpawnGate`;

replaceOnce(
  /const SCENE_BLOCKS=\[[\s\S]*?function drawSpawnGate/,
  sceneRenderer,
  'procedural scene renderer'
);

replaceOnce(
  "const alpha=t||hover||target?1:reveal?.62:.13,pulse=target?1+Math.sin(performance.now()*.012)*.07:1;",
  "const alpha=t||hover||target?1:reveal?.48:.045,pulse=target?1+Math.sin(performance.now()*.012)*.07:1;",
  'tower slot visibility'
);

replaceOnce(
  "ctx.fillStyle=t?'rgba(3,13,27,.86)':'rgba(4,18,31,.58)';ctx.strokeStyle=color;ctx.lineWidth=target?3:hover||selected?2:1.2;polygon(0,0,target?34:28,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;",
  "ctx.fillStyle=t?'rgba(3,13,27,.82)':'rgba(7,20,29,.22)';ctx.strokeStyle=color;ctx.lineWidth=target?3:hover||selected?2:1;polygon(0,0,target?31:25,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;",
  'tower slot footprint'
);

replaceOnce(
  "ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=1;polygon(0,0,21,8);ctx.stroke();",
  "ctx.strokeStyle='rgba(255,255,255,.07)';ctx.lineWidth=1;polygon(0,0,18,8);ctx.stroke();",
  'tower slot inner ring'
);

await fs.writeFile(appUrl, source);
console.log('materialized integrated scene map foundation');
