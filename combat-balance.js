(() => {
  'use strict';

  const WORLD={width:1600,height:900};
  const RANGE_BY_TYPE={
    rail:240,
    cryo:225,
    plasma:215,
    arcane:265
  };
  const RESONANCE_TYPES={
    cryo:{stateKey:'frost',countId:'frostCount',color:'#8eeaff'},
    plasma:{stateKey:'energy',countId:'energyCount',color:'#ffb55e'},
    arcane:{stateKey:'arcane',countId:'arcaneCount',color:'#e287ff'}
  };

  let game=null;
  let overlay=null;
  let context=null;
  let lastSignature='';
  let links=[];

  function distance(a,b){
    return Math.hypot(a.x-b.x,a.y-b.y);
  }

  function pointSegmentDistance(point,a,b){
    const vx=b.x-a.x;
    const vy=b.y-a.y;
    const lengthSquared=vx*vx+vy*vy;
    if(!lengthSquared) return distance(point,a);
    const t=Math.max(0,Math.min(1,((point.x-a.x)*vx+(point.y-a.y)*vy)/lengthSquared));
    return distance(point,{x:a.x+vx*t,y:a.y+vy*t});
  }

  function nearestPathDistance(point,path){
    let best=Infinity;
    for(let index=0;index<path.length-1;index+=1){
      best=Math.min(best,pointSegmentDistance(point,path[index],path[index+1]));
    }
    return best;
  }

  function applyTowerRanges(){
    for(const [type,range] of Object.entries(RANGE_BY_TYPE)){
      if(game.towerTypes?.[type]) game.towerTypes[type].range=range;
    }
  }

  function pairNearest(towers){
    const remaining=[...towers];
    const pairs=[];
    while(remaining.length>=2){
      let bestA=0;
      let bestB=1;
      let bestDistance=Infinity;
      for(let a=0;a<remaining.length-1;a+=1){
        const pointA=game.level.slots[remaining[a].slot];
        for(let b=a+1;b<remaining.length;b+=1){
          const pointB=game.level.slots[remaining[b].slot];
          const candidate=distance(pointA,pointB);
          if(candidate<bestDistance){
            bestDistance=candidate;
            bestA=a;
            bestB=b;
          }
        }
      }
      const second=remaining.splice(bestB,1)[0];
      const first=remaining.splice(bestA,1)[0];
      pairs.push({from:first,to:second,distance:bestDistance});
    }
    return pairs;
  }

  function towerPosition(tower){
    if(game.state.drag?.tower===tower&&game.state.drag.moved){
      return {x:game.state.drag.x,y:game.state.drag.y-18};
    }
    const slot=game.level.slots[tower.slot];
    return {x:slot.x,y:slot.y};
  }

  function updateResonanceNetwork(force=false){
    const signature=game.state.towers
      .map(tower=>`${tower.type}:${tower.slot}:${tower.level}`)
      .sort()
      .join('|');
    if(!force&&signature===lastSignature) return;
    lastSignature=signature;
    links=[];

    for(const [type,config] of Object.entries(RESONANCE_TYPES)){
      const towers=game.state.towers.filter(tower=>tower.type===type);
      const pairs=pairNearest(towers);
      game.state.resonance[config.stateKey]=pairs.length;
      links.push(...pairs.map(pair=>({type,color:config.color,...pair})));

      const counter=document.getElementById(config.countId);
      if(counter){
        counter.textContent=`${Math.min(towers.length,2)}/2`;
        const badge=counter.closest('span');
        badge?.classList.toggle('resonance-active',pairs.length>0);
        badge?.setAttribute('title',pairs.length?`${pairs.length} resonance link${pairs.length>1?'s':''} active`:'Build a matching pair to activate resonance');
      }
    }

    publishDiagnostics();
  }

  function quadraticPoint(start,control,end,t){
    const inverse=1-t;
    return {
      x:inverse*inverse*start.x+2*inverse*t*control.x+t*t*end.x,
      y:inverse*inverse*start.y+2*inverse*t*control.y+t*t*end.y
    };
  }

  function trimmedEndpoints(from,to,trim=34){
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

  function drawLink(link,now){
    const from=towerPosition(link.from);
    const to=towerPosition(link.to);
    const {start,end,normal}=trimmedEndpoints(from,to);
    const bend=Math.min(28,link.distance*.055)*Math.sin((link.from.slot+link.to.slot+1)*1.7);
    const control={x:(start.x+end.x)/2+normal.x*bend,y:(start.y+end.y)/2+normal.y*bend};
    const activeAlpha=game.state.waveActive?.28:.46;

    context.save();
    context.globalCompositeOperation='screen';
    context.lineCap='round';

    context.globalAlpha=activeAlpha*.34;
    context.strokeStyle=link.color;
    context.lineWidth=8;
    context.shadowColor=link.color;
    context.shadowBlur=18;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();

    context.globalAlpha=activeAlpha;
    context.lineWidth=1.8;
    context.setLineDash([12,10]);
    context.lineDashOffset=-(now*.035)%22;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();
    context.setLineDash([]);

    const pulseT=(now*.00022+(link.from.slot+link.to.slot)*.13)%1;
    const pulse=quadraticPoint(start,control,end,pulseT);
    const glow=context.createRadialGradient(pulse.x,pulse.y,1,pulse.x,pulse.y,12);
    glow.addColorStop(0,'rgba(255,255,255,.95)');
    glow.addColorStop(.28,link.color);
    glow.addColorStop(1,'rgba(0,0,0,0)');
    context.globalAlpha=.92;
    context.fillStyle=glow;
    context.beginPath();
    context.arc(pulse.x,pulse.y,12,0,Math.PI*2);
    context.fill();
    context.restore();
  }

  function render(now){
    updateResonanceNetwork();
    context.clearRect(0,0,WORLD.width,WORLD.height);
    for(const link of links) drawLink(link,now);
    requestAnimationFrame(render);
  }

  function installOverlay(){
    const shell=document.getElementById('game-shell');
    if(!shell) return false;
    overlay=document.createElement('canvas');
    overlay.id='resonance-link-overlay';
    overlay.width=WORLD.width;
    overlay.height=WORLD.height;
    overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{
      position:'absolute',
      inset:'0',
      width:`${WORLD.width}px`,
      height:`${WORLD.height}px`,
      zIndex:'1',
      pointerEvents:'none'
    });
    shell.appendChild(overlay);
    context=overlay.getContext('2d');
    return true;
  }

  function installStyle(){
    if(document.getElementById('combat-balance-style')) return;
    const style=document.createElement('style');
    style.id='combat-balance-style';
    style.textContent=`
      .resonance-row span{transition:border-color .2s ease,box-shadow .2s ease,filter .2s ease,opacity .2s ease}
      .resonance-row span.resonance-active{opacity:1;filter:saturate(1.2) brightness(1.14);box-shadow:inset 0 0 16px currentColor,0 0 11px color-mix(in srgb,currentColor 34%,transparent)}
      .resonance-row span.resonance-active b{color:#fff;text-shadow:0 0 8px currentColor}
    `;
    document.head.appendChild(style);
  }

  function publishDiagnostics(){
    const slots=game.level.slots;
    const path=game.level.path;
    const nearestDistances=slots.map(slot=>nearestPathDistance(slot,path));
    const maximumNearestDistance=Math.max(...nearestDistances);
    window.__COMBAT_BALANCE_DIAGNOSTICS={
      version:1,
      world:{...WORLD},
      towerRanges:{...RANGE_BY_TYPE},
      maximumPlatformToPathDistance:maximumNearestDistance,
      minimumCoverageMargin:Object.fromEntries(Object.entries(RANGE_BY_TYPE).map(([type,range])=>[type,range-maximumNearestDistance])),
      resonancePolicy:'global nearest-pair links; distance does not disable resonance',
      links:links.map(link=>({type:link.type,fromSlot:link.from.slot,toSlot:link.to.slot,distance:link.distance})),
      counts:{...game.state.resonance},
      overlayReady:Boolean(overlay)
    };
  }

  function initialize(){
    game=window.__NEON_TEST__;
    if(!game?.state||!game?.towerTypes||!window.__RENDERED_MAP_READY) return false;
    applyTowerRanges();
    installStyle();
    if(!installOverlay()) return false;
    updateResonanceNetwork(true);
    window.__COMBAT_BALANCE__={
      ranges:{...RANGE_BY_TYPE},
      refresh:()=>updateResonanceNetwork(true),
      snapshot:()=>structuredClone(window.__COMBAT_BALANCE_DIAGNOSTICS)
    };
    requestAnimationFrame(render);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(initialize()||attempts>500) clearInterval(timer);
  },25);
})();
