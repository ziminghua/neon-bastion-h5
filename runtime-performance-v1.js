(() => {
  'use strict';

  const BUILD='perf-runtime-v2-20260807';
  const SCHEDULER_TARGETS={
    mainStressedHz:45,
    mainSevereHz:36,
    fusionIdleHz:15,
    fusionInteractiveHz:30,
    networkHz:30,
    draftHz:12.5,
    placementIdleHz:15,
    placementInteractiveHz:30,
    railVfxHz:30,
    deliveryPolishHz:15,
    combatOriginHz:30,
    difficultyHz:15,
    combatMotionMonitorMs:75,
    combatMotionPublishMs:500
  };
  const RAF_KINDS=['main','fusion','network','draft','placement','railVfx','deliveryPolish','combatOrigin','difficulty'];
  const AUXILIARY_KINDS=RAF_KINDS.filter(kind=>kind!=='main');
  const originalRAF=window.requestAnimationFrame.bind(window);
  const originalSetInterval=window.setInterval.bind(window);
  const callbackClass=new WeakMap();
  const intervalCallbackClass=new WeakMap();
  const wrappedCallbacks=new WeakMap();
  const lastRun=new WeakMap();
  const runCounters=Object.fromEntries(RAF_KINDS.map(kind=>[kind,0]));
  const skipCounters=Object.fromEntries(RAF_KINDS.map(kind=>[kind,0]));
  const lastRates=Object.fromEntries(RAF_KINDS.map(kind=>[kind,0]));
  const lastSkips=Object.fromEntries(RAF_KINDS.map(kind=>[kind,0]));
  const dropped={particles:0,rings:0,runes:0,decals:0,floating:0,fx:0,beams:0};
  const sequences={particles:0,rings:0,runes:0,decals:0,floating:0,fx:0,beams:0};
  const domSkips={textContent:0,classToggle:0};
  const intervalAdjustments={combatMotionMonitor:0,combatMotionPublish:0};
  const budgets={
    particles:{soft:150,hard:220},
    rings:{soft:44,hard:68},
    runes:{soft:30,hard:48},
    decals:{soft:22,hard:36},
    floating:{soft:34,hard:54},
    fx:{soft:24,hard:40},
    beams:{soft:38,hard:60}
  };

  let game=null;
  let fps=0;
  let frameCount=0;
  let fpsStarted=performance.now();
  let rateStarted=fpsStarted;
  let monitorTimer=0;
  let stressed=false;
  let severe=false;
  let enemyAssets=new Set();
  let enemyShadowBypasses=0;

  function classify(callback){
    if(typeof callback!=='function') return null;
    if(callbackClass.has(callback)) return callbackClass.get(callback);
    let kind=null;
    try{
      const source=Function.prototype.toString.call(callback);
      if(source.includes('update(dt);render();requestAnimationFrame(loop)')) kind='main';
      else if(source.includes('buildNetwork(now)')&&source.includes('normalizeProjectiles()')) kind='fusion';
      else if(source.includes('__RESONANCE_BOARD_RUNTIME')&&source.includes('drawLink')) kind='network';
      else if(source.includes('observedTowerCount')&&source.includes('updateRerollState')) kind='draft';
      else if(source.includes('game.level.slots.forEach')&&source.includes('drawNode(slot,index,now)')) kind='placement';
      else if(source.includes("beam.kind === 'rail'")&&source.includes('drawRailBeam')) kind='railVfx';
      else if(source.includes('__deliveryPolished')&&source.includes('game.state.runes')) kind='deliveryPolish';
      else if(source.includes('__fusionOrigin')&&source.includes('game.state.projectiles')) kind='combatOrigin';
      else if(source.includes('tuneSpeed()')&&source.includes('tuneControl()')&&source.includes('publish()')) kind='difficulty';
    }catch{}
    callbackClass.set(callback,kind);
    return kind;
  }

  function classifyInterval(callback){
    if(typeof callback!=='function') return null;
    if(intervalCallbackClass.has(callback)) return intervalCallbackClass.get(callback);
    let kind=null;
    try{
      const source=Function.prototype.toString.call(callback);
      if(source.includes('installScreenShakePolicy()')&&source.includes('removeEnemyHitStop')) kind='combatMotionMonitor';
      else if(source.includes('__COMBAT_MOTION_RUNTIME')&&source.includes('activeTowerRecoil')) kind='combatMotionPublish';
    }catch{}
    intervalCallbackClass.set(callback,kind);
    return kind;
  }

  function refreshLoadState(){
    if(!game?.state){stressed=false;severe=false;return;}
    const state=game.state;
    stressed=state.enemies.length>=14||state.particles.length>=145||state.projectiles.length>=14||state.beams.length>=30;
    severe=state.enemies.length>=24||state.particles.length>=205||state.projectiles.length>=22||state.beams.length>=48;
  }

  function mainTargetHz(){
    if(severe) return SCHEDULER_TARGETS.mainSevereHz;
    if(stressed) return SCHEDULER_TARGETS.mainStressedHz;
    return 0;
  }

  function intervalFor(kind){
    const state=window.__NEON_TEST__?.state;
    if(kind==='main'){
      const hz=mainTargetHz();
      return hz?1000/hz:0;
    }
    if(kind==='fusion'){
      const interactive=Boolean(state?.drag?.moved||state?.selectedTower||state?.hoverSlot>=0);
      return 1000/(interactive?SCHEDULER_TARGETS.fusionInteractiveHz:SCHEDULER_TARGETS.fusionIdleHz);
    }
    if(kind==='placement'){
      const interactive=Boolean(state?.drag?.moved||state?.hoverSlot>=0);
      return 1000/(interactive?SCHEDULER_TARGETS.placementInteractiveHz:SCHEDULER_TARGETS.placementIdleHz);
    }
    if(kind==='network') return 1000/SCHEDULER_TARGETS.networkHz;
    if(kind==='draft') return 1000/SCHEDULER_TARGETS.draftHz;
    if(kind==='railVfx') return 1000/SCHEDULER_TARGETS.railVfxHz;
    if(kind==='deliveryPolish') return 1000/SCHEDULER_TARGETS.deliveryPolishHz;
    if(kind==='combatOrigin') return 1000/SCHEDULER_TARGETS.combatOriginHz;
    if(kind==='difficulty') return 1000/SCHEDULER_TARGETS.difficultyHz;
    return 0;
  }

  window.requestAnimationFrame=function performanceAwareRAF(callback){
    const kind=classify(callback);
    if(!kind) return originalRAF(callback);

    let wrapped=wrappedCallbacks.get(callback);
    if(!wrapped){
      wrapped=function throttledFrame(now){
        const previous=lastRun.get(callback)||0;
        const interval=intervalFor(kind);
        if(!interval||!previous||now-previous>=interval-0.5){
          lastRun.set(callback,now);
          runCounters[kind]+=1;
          callback(now);
        }else{
          skipCounters[kind]+=1;
          originalRAF(wrapped);
        }
      };
      wrappedCallbacks.set(callback,wrapped);
    }
    return originalRAF(wrapped);
  };

  window.setInterval=function performanceAwareInterval(callback,delay,...args){
    const kind=classifyInterval(callback);
    let effective=Number(delay)||0;
    if(kind==='combatMotionMonitor'){
      const next=Math.max(effective,SCHEDULER_TARGETS.combatMotionMonitorMs);
      if(next!==effective) intervalAdjustments.combatMotionMonitor+=1;
      effective=next;
    }else if(kind==='combatMotionPublish'){
      const next=Math.max(effective,SCHEDULER_TARGETS.combatMotionPublishMs);
      if(next!==effective) intervalAdjustments.combatMotionPublish+=1;
      effective=next;
    }
    return originalSetInterval(callback,effective,...args);
  };

  function installDomDedupe(){
    const nodeProto=window.Node?.prototype;
    if(nodeProto&&!nodeProto.__neonPerfTextDedupe){
      const descriptor=Object.getOwnPropertyDescriptor(nodeProto,'textContent');
      if(descriptor?.get&&descriptor?.set&&descriptor.configurable){
        Object.defineProperty(nodeProto,'textContent',{
          ...descriptor,
          set(value){
            const normalized=value==null?'':String(value);
            if(descriptor.get.call(this)===normalized){domSkips.textContent+=1;return;}
            return descriptor.set.call(this,value);
          }
        });
        Object.defineProperty(nodeProto,'__neonPerfTextDedupe',{value:true,configurable:true});
      }
    }

    const tokenProto=window.DOMTokenList?.prototype;
    if(tokenProto&&!tokenProto.__neonPerfToggleDedupe){
      const previousToggle=tokenProto.toggle;
      tokenProto.toggle=function dedupedToggle(token,force){
        if(arguments.length>1){
          const desired=Boolean(force);
          if(this.contains(token)===desired){domSkips.classToggle+=1;return desired;}
        }
        return previousToggle.apply(this,arguments);
      };
      Object.defineProperty(tokenProto,'__neonPerfToggleDedupe',{value:true,configurable:true});
    }
  }

  function refreshEnemyAssets(){
    if(!game?.assets) return;
    enemyAssets=new Set(['drone','runner','brute','shield','boss'].map(key=>game.assets[key]).filter(Boolean));
  }

  function installCanvasPolicy(){
    const proto=window.CanvasRenderingContext2D?.prototype;
    if(!proto||proto.__neonPerfEnemyShadowPolicy) return;
    const previousDrawImage=proto.drawImage;
    proto.drawImage=function performanceAwareDrawImage(image,...args){
      if(stressed&&this.canvas?.id==='game'&&enemyAssets.has(image)&&this.shadowBlur>0){
        const blur=this.shadowBlur;
        this.shadowBlur=0;
        try{
          enemyShadowBypasses+=1;
          return previousDrawImage.call(this,image,...args);
        }finally{
          this.shadowBlur=blur;
        }
      }
      return previousDrawImage.call(this,image,...args);
    };
    Object.defineProperty(proto,'__neonPerfEnemyShadowPolicy',{value:true,configurable:true});
  }

  function priorityVisual(name,item){
    if(name==='fx'&&item?.asset==='plasma_blast') return true;
    if(name==='floating'&&/CORE|LV\.|OVERCLOCK/i.test(String(item?.text||''))) return true;
    if(name==='beams'&&item?.kind==='rail-core') return true;
    return false;
  }

  function acceptVisual(name,source,item){
    const budget=budgets[name];
    if(!budget) return true;
    if(priorityVisual(name,item)){
      if(source.length>=budget.hard) source.shift();
      return true;
    }
    if(source.length<budget.soft) return true;
    if(source.length>=budget.hard) return false;

    const pressure=(source.length-budget.soft)/Math.max(1,budget.hard-budget.soft);
    const stride=pressure>.72?4:pressure>.4?3:2;
    sequences[name]+=1;
    return sequences[name]%stride===0;
  }

  function wrapBudgetArray(name,array){
    if(array?.__neonPerfBudget===name) return array;
    const budget=budgets[name];
    const source=Array.isArray(array)?array:[];
    if(source.length>budget.hard) source.splice(0,source.length-budget.hard);
    return new Proxy(source,{
      get(target,property,receiver){
        if(property==='__neonPerfBudget') return name;
        if(property==='push'){
          return (...items)=>{
            for(const item of items){
              if(acceptVisual(name,target,item)) Array.prototype.push.call(target,item);
              else dropped[name]+=1;
            }
            return target.length;
          };
        }
        return Reflect.get(target,property,receiver);
      }
    });
  }

  function installBudgetProperty(name){
    let current=wrapBudgetArray(name,game.state[name]||[]);
    Object.defineProperty(game.state,name,{
      configurable:true,
      enumerable:true,
      get(){return current;},
      set(next){current=wrapBudgetArray(name,Array.isArray(next)?next:[]);}
    });
  }

  function trimProjectileTrails(){
    if(!game?.state) return;
    for(const projectile of game.state.projectiles||[]){
      if(!Array.isArray(projectile?.trail)) continue;
      const cap=stressed?(projectile.type==='plasma'?5:6):(projectile.type==='plasma'?8:10);
      if(projectile.trail.length>cap) projectile.trail.splice(0,projectile.trail.length-cap);
    }
  }

  function publish(){
    if(!game?.state) return;
    const state=game.state;
    window.__PERFORMANCE_RUNTIME={
      build:BUILD,
      ready:true,
      fps:Number(fps.toFixed(1)),
      fpsTelemetryOnly:false,
      mainLoopThrottled:Boolean(mainTargetHz()),
      mainTargetHz:mainTargetHz()||'native',
      schedulerTargets:{...SCHEDULER_TARGETS},
      highLoad:stressed,
      severeLoad:severe,
      auxiliaryHz:Object.fromEntries(AUXILIARY_KINDS.map(kind=>[kind,lastRates[kind]])),
      auxiliarySkipped:Object.fromEntries(AUXILIARY_KINDS.map(kind=>[kind,lastSkips[kind]])),
      mainHz:lastRates.main,
      mainSkipped:lastSkips.main,
      budgets:structuredClone(budgets),
      dropped:{...dropped},
      domSkips:{...domSkips},
      intervalAdjustments:{...intervalAdjustments},
      enemyShadowBypasses,
      counts:{
        enemies:state.enemies.length,
        towers:state.towers.length,
        projectiles:state.projectiles.length,
        particles:state.particles.length,
        beams:state.beams.length,
        rings:state.rings.length,
        runes:state.runes.length,
        decals:state.decals.length,
        floating:state.floating.length,
        fx:state.fx.length
      },
      projectileTrailCap:stressed?6:10,
      policy:'native gameplay at normal load; adaptive 45/36 Hz only under pressure; throttle observer overlays; dedupe DOM writes; suppress enemy sprite shadows and cap transient visuals under load'
    };
  }

  function monitor(){
    refreshLoadState();
    trimProjectileTrails();
    publish();
  }

  function fpsFrame(now){
    frameCount+=1;
    if(now-fpsStarted>=1000){
      fps=frameCount*1000/(now-fpsStarted);
      frameCount=0;
      fpsStarted=now;
    }
    if(now-rateStarted>=1000){
      const seconds=(now-rateStarted)/1000;
      for(const kind of RAF_KINDS){
        lastRates[kind]=Number((runCounters[kind]/seconds).toFixed(1));
        lastSkips[kind]=skipCounters[kind];
        runCounters[kind]=0;
        skipCounters[kind]=0;
      }
      rateStarted=now;
    }
    originalRAF(fpsFrame);
  }

  function install(){
    game=window.__NEON_TEST__;
    if(!game?.state) return false;
    refreshEnemyAssets();
    refreshLoadState();
    for(const name of Object.keys(budgets)) installBudgetProperty(name);
    clearInterval(monitorTimer);
    monitorTimer=originalSetInterval(monitor,100);
    publish();
    return true;
  }

  installDomDedupe();
  installCanvasPolicy();
  originalRAF(fpsFrame);
  let attempts=0;
  const timer=originalSetInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
