(() => {
  'use strict';

  const BUILD='fusion-network-v5-20260806';
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

  function drawEndpoint(point,color,now,phase,density){
    const pulse=5.5+Math.sin(now*.004+phase)*1.2;
    context.save();
    context.globalCompositeOperation='screen';
    context.strokeStyle=color;
    context.shadowColor=color;
    context.shadowBlur=12;
    context.globalAlpha=.72*density;
    context.lineWidth=1.5;
    context.beginPath();
    context.arc(point.x,point.y,pulse,0,Math.PI*2);
    context.stroke();
    context.globalAlpha=.24*density;
    context.lineWidth=5;
    context.beginPath();
    context.arc(point.x,point.y,pulse+2,0,Math.PI*2);
    context.stroke();
    context.restore();
  }

  function drawLink(link,now,index,total){
    const from=towerPosition(link.fromType,link.fromSlot);
    const to=towerPosition(link.toType,link.toSlot);
    if(!from||!to) return;

    const density=Math.max(.52,1-Math.max(0,total-4)*.035);
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

    context.globalAlpha=.24*density;
    context.strokeStyle=gradient;
    context.shadowColor='#9feeff';
    context.shadowBlur=18;
    context.lineWidth=10;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();

    context.globalAlpha=.82*density;
    context.shadowBlur=7;
    context.lineWidth=2.25;
    context.setLineDash([10,8]);
    context.lineDashOffset=-(now*.043+index*5)%18;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();
    context.setLineDash([]);
    context.restore();

    drawEndpoint(start,fromColor,now,index*.7,density);
    drawEndpoint(end,toColor,now,index*.7+1.4,density);
  }

  function render(now){
    context.clearRect(0,0,WORLD.width,WORLD.height);
    const diagnostics=window.__COMBAT_BALANCE_DIAGNOSTICS;
    const links=diagnostics?.version>=5&&Array.isArray(diagnostics.links)?diagnostics.links:[];
    links.forEach((link,index)=>drawLink(link,now,index,links.length));

    window.__RESONANCE_BOARD_RUNTIME={
      build:BUILD,
      ready:true,
      combatVersion:diagnostics?.version||0,
      visibleLinkCount:links.length,
      independentOfBuildSelection:true,
      allPairs:true
    };
    requestAnimationFrame(render);
  }

  function install(){
    game=window.__NEON_TEST__;
    const shell=document.getElementById('game-shell');
    if(!game?.state||!shell||!window.__COMBAT_BALANCE_DIAGNOSTICS?.overlayReady) return false;

    overlay=document.getElementById('resonance-board-network-overlay');
    if(!overlay){
      overlay=document.createElement('canvas');
      overlay.id='resonance-board-network-overlay';
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
