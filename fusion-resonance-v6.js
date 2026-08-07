(() => {
  'use strict';

  const BUILD='fusion-network-v6-20260807';
  const WORLD={width:1600,height:900};
  const RANGES={rail:240,cryo:225,plasma:215,arcane:265};
  const RADII={rail:340,cryo:360,plasma:350,arcane:420};
  const META={
    rail:{color:'#55e9ff',label:'RAILGUN'},
    cryo:{color:'#8eeaff',label:'CRYO'},
    plasma:{color:'#ffb55e',label:'PLASMA'},
    arcane:{color:'#e287ff',label:'ARCANE'}
  };
  const COMBOS={
    'cryo|rail':'SUPERCONDUCTOR',
    'plasma|rail':'OVERLOAD BURST',
    'arcane|rail':'PHASE CONDUIT',
    'cryo|plasma':'THERMAL SHOCK',
    'arcane|plasma':'VOID FLAME',
    'arcane|cryo':'STASIS WEB'
  };

  let game=null;
  let overlay=null;
  let ctx=null;
  let links=[];
  let partners=new Map();
  let diversity=new Map();
  let projectileChannelInstalled=false;
  let beamChannelInstalled=false;

  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const pairKey=(a,b)=>[a,b].sort().join('|');

  function towerPosition(tower,now=performance.now()){
    const drag=game.state.drag;
    if(drag?.moved&&drag.tower===tower) return {x:drag.x,y:drag.y-18};
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

  function relation(left,right,leftPosition,rightPosition){
    if(left.type===right.type){
      return {active:false,leftActive:false,rightActive:false,distance:Infinity,leftRadius:0,rightRadius:0,radius:0};
    }
    const leftRadius=RADII[left.type]||0;
    const rightRadius=RADII[right.type]||0;
    const value=distance(leftPosition,rightPosition);
    const leftActive=value<=leftRadius;
    const rightActive=value<=rightRadius;
    return {
      active:leftActive||rightActive,
      leftActive,
      rightActive,
      distance:value,
      leftRadius,
      rightRadius,
      radius:Math.max(leftRadius,rightRadius)
    };
  }

  function buildNetwork(now=performance.now()){
    const towers=game.state.towers;
    const nodes=towers.map(tower=>({tower,position:towerPosition(tower,now)}));
    const nextLinks=[];
    const nextPartners=new Map(towers.map(tower=>[tower,[]]));

    for(let left=0;left<nodes.length-1;left+=1){
      for(let right=left+1;right<nodes.length;right+=1){
        const leftNode=nodes[left];
        const rightNode=nodes[right];
        const edge=relation(leftNode.tower,rightNode.tower,leftNode.position,rightNode.position);
        if(!edge.active) continue;
        const link={
          from:leftNode.tower,
          to:rightNode.tower,
          distance:edge.distance,
          radius:edge.radius,
          fromRadius:edge.leftRadius,
          toRadius:edge.rightRadius,
          fromReceives:edge.leftActive,
          toReceives:edge.rightActive,
          mutual:edge.leftActive&&edge.rightActive,
          combo:pairKey(leftNode.tower.type,rightNode.tower.type)
        };
        nextLinks.push(link);
        if(edge.leftActive) nextPartners.get(link.from).push(link.to);
        if(edge.rightActive) nextPartners.get(link.to).push(link.from);
      }
    }
    nextLinks.sort((a,b)=>a.distance-b.distance);

    const adjacency=new Map(towers.map(tower=>[tower,[]]));
    for(const link of nextLinks){
      adjacency.get(link.from).push(link.to);
      adjacency.get(link.to).push(link.from);
    }
    const nextDiversity=new Map();
    const visited=new Set();
    for(const tower of towers){
      if(visited.has(tower)) continue;
      const queue=[tower];
      const component=[];
      visited.add(tower);
      while(queue.length){
        const current=queue.shift();
        component.push(current);
        for(const partner of adjacency.get(current)||[]){
          if(visited.has(partner)) continue;
          visited.add(partner);
          queue.push(partner);
        }
      }
      const uniqueTypes=new Set(component.map(item=>item.type)).size;
      component.forEach(item=>nextDiversity.set(item,uniqueTypes));
    }

    links=nextLinks;
    partners=nextPartners;
    diversity=nextDiversity;
  }

  function baseDef(tower){
    if(tower.__fusionBaseDef) return tower.__fusionBaseDef;
    const source=tower.def;
    tower.__fusionBaseDef={
      damage:source.damage,
      interval:source.interval,
      range:source.range,
      splash:source.splash||0,
      chain:source.chain||0,
      slow:source.slow||0,
      slowDuration:source.slowDuration||0
    };
    tower.def={...tower.def};
    return tower.__fusionBaseDef;
  }

  function profile(tower){
    const nearby=partners.get(tower)||[];
    const counts={rail:0,cryo:0,plasma:0,arcane:0};
    nearby.forEach(item=>{counts[item.type]+=1;});
    const combos=Object.entries(counts)
      .filter(([,count])=>count>0)
      .map(([type,count])=>({type,count,key:pairKey(tower.type,type),name:COMBOS[pairKey(tower.type,type)]}));
    return {counts,partners:[...nearby],linkCount:nearby.length,combos,diversity:diversity.get(tower)||1};
  }

  function normalizeTowers(){
    game.state.resonance.frost=0;
    game.state.resonance.energy=0;
    game.state.resonance.arcane=0;
    for(const tower of game.state.towers){
      const base=baseDef(tower);
      const fusion=profile(tower);
      tower.__fusionProfile=fusion;
      tower.__resonancePartners=fusion.partners;
      tower.__resonanceStack=fusion.linkCount;
      tower.__activeFusionNames=fusion.combos.map(combo=>combo.name).filter(Boolean);
      tower.def.damage=base.damage;
      tower.def.interval=base.interval;
      tower.def.range=base.range;
      tower.def.splash=base.splash;
      tower.def.chain=base.chain;
      tower.def.slow=base.slow;
      tower.def.slowDuration=base.slowDuration;
    }
  }

  function nearbyEnemies(position,exclude,radius){
    return (game.state.enemies||[])
      .filter(enemy=>enemy&&!enemy.dead&&enemy!==exclude)
      .map(enemy=>({enemy,position:game.pathPoint(enemy.progress)}))
      .filter(item=>distance(position,item.position)<=radius)
      .sort((a,b)=>distance(position,a.position)-distance(position,b.position));
  }

  function addRing(position,color,from,to,life=.3,width=3){
    game.state.rings.push({x:position.x,y:position.y,color,from,to,life,max:life,width});
  }

  function addRune(position,color,life=.45,scale=.75){
    game.state.runes.push({x:position.x,y:position.y,color,life,max:life,scale,rot:Math.random()*Math.PI});
  }

  function addBeam(from,to,color,life=.22,width=3,visual='arcane'){
    const arcaneVisual=visual==='arcane';
    game.state.beams.push({
      kind:arcaneVisual?'arcane':'fusion',x1:from.x,y1:from.y,x2:to.x,y2:to.y,color,
      life,max:life,width,zigzag:arcaneVisual,seed:Math.random()*99,__fusionVisual:true,__fusionVisualFamily:visual
    });
  }

  function emptyTrail(){
    return {length:0,push(){return 0;},shift(){return undefined;},forEach(){}};
  }

  function applySlow(enemy,factor,duration,frost=.18){
    if(!enemy||enemy.dead) return;
    enemy.slow=Math.max(enemy.slow||0,duration);
    enemy.slowFactor=Math.min(enemy.slowFactor||1,factor);
    enemy.frost=Math.min(1,(enemy.frost||0)+frost);
  }

  function spawnFusionProjectile(type,from,target,damage,tower,extras={}){
    if(!target||target.dead) return;
    const base=tower?.__fusionBaseDef||tower?.def||{};
    game.state.projectiles.push({
      type,x:from.x,y:from.y,target,damage:Math.max(0,damage),
      speed:extras.speed||920,
      color:META[type]?.color||extras.color||'#fff',
      splash:extras.splash??(type==='plasma'?Math.min(46,base.splash||46):0),
      slow:extras.slow??(type==='cryo'?.28:0),
      slowDuration:extras.slowDuration??(type==='cryo'?1.05:0),
      chain:extras.chain||0,
      tower,trail:extras.hiddenTrail?emptyTrail():[],spin:Math.random()*Math.PI*2,
      __fusionGenerated:true,
      __crossTypeResonanceChecked:true,
      __fusionName:extras.name||'FUSION',
      __fusionVisualFamily:extras.visualFamily||type
    });
  }

  function thermalShock(position,target,count){
    const radius=96+Math.min(3,count)*16;
    addRing(position,'#ffb55e',12,radius,.42,5);
    addRing(position,'#9cecff',18,radius*.78,.36,2);
    const affected=[{enemy:target,position},...nearbyEnemies(position,target,radius)];
    for(const {enemy} of affected){
      applySlow(enemy,.64,1.05+.12*Math.min(3,count),.2);
      if(enemy?.shield>0&&enemy.maxShield){
        enemy.shield=Math.max(0,enemy.shield-enemy.maxShield*Math.min(.3,.1*count));
      }
    }
  }

  function stasisWeb(position,target,count){
    const radius=118+Math.min(3,count)*14;
    const affected=nearbyEnemies(position,target,radius).slice(0,2+Math.min(3,count));
    addRing(position,'#c58cff',10,radius,.42,3);
    affected.forEach(({enemy,position:enemyPosition},index)=>{
      applySlow(enemy,.56,1.15+.1*count,.32);
      addBeam(position,enemyPosition,index%2?'#9cecff':'#d782ff',.24,3,'arcane');
      addRune(enemyPosition,'#b986ff',.4,.65);
    });
  }

  function triggerProjectileFusion(projectile,position){
    if(!projectile||projectile.__fusionGenerated||!projectile.tower) return;
    const fusion=projectile.__fusionProfile||projectile.tower.__fusionProfile||profile(projectile.tower);
    const counts=fusion.counts||{};
    const target=projectile.target;

    if(projectile.type==='plasma'){
      if(counts.rail){
        const targets=nearbyEnemies(position,target,175).slice(0,Math.min(3,counts.rail));
        targets.forEach(({enemy,position:enemyPosition},index)=>{
          addBeam(position,enemyPosition,'#72efff',.24,3.5,'overload');
          spawnFusionProjectile('overload',position,enemy,projectile.damage*(.1+.015*index),projectile.tower,{
            speed:1080,name:'OVERLOAD BURST',hiddenTrail:true,visualFamily:'overload',color:'#72efff'
          });
        });
        applySlow(target,.72,.38,.04);
        addRing(position,'#6fefff',8,74,.28,3);
      }
      if(counts.cryo) thermalShock(position,target,counts.cryo);
      if(counts.arcane){
        const targets=nearbyEnemies(position,target,155).slice(0,Math.min(2,counts.arcane));
        targets.forEach(({enemy})=>spawnFusionProjectile('arcane',position,enemy,projectile.damage*.08,projectile.tower,{speed:820,chain:1,name:'VOID FLAME',visualFamily:'void'}));
        addRune(position,'#e287ff',.58,1.05);
      }
    }

    if(projectile.type==='cryo'){
      if(counts.rail){
        const targets=nearbyEnemies(position,target,150).slice(0,Math.min(3,counts.rail));
        targets.forEach(({enemy})=>spawnFusionProjectile('cryo',position,enemy,0,projectile.tower,{
          speed:980,slow:Math.max(.24,(projectile.slow||.3)*.72),slowDuration:1.05,name:'SUPERCONDUCTOR',visualFamily:'superconductor'
        }));
        addRing(position,'#5fe8ff',8,70,.3,2);
      }
      if(counts.plasma) thermalShock(position,target,counts.plasma);
      if(counts.arcane) stasisWeb(position,target,counts.arcane);
    }

    if(projectile.type==='arcane'){
      if(counts.cryo) stasisWeb(position,target,counts.cryo);
      if(counts.plasma){
        const targets=nearbyEnemies(position,target,145).slice(0,Math.min(2,counts.plasma));
        targets.forEach(({enemy})=>spawnFusionProjectile('plasma',position,enemy,projectile.damage*.08,projectile.tower,{speed:760,splash:42,name:'VOID FLAME',visualFamily:'void'}));
        addRing(position,'#ff8b62',10,60,.32,3);
      }
    }
  }

  function tagProjectile(projectile){
    if(!projectile||projectile.__fusionTagged) return;
    projectile.__fusionTagged=true;
    if(projectile.__fusionGenerated) return;
    const tower=projectile.tower;
    if(!tower) return;
    const base=baseDef(tower);
    const fusion=tower.__fusionProfile||profile(tower);
    projectile.__fusionProfile={counts:{...fusion.counts},linkCount:fusion.linkCount,combos:fusion.combos.map(combo=>({...combo}))};
    projectile.__crossTypeResonanceChecked=true;
    projectile.slow=(base.slow||0)*(game.state.mods?.cryoSlow||1);
    projectile.slowDuration=base.slowDuration||0;
    projectile.splash=base.splash||0;
    projectile.chain=(base.chain||0)+(game.state.mods?.arcaneChain||0);
    if(projectile.type==='arcane'&&fusion.counts.rail){
      projectile.chain+=Math.min(3,fusion.counts.rail);
      projectile.__fusionName='PHASE CONDUIT';
    }
  }

  function normalizeProjectiles(){
    for(const projectile of game.state.projectiles||[]){
      if(!projectile.__fusionTagged) tagProjectile(projectile);
      if(projectile.__fusionGenerated||!projectile.tower) continue;
      const base=baseDef(projectile.tower);
      const fusion=projectile.__fusionProfile||projectile.tower.__fusionProfile||profile(projectile.tower);
      projectile.__crossTypeResonanceChecked=true;
      projectile.slow=(base.slow||0)*(game.state.mods?.cryoSlow||1);
      projectile.slowDuration=base.slowDuration||0;
      projectile.splash=base.splash||0;
      projectile.chain=(base.chain||0)+(game.state.mods?.arcaneChain||0)+(projectile.type==='arcane'?Math.min(3,fusion.counts.rail||0):0);
    }
  }

  function wasImpact(projectile){
    if(!projectile?.target||!projectile.dead) return false;
    return distance(projectile,game.pathPoint(projectile.target.progress))<=72;
  }

  function wrapProjectiles(array){
    if(array?.__fusionProxy) return array;
    const target=Array.isArray(array)?array:[];
    target.forEach(tagProjectile);
    return new Proxy(target,{
      get(source,property,receiver){
        if(property==='__fusionProxy') return true;
        if(property==='push') return (...items)=>{
          items.forEach(tagProjectile);
          return Array.prototype.push.apply(source,items);
        };
        return Reflect.get(source,property,receiver);
      }
    });
  }

  function installProjectileChannel(){
    if(projectileChannelInstalled) return;
    let current=wrapProjectiles(game.state.projectiles||[]);
    Object.defineProperty(game.state,'projectiles',{
      configurable:true,enumerable:true,
      get(){return current;},
      set(next){
        const nextArray=Array.isArray(next)?next:[];
        const nextSet=new Set(nextArray);
        const removed=[];
        for(const projectile of current){if(!nextSet.has(projectile)) removed.push(projectile);}
        current=wrapProjectiles(nextArray);
        for(const projectile of removed){
          if(wasImpact(projectile)) triggerProjectileFusion(projectile,game.pathPoint(projectile.target.progress));
        }
      }
    });
    projectileChannelInstalled=true;
  }

  function nearestTower(point,type){
    let best=null;
    let bestDistance=Infinity;
    for(const tower of game.state.towers){
      if(type&&tower.type!==type) continue;
      const value=distance(point,towerPosition(tower));
      if(value<bestDistance){bestDistance=value;best=tower;}
    }
    return bestDistance<=82?best:null;
  }

  function nearestEnemy(point){
    let best=null;
    let bestDistance=Infinity;
    for(const enemy of game.state.enemies||[]){
      if(enemy.dead) continue;
      const value=distance(point,game.pathPoint(enemy.progress));
      if(value<bestDistance){bestDistance=value;best=enemy;}
    }
    return bestDistance<=72?best:null;
  }

  function triggerRailFusion(beam){
    const tower=nearestTower({x:beam.x1,y:beam.y1},'rail');
    const target=nearestEnemy({x:beam.x2,y:beam.y2});
    if(!tower||!target) return;
    const fusion=tower.__fusionProfile||profile(tower);
    const counts=fusion.counts;
    const position=game.pathPoint(target.progress);
    const damage=baseDef(tower).damage*Math.pow(1.62,tower.level-1)*(game.state.mods?.damage?.rail||1);

    if(counts.plasma){
      applySlow(target,.76,.34,.03);
      addRing(position,'#ffae5e',6,52,.24,3);
    }
    if(counts.cryo){
      applySlow(target,.63,.62+.08*Math.min(3,counts.cryo),.22);
      addRing(position,'#a4f3ff',6,50,.26,2);
    }
    if(counts.arcane){
      const targets=nearbyEnemies(position,target,165).slice(0,Math.min(3,counts.arcane));
      targets.forEach(({enemy,position:enemyPosition})=>{
        addBeam(position,enemyPosition,'#d782ff',.2,3,'arcane');
        spawnFusionProjectile('arcane',position,enemy,damage*.08,tower,{speed:1120,name:'PHASE CONDUIT',visualFamily:'phase'});
      });
      addRune(position,'#df75ff',.42,.7);
    }
  }

  function wrapBeams(array){
    if(array?.__fusionBeamProxy) return array;
    const target=Array.isArray(array)?array:[];
    return new Proxy(target,{
      get(source,property,receiver){
        if(property==='__fusionBeamProxy') return true;
        if(property==='push') return (...items)=>{
          items.forEach(item=>{if(item?.kind==='rail'&&!item.__fusionVisual) triggerRailFusion(item);});
          return Array.prototype.push.apply(source,items);
        };
        return Reflect.get(source,property,receiver);
      }
    });
  }

  function installBeamChannel(){
    if(beamChannelInstalled) return;
    let current=wrapBeams(game.state.beams||[]);
    Object.defineProperty(game.state,'beams',{
      configurable:true,enumerable:true,
      get(){return current;},
      set(next){current=wrapBeams(next);}
    });
    beamChannelInstalled=true;
  }

  function updateBadges(){
    const badgeByType={cryo:'frostCount',plasma:'energyCount',arcane:'arcaneCount'};
    for(const [type,id] of Object.entries(badgeByType)){
      const counter=document.getElementById(id);
      if(!counter) continue;
      const activeTowers=game.state.towers.filter(tower=>tower.type===type&&(partners.get(tower)||[]).length>0);
      const active=activeTowers.length>0;
      const names=[...new Set(activeTowers.flatMap(tower=>(tower.__fusionProfile||profile(tower)).combos.map(combo=>combo.name).filter(Boolean)))];
      counter.textContent='';
      counter.setAttribute('aria-hidden','true');
      const badge=counter.closest('span');
      badge?.classList.toggle('resonance-active',active);
      badge?.setAttribute('title',active?`Active fusion abilities: ${names.join(' + ')}`:'Place a different tower type inside this tower fusion range');
    }
  }

  function guideState(now=performance.now()){
    const drag=game.state.drag?.moved?game.state.drag:null;
    if(drag) return {type:drag.tower.type,position:towerPosition(drag.tower,now),tower:drag.tower,mode:'drag'};
    if(game.state.selectedTower) return {type:game.state.selectedTower.type,position:towerPosition(game.state.selectedTower,now),tower:game.state.selectedTower,mode:'selected'};
    if(game.state.selectedBuild&&game.state.hoverSlot>=0){
      const slot=game.level.slots[game.state.hoverSlot];
      return {type:game.state.selectedBuild,position:{x:slot.x,y:slot.y},tower:null,mode:'placement'};
    }
    return game.state.selectedBuild?{type:game.state.selectedBuild,position:null,tower:null,mode:'build'}:null;
  }

  function drawComboBadges(guide,fusion){
    if(!guide?.tower||!fusion?.combos?.length) return;
    const combos=fusion.combos.filter(combo=>combo.name);
    const rowHeight=19;
    const startY=guide.position.y+48;
    ctx.save();
    ctx.font='800 9px sans-serif';
    ctx.textAlign='center';
    combos.forEach((combo,index)=>{
      const label=`${combo.name}${combo.count>1?` ×${combo.count}`:''}`;
      const width=Math.max(86,Math.ceil(ctx.measureText(label).width)+20);
      const x=guide.position.x-width/2;
      const y=startY+index*rowHeight;
      const color=META[combo.type]?.color||'#fff';
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=.88;
      ctx.fillStyle='rgba(2,9,18,.88)';
      ctx.strokeStyle=color;
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.roundRect(x,y,width,15,7);
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=.9;
      ctx.fillStyle=color;
      ctx.fillText(label,guide.position.x,y+11);
    });
    ctx.restore();
  }

  function drawGuide(now){
    const guide=guideState(now);
    if(!guide?.position) return guide;
    const radius=RADII[guide.type];
    const color=META[guide.type].color;
    const fusion=guide.tower?(guide.tower.__fusionProfile||profile(guide.tower)):null;
    const count=fusion?.linkCount||0;
    const abilityCount=fusion?.combos?.length||0;
    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=.035;
    ctx.fillStyle=color;
    ctx.beginPath();ctx.arc(guide.position.x,guide.position.y,radius,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.34;
    ctx.strokeStyle=color;
    ctx.shadowColor=color;
    ctx.shadowBlur=10;
    ctx.lineWidth=1.35;
    ctx.setLineDash([14,12]);
    ctx.lineDashOffset=-(now*.018)%26;
    ctx.beginPath();ctx.arc(guide.position.x,guide.position.y,radius,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur=0;
    ctx.globalAlpha=.72;
    ctx.fillStyle=color;
    ctx.font='800 11px sans-serif';
    ctx.textAlign='center';
    ctx.fillText(count?`${abilityCount} FUSION${abilityCount===1?'':'S'} · ${count} LINK${count===1?'':'S'}`:'FUSION RANGE',guide.position.x,guide.position.y-radius+20);
    ctx.restore();

    if(guide.mode==='selected'||guide.mode==='drag') drawComboBadges(guide,fusion);

    if(guide.mode==='placement'){
      const candidates=game.state.towers
        .filter(tower=>tower.type!==guide.type)
        .map(tower=>({tower,position:towerPosition(tower,now)}))
        .map(item=>({...item,distance:distance(guide.position,item.position)}))
        .filter(item=>item.distance<=radius);
      for(const item of candidates){
        const gradient=ctx.createLinearGradient(guide.position.x,guide.position.y,item.position.x,item.position.y);
        gradient.addColorStop(0,color);gradient.addColorStop(.5,'#fff');gradient.addColorStop(1,META[item.tower.type].color);
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.58;ctx.strokeStyle=gradient;ctx.lineWidth=2;ctx.setLineDash([7,8]);ctx.lineDashOffset=-(now*.04)%15;
        ctx.beginPath();ctx.moveTo(guide.position.x,guide.position.y);ctx.lineTo(item.position.x,item.position.y);ctx.stroke();ctx.restore();
      }
    }
    return guide;
  }

  function publish(guide){
    const previous=window.__COMBAT_BALANCE_DIAGNOSTICS||{};
    window.__COMBAT_BALANCE_DIAGNOSTICS={
      ...previous,
      version:6,
      build:BUILD,
      world:{...WORLD},
      towerRanges:{...RANGES},
      resonanceRanges:{...RADII},
      resonancePolicy:'each tower independently fuses with every different tower inside its own fusion radius; all valid fusion abilities are inherited simultaneously; no MST and no generic resonance damage',
      links:links.map(link=>({
        fromType:link.from.type,toType:link.to.type,fromSlot:link.from.slot,toSlot:link.to.slot,
        distance:link.distance,radius:link.radius,fromRadius:link.fromRadius,toRadius:link.toRadius,
        fromReceives:link.fromReceives,toReceives:link.toReceives,mutual:link.mutual,
        combo:link.combo,comboName:COMBOS[link.combo]
      })),
      towers:game.state.towers.map(tower=>{
        const fusion=tower.__fusionProfile||profile(tower);
        return {type:tower.type,slot:tower.slot,level:tower.level,linkCount:fusion.linkCount,partnerCounts:{...fusion.counts},diversity:fusion.diversity,combos:fusion.combos.map(combo=>({...combo})),activeFusionNames:fusion.combos.map(combo=>combo.name).filter(Boolean),damage:tower.def.damage,interval:tower.def.interval};
      }),
      towerStacks:game.state.towers.map(tower=>({type:tower.type,slot:tower.slot,level:tower.level,stack:(tower.__fusionProfile||profile(tower)).linkCount,damage:tower.def.damage,interval:tower.def.interval})),
      guide:guide?{type:guide.type,mode:guide.mode,position:guide.position?{...guide.position}:null,radius:RADII[guide.type],linkCount:guide.tower?(partners.get(guide.tower)||[]).length:0,activeFusionNames:guide.tower?(guide.tower.__fusionProfile||profile(guide.tower)).combos.map(combo=>combo.name).filter(Boolean):[]}:null,
      fusionChannels:{projectiles:projectileChannelInstalled,beams:beamChannelInstalled},
      multiFusion:true,
      overlayReady:Boolean(overlay)
    };
    window.__FUSION_RESONANCE_RUNTIME={build:BUILD,ready:true,linkCount:links.length,combos:{...COMBOS},policy:'per-tower-all-partners',multiFusion:true};
  }

  function frame(now){
    buildNetwork(now);
    normalizeTowers();
    normalizeProjectiles();
    updateBadges();
    ctx.clearRect(0,0,WORLD.width,WORLD.height);
    const guide=drawGuide(now);
    publish(guide);
    requestAnimationFrame(frame);
  }

  function install(){
    game=window.__NEON_TEST__;
    overlay=document.getElementById('resonance-link-overlay');
    if(!game?.state||!game?.towerTypes||!overlay||!window.__COMBAT_BALANCE_DIAGNOSTICS?.overlayReady) return false;
    Object.entries(RANGES).forEach(([type,range])=>{if(game.towerTypes[type]) game.towerTypes[type].range=range;});
    ctx=overlay.getContext('2d');
    if(!ctx) return false;
    installProjectileChannel();
    installBeamChannel();
    buildNetwork();
    normalizeTowers();
    if(window.__COMBAT_BALANCE__){
      window.__COMBAT_BALANCE__.build=BUILD;
      window.__COMBAT_BALANCE__.refresh=()=>{buildNetwork();normalizeTowers();publish(guideState());};
      window.__COMBAT_BALANCE__.snapshot=()=>structuredClone(window.__COMBAT_BALANCE_DIAGNOSTICS);
    }
    requestAnimationFrame(frame);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
