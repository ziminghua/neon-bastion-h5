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
    cryo:{stateKey:'frost',countId:'frostCount',color:'#8eeaff',radius:360,label:'CRYO RESONANCE'},
    plasma:{stateKey:'energy',countId:'energyCount',color:'#ffb55e',radius:350,label:'ENERGY RESONANCE'},
    arcane:{stateKey:'arcane',countId:'arcaneCount',color:'#e287ff',radius:420,label:'ARCANE RESONANCE'}
  };

  let game=null;
  let overlay=null;
  let context=null;
  let links=[];
  let activeTowersByType={cryo:new Set(),plasma:new Set(),arcane:new Set()};
  let guideState=null;

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

  function towerPosition(tower,now=performance.now()){
    if(game.state.drag?.tower===tower&&game.state.drag.moved){
      return {x:game.state.drag.x,y:game.state.drag.y-18};
    }
    if(tower.motion){
      const raw=Math.max(0,Math.min(1,(now-tower.motion.start)/tower.motion.duration));
      const eased=1-Math.pow(1-raw,3);
      return {
        x:tower.motion.fromX+(tower.motion.toX-tower.motion.fromX)*eased,
        y:tower.motion.fromY+(tower.motion.toY-tower.motion.fromY)*eased-Math.sin(raw*Math.PI)*2.5
      };
    }
    const slot=game.level.slots[tower.slot];
    return {x:slot.x,y:slot.y};
  }

  function buildRangeNetwork(towers,radius,now){
    const nodes=towers.map(tower=>({tower,position:towerPosition(tower,now)}));
    const candidates=[];
    for(let a=0;a<nodes.length-1;a+=1){
      for(let b=a+1;b<nodes.length;b+=1){
        const edgeDistance=distance(nodes[a].position,nodes[b].position);
        if(edgeDistance<=radius){
          candidates.push({a,b,distance:edgeDistance});
        }
      }
    }
    candidates.sort((left,right)=>left.distance-right.distance);

    const parent=nodes.map((_,index)=>index);
    const find=index=>{
      let cursor=index;
      while(parent[cursor]!==cursor){
        parent[cursor]=parent[parent[cursor]];
        cursor=parent[cursor];
      }
      return cursor;
    };
    const union=(a,b)=>{
      const rootA=find(a);
      const rootB=find(b);
      if(rootA===rootB) return false;
      parent[rootB]=rootA;
      return true;
    };

    const networkLinks=[];
    for(const edge of candidates){
      if(!union(edge.a,edge.b)) continue;
      networkLinks.push({
        from:nodes[edge.a].tower,
        to:nodes[edge.b].tower,
        distance:edge.distance,
        radius
      });
    }

    const components=new Map();
    for(let index=0;index<nodes.length;index+=1){
      const root=find(index);
      const list=components.get(root)||[];
      list.push(nodes[index].tower);
      components.set(root,list);
    }

    const active=new Set();
    let levels=0;
    for(const component of components.values()){
      if(component.length<2) continue;
      levels+=Math.floor(component.length/2);
      component.forEach(tower=>active.add(tower));
    }

    return {links:networkLinks,active,levels};
  }

  function updateBadge(type,config,activeCount){
    const counter=document.getElementById(config.countId);
    if(!counter) return;
    counter.textContent='';
    counter.setAttribute('aria-hidden','true');
    const badge=counter.closest('span');
    badge?.classList.toggle('resonance-active',activeCount>0);
    badge?.setAttribute('aria-label',activeCount?`${config.label} active`:`${config.label} inactive`);
    badge?.setAttribute('title',activeCount?`${config.label} active within ${config.radius}px`:`Place matching towers within the resonance range`);
  }

  function updateResonanceNetwork(now=performance.now()){
    links=[];
    activeTowersByType={cryo:new Set(),plasma:new Set(),arcane:new Set()};

    for(const [type,config] of Object.entries(RESONANCE_TYPES)){
      const towers=game.state.towers.filter(tower=>tower.type===type);
      const network=buildRangeNetwork(towers,config.radius,now);
      game.state.resonance[config.stateKey]=network.levels;
      activeTowersByType[type]=network.active;
      links.push(...network.links.map(link=>({type,color:config.color,...link})));
      updateBadge(type,config,network.active.size);
    }

    applyCryoResonanceBonus();
    guideState=resolveGuide(now);
    publishDiagnostics();
  }

  function applyCryoResonanceBonus(){
    const active=activeTowersByType.cryo;
    const level=Math.max(1,game.state.resonance.frost||0);
    for(const projectile of game.state.projectiles||[]){
      if(projectile.type!=='cryo'||projectile.__spatialResonanceChecked) continue;
      projectile.__spatialResonanceChecked=true;
      if(!projectile.tower||!active.has(projectile.tower)) continue;
      projectile.slow=Math.min(.72,(projectile.slow||0)*(1+.12*level));
      projectile.slowDuration=(projectile.slowDuration||0)+.28*level;
      projectile.__spatialResonanceActive=true;
    }
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

  function drawLink(link,now,preview=false){
    const from=preview?link.from:towerPosition(link.from,now);
    const to=preview?link.to:towerPosition(link.to,now);
    const {start,end,normal}=trimmedEndpoints(from,to,preview?20:34);
    const bend=Math.min(28,link.distance*.055)*Math.sin(((link.from.slot??0)+(link.to.slot??0)+1)*1.7);
    const control={x:(start.x+end.x)/2+normal.x*bend,y:(start.y+end.y)/2+normal.y*bend};
    const activeAlpha=preview?.34:(game.state.waveActive?.28:.48);

    context.save();
    context.globalCompositeOperation='screen';
    context.lineCap='round';

    context.globalAlpha=activeAlpha*.34;
    context.strokeStyle=link.color;
    context.lineWidth=preview?5:8;
    context.shadowColor=link.color;
    context.shadowBlur=preview?12:18;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();

    context.globalAlpha=activeAlpha;
    context.lineWidth=preview?1.4:1.8;
    context.setLineDash(preview?[6,8]:[12,10]);
    context.lineDashOffset=-(now*.035)%22;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();
    context.setLineDash([]);

    if(!preview){
      const pulseT=(now*.00022+((link.from.slot??0)+(link.to.slot??0))*.13)%1;
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
    }
    context.restore();
  }

  function resolveGuide(now){
    const drag=game.state.drag?.moved?game.state.drag:null;
    if(drag&&RESONANCE_TYPES[drag.tower.type]){
      return {
        type:drag.tower.type,
        position:towerPosition(drag.tower,now),
        tower:drag.tower,
        mode:'drag'
      };
    }

    const selected=game.state.selectedTower;
    if(selected&&RESONANCE_TYPES[selected.type]){
      return {
        type:selected.type,
        position:towerPosition(selected,now),
        tower:selected,
        mode:'selected'
      };
    }

    const type=game.state.selectedBuild;
    if(type&&RESONANCE_TYPES[type]){
      if(game.state.hoverSlot>=0){
        const slot=game.level.slots[game.state.hoverSlot];
        return {type,position:{x:slot.x,y:slot.y},tower:null,mode:'placement'};
      }
      return {type,position:null,tower:null,mode:'build'};
    }

    return null;
  }

  function drawRangeCircle(position,config,now,alpha=.34){
    const pulse=1+Math.sin(now*.0032)*.008;
    context.save();
    context.globalCompositeOperation='screen';
    context.translate(position.x,position.y);
    context.scale(pulse,pulse);

    context.globalAlpha=alpha*.12;
    context.fillStyle=config.color;
    context.beginPath();
    context.arc(0,0,config.radius,0,Math.PI*2);
    context.fill();

    context.globalAlpha=alpha;
    context.strokeStyle=config.color;
    context.shadowColor=config.color;
    context.shadowBlur=10;
    context.lineWidth=1.35;
    context.setLineDash([14,12]);
    context.lineDashOffset=-(now*.018)%26;
    context.beginPath();
    context.arc(0,0,config.radius,0,Math.PI*2);
    context.stroke();
    context.setLineDash([]);

    context.globalAlpha=Math.min(.72,alpha*1.5);
    context.fillStyle=config.color;
    context.font='800 11px sans-serif';
    context.textAlign='center';
    context.fillText('RESONANCE RANGE',0,-config.radius+20);
    context.restore();
  }

  function drawGuide(now){
    if(!guideState) return;
    const config=RESONANCE_TYPES[guideState.type];
    if(!config) return;

    if(guideState.position){
      drawRangeCircle(guideState.position,config,now,guideState.mode==='placement'?.48:.34);
      if(guideState.mode!=='placement') return;
      const candidates=game.state.towers
        .filter(tower=>tower.type===guideState.type&&tower!==guideState.tower)
        .map(tower=>({tower,position:towerPosition(tower,now)}))
        .map(entry=>({...entry,distance:distance(guideState.position,entry.position)}))
        .filter(entry=>entry.distance<=config.radius)
        .sort((left,right)=>left.distance-right.distance)
        .slice(0,3);
      for(const candidate of candidates){
        drawLink({
          from:{x:guideState.position.x,y:guideState.position.y,slot:-1},
          to:{x:candidate.position.x,y:candidate.position.y,slot:candidate.tower.slot},
          distance:candidate.distance,
          color:config.color
        },now,true);
      }
      return;
    }

    for(const tower of game.state.towers.filter(tower=>tower.type===guideState.type)){
      drawRangeCircle(towerPosition(tower,now),config,now,.18);
    }
  }

  function render(now){
    updateResonanceNetwork(now);
    context.clearRect(0,0,WORLD.width,WORLD.height);
    for(const link of links) drawLink(link,now);
    drawGuide(now);
    requestAnimationFrame(render);
  }

  function installOverlay(){
    const shell=document.getElementById('game-shell');
    if(!shell) return false;
    overlay=document.getElementById('resonance-link-overlay');
    if(!overlay){
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
        zIndex:'2',
        pointerEvents:'none'
      });
      shell.appendChild(overlay);
    }
    context=overlay.getContext('2d');
    return Boolean(context);
  }

  function installStyle(){
    if(document.getElementById('combat-balance-style')) return;
    const style=document.createElement('style');
    style.id='combat-balance-style';
    style.textContent=`
      .resonance-row b{display:none!important}
      .resonance-row span{transition:border-color .2s ease,box-shadow .2s ease,filter .2s ease,opacity .2s ease}
      .resonance-row span.resonance-active{opacity:1;filter:saturate(1.2) brightness(1.14);box-shadow:inset 0 0 16px currentColor,0 0 11px color-mix(in srgb,currentColor 34%,transparent)}
      .resonance-row span:not(.resonance-active){opacity:.5}
    `;
    document.head.appendChild(style);
  }

  function publishDiagnostics(){
    const slots=game.level.slots;
    const path=game.level.path;
    const nearestDistances=slots.map(slot=>nearestPathDistance(slot,path));
    const maximumNearestDistance=Math.max(...nearestDistances);
    window.__COMBAT_BALANCE_DIAGNOSTICS={
      version:2,
      world:{...WORLD},
      towerRanges:{...RANGE_BY_TYPE},
      resonanceRanges:Object.fromEntries(Object.entries(RESONANCE_TYPES).map(([type,config])=>[type,config.radius])),
      maximumPlatformToPathDistance:maximumNearestDistance,
      minimumCoverageMargin:Object.fromEntries(Object.entries(RANGE_BY_TYPE).map(([type,range])=>[type,range-maximumNearestDistance])),
      resonancePolicy:'same-type towers connect only when their centers are within the type resonance radius; range exceeds attack range',
      links:links.map(link=>({type:link.type,fromSlot:link.from.slot,toSlot:link.to.slot,distance:link.distance,radius:link.radius})),
      activeTowerSlots:Object.fromEntries(Object.entries(activeTowersByType).map(([type,towers])=>[type,[...towers].map(tower=>tower.slot).sort((a,b)=>a-b)])),
      counts:{...game.state.resonance},
      guide:guideState?{type:guideState.type,mode:guideState.mode,position:guideState.position?{...guideState.position}:null,radius:RESONANCE_TYPES[guideState.type].radius}:null,
      overlayReady:Boolean(overlay)
    };
  }

  function initialize(){
    game=window.__NEON_TEST__;
    if(!game?.state||!game?.towerTypes||!window.__RENDERED_MAP_READY) return false;
    applyTowerRanges();
    installStyle();
    if(!installOverlay()) return false;
    updateResonanceNetwork();
    window.__COMBAT_BALANCE__={
      ranges:{...RANGE_BY_TYPE},
      resonanceRanges:Object.fromEntries(Object.entries(RESONANCE_TYPES).map(([type,config])=>[type,config.radius])),
      refresh:()=>updateResonanceNetwork(),
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
