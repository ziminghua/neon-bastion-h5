(() => {
  'use strict';
  const WORLD={width:1600,height:900};
  const RANGE_BY_TYPE={rail:240,cryo:225,plasma:215,arcane:265};
  const RESONANCE_RADIUS_BY_TYPE={rail:340,cryo:360,plasma:350,arcane:420};
  const TYPE_META={
    rail:{color:'#55e9ff',label:'RAILGUN'},
    cryo:{color:'#8eeaff',label:'CRYO'},
    plasma:{color:'#ffb55e',label:'PLASMA'},
    arcane:{color:'#e287ff',label:'ARCANE'}
  };
  const BADGES={
    cryo:{countId:'frostCount',label:'CRYO RESONANCE'},
    plasma:{countId:'energyCount',label:'ENERGY RESONANCE'},
    arcane:{countId:'arcaneCount',label:'ARCANE RESONANCE'}
  };
  let game=null;
  let overlay=null;
  let context=null;
  let links=[];
  let towerStacks=new Map();
  let guideState=null;
  let mergeOnlyInstalled=false;
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
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
  function canResonate(left,right,leftPosition,rightPosition){
    if(left.type===right.type) return false;
    const radius=Math.min(RESONANCE_RADIUS_BY_TYPE[left.type]||0,RESONANCE_RADIUS_BY_TYPE[right.type]||0);
    const edgeDistance=distance(leftPosition,rightPosition);
    return {active:edgeDistance<=radius,distance:edgeDistance,radius};
  }
  function buildCrossTypeNetwork(towers,now){
    const nodes=towers.map(tower=>({tower,position:towerPosition(tower,now)}));
    const candidates=[];
    for(let a=0;a<nodes.length-1;a+=1){
      for(let b=a+1;b<nodes.length;b+=1){
        const relation=canResonate(nodes[a].tower,nodes[b].tower,nodes[a].position,nodes[b].position);
        if(relation.active) candidates.push({a,b,distance:relation.distance,radius:relation.radius});
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
        radius:edge.radius
      });
    }
    const components=new Map();
    for(let index=0;index<nodes.length;index+=1){
      const root=find(index);
      const list=components.get(root)||[];
      list.push(nodes[index].tower);
      components.set(root,list);
    }
    const stacks=new Map();
    for(const component of components.values()){
      const uniqueTypes=new Set(component.map(tower=>tower.type));
      if(uniqueTypes.size<2) continue;
      const stack=uniqueTypes.size-1;
      component.forEach(tower=>stacks.set(tower,stack));
    }
    return {links:networkLinks,stacks};
  }
  function ensureIsolatedTowerDef(tower){
    if(tower.__crossTypeBaseDef) return tower.__crossTypeBaseDef;
    const base={
      damage:tower.def.damage,
      interval:tower.def.interval,
      range:tower.def.range,
      splash:tower.def.splash||0,
      chain:tower.def.chain||0,
      slow:tower.def.slow||0,
      slowDuration:tower.def.slowDuration||0
    };
    tower.__crossTypeBaseDef=base;
    tower.def={...tower.def};
    return base;
  }
  function applyTowerBonuses(){
    for(const tower of game.state.towers){
      const base=ensureIsolatedTowerDef(tower);
      const stack=towerStacks.get(tower)||0;
      tower.__resonanceStack=stack;
      tower.def.damage=base.damage*(1+.06*stack);
      tower.def.interval=tower.type==='rail'?base.interval/(1+.07*stack):base.interval;
      tower.def.range=base.range;
      tower.def.splash=base.splash;
      tower.def.chain=base.chain;
      tower.def.slow=base.slow;
      tower.def.slowDuration=base.slowDuration;
    }
  }
  function applyProjectileBonuses(){
    for(const projectile of game.state.projectiles||[]){
      if(projectile.__crossTypeResonanceChecked) continue;
      projectile.__crossTypeResonanceChecked=true;
      const stack=projectile.tower?towerStacks.get(projectile.tower)||0:0;
      projectile.__resonanceStack=stack;
      if(!stack) continue;
      if(projectile.type==='cryo'){
        projectile.slow=Math.min(.76,(projectile.slow||0)*(1+.12*stack));
        projectile.slowDuration=(projectile.slowDuration||0)+.28*stack;
      }else if(projectile.type==='plasma'){
        projectile.splash=(projectile.splash||0)*(1+.16*stack);
      }else if(projectile.type==='arcane'){
        projectile.chain=(projectile.chain||0)+stack;
      }
    }
  }
  function updateBadges(){
    for(const [type,badgeConfig] of Object.entries(BADGES)){
      const active=game.state.towers.some(tower=>tower.type===type&&(towerStacks.get(tower)||0)>0);
      const counter=document.getElementById(badgeConfig.countId);
      if(!counter) continue;
      counter.textContent='';
      counter.setAttribute('aria-hidden','true');
      const badge=counter.closest('span');
      badge?.classList.toggle('resonance-active',active);
      badge?.setAttribute('aria-label',active?`${badgeConfig.label} active`:`${badgeConfig.label} inactive`);
      badge?.setAttribute('title',active?`${badgeConfig.label} active in a mixed tower network`:'Overlap this tower with a different tower type');
    }
  }
  function updateResonanceNetwork(now=performance.now()){
    const network=buildCrossTypeNetwork(game.state.towers,now);
    links=network.links;
    towerStacks=network.stacks;
    game.state.resonance.frost=0;
    game.state.resonance.energy=0;
    game.state.resonance.arcane=0;
    applyTowerBonuses();
    applyProjectileBonuses();
    updateBadges();
    guideState=resolveGuide(now);
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
  function linkColors(link){
    return {
      from:TYPE_META[link.from.type]?.color||link.from.color||'#fff',
      to:TYPE_META[link.to.type]?.color||link.to.color||'#fff'
    };
  }
  function drawLink(link,now,preview=false){
    const from=preview?link.from:towerPosition(link.from,now);
    const to=preview?link.to:towerPosition(link.to,now);
    const {start,end,normal}=trimmedEndpoints(from,to,preview?20:34);
    const fromSlot=link.from.slot??0;
    const toSlot=link.to.slot??0;
    const bend=Math.min(26,link.distance*.05)*Math.sin((fromSlot+toSlot+1)*1.7);
    const control={x:(start.x+end.x)/2+normal.x*bend,y:(start.y+end.y)/2+normal.y*bend};
    const alpha=preview?.42:(game.state.waveActive?.34:.58);
    const colors=preview?{from:link.from.color,to:link.to.color}:linkColors(link);
    const gradient=context.createLinearGradient(start.x,start.y,end.x,end.y);
    gradient.addColorStop(0,colors.from);
    gradient.addColorStop(.5,'#ffffff');
    gradient.addColorStop(1,colors.to);
    context.save();
    context.globalCompositeOperation='screen';
    context.lineCap='round';
    context.globalAlpha=alpha*.28;
    context.strokeStyle=gradient;
    context.lineWidth=preview?6:9;
    context.shadowColor='#8eeaff';
    context.shadowBlur=preview?12:18;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();
    context.globalAlpha=alpha;
    context.strokeStyle=gradient;
    context.lineWidth=preview?1.5:2;
    context.setLineDash(preview?[6,8]:[12,9]);
    context.lineDashOffset=-(now*.04)%21;
    context.beginPath();
    context.moveTo(start.x,start.y);
    context.quadraticCurveTo(control.x,control.y,end.x,end.y);
    context.stroke();
    context.setLineDash([]);
    if(!preview){
      const pulseT=(now*.00024+(fromSlot+toSlot)*.13)%1;
      const pulse=quadraticPoint(start,control,end,pulseT);
      const glow=context.createRadialGradient(pulse.x,pulse.y,1,pulse.x,pulse.y,13);
      glow.addColorStop(0,'rgba(255,255,255,.98)');
      glow.addColorStop(.32,colors.to);
      glow.addColorStop(1,'rgba(0,0,0,0)');
      context.globalAlpha=.94;
      context.fillStyle=glow;
      context.beginPath();
      context.arc(pulse.x,pulse.y,13,0,Math.PI*2);
      context.fill();
    }
    context.restore();
  }
  function resolveGuide(now){
    const drag=game.state.drag?.moved?game.state.drag:null;
    if(drag&&RESONANCE_RADIUS_BY_TYPE[drag.tower.type]){
      return {type:drag.tower.type,position:towerPosition(drag.tower,now),tower:drag.tower,mode:'drag'};
    }
    const selected=game.state.selectedTower;
    if(selected&&RESONANCE_RADIUS_BY_TYPE[selected.type]){
      return {type:selected.type,position:towerPosition(selected,now),tower:selected,mode:'selected'};
    }
    const type=game.state.selectedBuild;
    if(type&&RESONANCE_RADIUS_BY_TYPE[type]){
      if(game.state.hoverSlot>=0){
        const slot=game.level.slots[game.state.hoverSlot];
        return {type,position:{x:slot.x,y:slot.y},tower:null,mode:'placement'};
      }
      return {type,position:null,tower:null,mode:'build'};
    }
    return null;
  }
  function drawRangeCircle(position,type,now,alpha=.34,stack=0){
    const radius=RESONANCE_RADIUS_BY_TYPE[type];
    const config=TYPE_META[type];
    const pulse=1+Math.sin(now*.0032)*.008;
    context.save();
    context.globalCompositeOperation='screen';
    context.translate(position.x,position.y);
    context.scale(pulse,pulse);
    context.globalAlpha=alpha*.1;
    context.fillStyle=config.color;
    context.beginPath();
    context.arc(0,0,radius,0,Math.PI*2);
    context.fill();
    context.globalAlpha=alpha;
    context.strokeStyle=config.color;
    context.shadowColor=config.color;
    context.shadowBlur=10;
    context.lineWidth=1.35;
    context.setLineDash([14,12]);
    context.lineDashOffset=-(now*.018)%26;
    context.beginPath();
    context.arc(0,0,radius,0,Math.PI*2);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha=Math.min(.78,alpha*1.6);
    context.fillStyle=config.color;
    context.font='800 11px sans-serif';
    context.textAlign='center';
    context.fillText(stack?`RESONANCE STACK ×${stack}`:'RESONANCE RANGE',0,-radius+20);
    context.restore();
  }
  function previewCandidate(position,type,tower,now){
    const otherPosition=towerPosition(tower,now);
    const pseudo={type};
    const relation=canResonate(pseudo,tower,position,otherPosition);
    if(!relation.active) return null;
    return {
      from:{x:position.x,y:position.y,slot:-1,color:TYPE_META[type].color,type},
      to:{x:otherPosition.x,y:otherPosition.y,slot:tower.slot,color:TYPE_META[tower.type].color,type:tower.type},
      distance:relation.distance,
      radius:relation.radius
    };
  }
  function drawGuide(now){
    if(!guideState) return;
    const type=guideState.type;
    if(!RESONANCE_RADIUS_BY_TYPE[type]) return;
    if(guideState.position){
      const stack=guideState.tower?towerStacks.get(guideState.tower)||0:0;
      drawRangeCircle(guideState.position,type,now,guideState.mode==='placement'?.48:.34,stack);
      if(guideState.mode!=='placement') return;
      const candidates=game.state.towers
        .filter(tower=>tower.type!==type)
        .map(tower=>previewCandidate(guideState.position,type,tower,now))
        .filter(Boolean)
        .sort((left,right)=>left.distance-right.distance)
        .slice(0,4);
      candidates.forEach(candidate=>drawLink(candidate,now,true));
      return;
    }
    return;
  }
  function installMergeOnlyProgression(){
    if(mergeOnlyInstalled) return;
    const button=document.getElementById('upgradeBtn');
    const actions=document.getElementById('towerActions');
    if(!button||!actions) return;
    mergeOnlyInstalled=true;
    const blockUpgrade=event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    };
    button.addEventListener('click',blockUpgrade,true);
    button.disabled=true;
    button.hidden=true;
    button.tabIndex=-1;
    button.setAttribute('aria-hidden','true');
    let note=actions.querySelector('.merge-upgrade-note');
    if(!note){
      note=document.createElement('div');
      note.className='merge-upgrade-note';
      note.innerHTML='<b>MERGE UPGRADE</b><small>Drag an identical tower of the same level onto this tower.</small>';
      actions.prepend(note);
    }
  }
  function render(now){
    updateResonanceNetwork(now);
    installMergeOnlyProgression();
    context.clearRect(0,0,WORLD.width,WORLD.height);
    links.forEach(link=>drawLink(link,now));
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
        position:'absolute',inset:'0',width:`${WORLD.width}px`,height:`${WORLD.height}px`,
        zIndex:'2',pointerEvents:'none'
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
      .resonance-row span:not(.resonance-active){opacity:.42}
      #upgradeBtn{display:none!important}
      .inspector-actions:has(.merge-upgrade-note){grid-template-columns:minmax(0,1fr) auto;align-items:stretch}
      .merge-upgrade-note{display:flex;min-width:0;flex-direction:column;justify-content:center;padding:7px 10px;border:1px solid rgba(255,213,105,.24);background:linear-gradient(135deg,rgba(82,58,16,.45),rgba(5,16,30,.86));clip-path:polygon(0 0,94% 0,100% 24%,100% 100%,6% 100%,0 76%)}
      .merge-upgrade-note b{color:#ffe38a;font-size:8px;letter-spacing:.16em}
      .merge-upgrade-note small{margin-top:4px;color:#8ca8b7;font-size:7px;line-height:1.25}
    `;
    document.head.appendChild(style);
  }
  function publishDiagnostics(){
    if(!game) return;
    const slots=game.level.slots;
    const path=game.level.path;
    const nearestDistances=slots.map(slot=>nearestPathDistance(slot,path));
    const maximumNearestDistance=Math.max(...nearestDistances);
    window.__COMBAT_BALANCE_DIAGNOSTICS={
      version:3,
      world:{...WORLD},
      towerRanges:{...RANGE_BY_TYPE},
      resonanceRanges:{...RESONANCE_RADIUS_BY_TYPE},
      maximumPlatformToPathDistance:maximumNearestDistance,
      minimumCoverageMargin:Object.fromEntries(Object.entries(RANGE_BY_TYPE).map(([type,range])=>[type,range-maximumNearestDistance])),
      resonancePolicy:'different tower types connect inside the smaller of their resonance radii; each additional unique type adds one stack',
      links:links.map(link=>({fromType:link.from.type,toType:link.to.type,fromSlot:link.from.slot,toSlot:link.to.slot,distance:link.distance,radius:link.radius})),
      towerStacks:game.state.towers.map(tower=>({type:tower.type,slot:tower.slot,level:tower.level,stack:towerStacks.get(tower)||0,damage:tower.def.damage,interval:tower.def.interval})),
      guide:guideState?{type:guideState.type,mode:guideState.mode,position:guideState.position?{...guideState.position}:null,radius:RESONANCE_RADIUS_BY_TYPE[guideState.type]}:null,
      mergeOnly:{installed:mergeOnlyInstalled,upgradeButtonHidden:Boolean(document.getElementById('upgradeBtn')?.hidden),upgradeButtonDisabled:Boolean(document.getElementById('upgradeBtn')?.disabled)},
      overlayReady:Boolean(overlay)
    };
  }
  function initialize(){
    game=window.__NEON_TEST__;
    if(!game?.state||!game?.towerTypes||!window.__RENDERED_MAP_READY) return false;
    applyTowerRanges();
    installStyle();
    installMergeOnlyProgression();
    if(!installOverlay()) return false;
    updateResonanceNetwork();
    window.__COMBAT_BALANCE__={
      ranges:{...RANGE_BY_TYPE},
      resonanceRanges:{...RESONANCE_RADIUS_BY_TYPE},
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
