(() => {
  'use strict';

  const BUILD='fusion-network-v6-20260807';
  const WORLD={width:1600,height:900};
  const TYPE_COLORS={
    rail:'#55e9ff',
    cryo:'#8eeaff',
    plasma:'#ffb55e',
    arcane:'#e287ff'
  };

  let game=null;
  let overlay=null;
  let context=null;

  function towerPosition(type,slot){
    const drag=game?.state?.drag;
    if(drag?.moved&&drag.tower?.type===type&&drag.tower?.slot===slot){
      return {x:drag.x,y:drag.y-18};
    }
    const point=game?.level?.slots?.[slot];
    return point?{x:point.x,y:point.y}:null;
  }

  function trimmedEndpoints(from,to,trim=38){
    const dx=to.x-from.x;
    const dy=to.y-from.y;
    const length=Math.hypot(dx,dy)||1;
    const nx=dx/length;
    const ny=dy/length;
    return {
      start:{x:from.x+nx*trim,y:from.y+ny*trim},
      end:{x:to.x-nx*trim,y:to.y-ny*trim},
      normal:{x:-ny,y:nx}
    };
  }

  function quadraticPoint(start,control,end,t){
    const inverse=1-t;
    return {
      x:inverse*inverse*start.x+2*inverse*t*control.x+t*t*end.x,
      y:inverse*inverse*start.y+2*inverse*t*control.y+t*t*end.y
    };
  }

  function drawEndpoint(point,color,now,phase,density,active){
    const pulse=5.5+Math.sin(now*.004+phase)*1.2;
    context.save();
    context.globalCompositeOperation='screen';
    context.strokeStyle=color;
    context.shadowColor=color;
    context.shadowBlur=active?13:7;
    context.globalAlpha=(active?.78:.28)*density;
    context.lineWidth=active?1.7:1;
    context.beginPath();
    context.arc(point.x,point.y,pulse,0,Math.PI*2);
    context.stroke();
    context.restore();
  }

  function drawLink(link,now,index,total){
    const from=towerPosition(link.fromType,link.fromSlot);
    const to=towerPosition(link.toType,link.toSlot);
    if(!from||!to) return;

    const density=Math.max(.48,1-Math.max(0,total-4)*.035);
    const {start,end,normal}=trimmedEndpoints(from,to);
    const bend=Math.min(24,link.distance*.045)*Math.sin((link.fromSlot+link.toSlot+1)*1.37);
    const control={
      x:(start.x+end.x)/2+normal.x*bend,
      y:(start.y+end.y)/2+normal.y*bend
    };
    const fromColor=TYPE_COLORS[link.fromType]||'#fff';
    const toColor=TYPE_COLORS[link.toType]||'#fff';
    const gradient=context.createLinearGradient(start.x,start.y,end.x,end.y);
    gradient.addColorStop(0,fromColor);
    gradient.addColorStop(.48,'rgba(255,255,255,.95)');
    gradient.addColorStop(1,toColor);

    context.save();
    context.globalCompositeOperation='screen';
    context.lineCap='round';
    context.globalAlpha=(link.mutual?.24:.14)*density;
    context.strokeStyle=gradient;
    context.shadowColor='#9feeff';
    context.shadowBlur=18;
    context.lineWidth=link.mutual?10:7;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();

    context.globalAlpha=(link.mutual?.82:.58)*density;
    context.shadowBlur=7;
    context.lineWidth=link.mutual?2.25:1.6;
    context.setLineDash(link.mutual?[10,8]:[5,10]);
    context.lineDashOffset=-(now*.043+index*5)%18;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();
    context.setLineDash([]);

    const phase=(now*.00028+index*.17)%1;
    const forward=link.toReceives&&!link.fromReceives?1-phase:phase;
    const pulse=quadraticPoint(start,control,end,forward);
    const pulseColor=link.fromReceives&&!link.toReceives?fromColor:toColor;
    const glow=context.createRadialGradient(pulse.x,pulse.y,1,pulse.x,pulse.y,11);
    glow.addColorStop(0,'rgba(255,255,255,.96)');
    glow.addColorStop(.35,pulseColor);
    glow.addColorStop(1,'rgba(0,0,0,0)');
    context.globalAlpha=.85*density;
    context.fillStyle=glow;
    context.beginPath();context.arc(pulse.x,pulse.y,11,0,Math.PI*2);context.fill();
    context.restore();

    drawEndpoint(start,fromColor,now,index*.7,density,Boolean(link.fromReceives));
    drawEndpoint(end,toColor,now,index*.7+1.4,density,Boolean(link.toReceives));
  }

  function render(now){
    context.clearRect(0,0,WORLD.width,WORLD.height);
    const diagnostics=window.__COMBAT_BALANCE_DIAGNOSTICS;
    const links=diagnostics?.version>=6&&Array.isArray(diagnostics.links)?diagnostics.links:[];
    links.forEach((link,index)=>drawLink(link,now,index,links.length));

    window.__RESONANCE_BOARD_RUNTIME={
      build:BUILD,
      ready:true,
      combatVersion:diagnostics?.version||0,
      visibleLinkCount:links.length,
      independentOfBuildSelection:true,
      allPairs:true,
      directionalByTowerRange:true
    };
    requestAnimationFrame(render);
  }

  function install(){
    game=window.__NEON_TEST__;
    const shell=document.getElementById('game-shell');
    if(!game?.state||!shell||!window.__COMBAT_BALANCE_DIAGNOSTICS?.overlayReady) return false;

    const legacy=document.getElementById('resonance-board-network-overlay');
    if(legacy) legacy.style.display='none';

    overlay=document.getElementById('resonance-board-network-v6-overlay');
    if(!overlay){
      overlay=document.createElement('canvas');
      overlay.id='resonance-board-network-v6-overlay';
      overlay.width=WORLD.width;
      overlay.height=WORLD.height;
      overlay.setAttribute('aria-hidden','true');
      Object.assign(overlay.style,{
        position:'absolute',
        inset:'0',
        width:`${WORLD.width}px`,
        height:`${WORLD.height}px`,
        zIndex:'2.6',
        pointerEvents:'none'
      });
      shell.appendChild(overlay);
    }
    shell.dataset.resonanceBoardBuild=BUILD;
    context=overlay.getContext('2d');
    if(!context) return false;
    requestAnimationFrame(render);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
