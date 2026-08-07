(() => {
  'use strict';

  const BUILD='perf-runtime-v1-20260807';
  const originalRAF=window.requestAnimationFrame.bind(window);
  const callbackClass=new WeakMap();
  const wrappedCallbacks=new WeakMap();
  const lastRun=new WeakMap();
  const runCounters={fusion:0,network:0,draft:0};
  const skipCounters={fusion:0,network:0,draft:0};
  const lastRates={fusion:0,network:0,draft:0};
  const lastSkips={fusion:0,network:0,draft:0};
  const dropped={particles:0,rings:0,runes:0,decals:0,floating:0,fx:0};
  const sequences={particles:0,rings:0,runes:0,decals:0,floating:0,fx:0};
  const budgets={
    particles:{soft:170,hard:250},
    rings:{soft:48,hard:76},
    runes:{soft:34,hard:56},
    decals:{soft:24,hard:40},
    floating:{soft:38,hard:64},
    fx:{soft:28,hard:48}
  };

  let game=null;
  let fps=0;
  let frameCount=0;
  let fpsStarted=performance.now();
  let rateStarted=fpsStarted;
  let monitorTimer=0;

  function classify(callback){
    if(typeof callback!=='function') return null;
    if(callbackClass.has(callback)) return callbackClass.get(callback);
    let kind=null;
    try{
      const source=Function.prototype.toString.call(callback);
      if(source.includes('buildNetwork(now)')&&source.includes('normalizeProjectiles()')) kind='fusion';
      else if(source.includes('__RESONANCE_BOARD_RUNTIME')&&source.includes('drawLink')) kind='network';
      else if(source.includes('observedTowerCount')&&source.includes('updateRerollState')) kind='draft';
    }catch{}
    callbackClass.set(callback,kind);
    return kind;
  }

  function intervalFor(kind){
    const state=window.__NEON_TEST__?.state;
    if(kind==='fusion'){
      const interactive=Boolean(state?.drag?.moved||state?.selectedTower||state?.hoverSlot>=0);
      return interactive?33.3:66.7;
    }
    if(kind==='network') return 33.3;
    if(kind==='draft') return 80;
    return 0;
  }

  window.requestAnimationFrame=function performanceAwareRAF(callback){
    const kind=classify(callback);
    if(!kind) return originalRAF(callback);

    let wrapped=wrappedCallbacks.get(callback);
    if(!wrapped){
      wrapped=function throttledAuxiliaryFrame(now){
        const previous=lastRun.get(callback)||0;
        const interval=intervalFor(kind);
        if(!previous||now-previous>=interval-0.5){
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

  function priorityVisual(name,item){
    if(name==='fx'&&item?.asset==='plasma_blast') return true;
    if(name==='floating'&&/CORE|LV\.|OVERCLOCK/i.test(String(item?.text||''))) return true;
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

  function highLoad(){
    if(!game?.state) return false;
    const state=game.state;
    return state.enemies.length>=14||state.particles.length>=170||state.projectiles.length>=16;
  }

  function trimProjectileTrails(){
    if(!game?.state) return;
    const stressed=highLoad();
    for(const projectile of game.state.projectiles||[]){
      if(!Array.isArray(projectile?.trail)) continue;
      const cap=stressed?(projectile.type==='plasma'?6:7):(projectile.type==='plasma'?9:11);
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
      highLoad:highLoad(),
      auxiliaryHz:{...lastRates},
      auxiliarySkipped:{...lastSkips},
      budgets:structuredClone(budgets),
      dropped:{...dropped},
      counts:{
        enemies:state.enemies.length,
        towers:state.towers.length,
        projectiles:state.projectiles.length,
        particles:state.particles.length,
        rings:state.rings.length,
        runes:state.runes.length,
        decals:state.decals.length,
        floating:state.floating.length,
        fx:state.fx.length
      },
      projectileTrailCap:highLoad()?7:11,
      policy:'keep gameplay at native rAF; throttle auxiliary UI/fusion animation loops and cap visual-only transient effects'
    };
  }

  function monitor(){
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
      for(const kind of Object.keys(runCounters)){
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
    for(const name of Object.keys(budgets)) installBudgetProperty(name);
    clearInterval(monitorTimer);
    monitorTimer=setInterval(monitor,100);
    publish();
    return true;
  }

  originalRAF(fpsFrame);
  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
