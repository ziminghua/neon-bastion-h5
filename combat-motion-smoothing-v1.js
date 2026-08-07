(() => {
  'use strict';

  const BUILD='combat-motion-smoothing-v1-20260807';
  const RECOIL_CAP={rail:.42,cryo:.28,plasma:.48,arcane:.30};
  const ROUTINE_PLASMA_SHAKE=10;

  let game=null;
  let shakeInstalled=false;
  let suppressedRoutineShakes=0;
  let wrappedTowers=0;
  let wrappedEnemies=0;
  let monitorTimer=0;
  let publishTimer=0;

  function installScreenShakePolicy(){
    const state=game?.state;
    if(!state||shakeInstalled) return;

    let raw=Math.max(0,Number(state.screenShake)||0);
    Object.defineProperty(state,'screenShake',{
      configurable:true,
      enumerable:true,
      get(){return raw;},
      set(value){
        const next=Math.max(0,Number(value)||0);
        // Regular Plasma impacts used to set the whole battlefield to a random 10px shake.
        // Keep their local blast/ring feedback, but do not move the camera for routine fire.
        if(Math.abs(next-ROUTINE_PLASMA_SHAKE)<1e-6&&raw<ROUTINE_PLASMA_SHAKE){
          suppressedRoutineShakes+=1;
          return;
        }
        raw=next;
      }
    });
    shakeInstalled=true;
  }

  function wrapTowerRecoil(tower){
    if(!tower||tower.__smoothRecoilInstalled) return;
    const cap=RECOIL_CAP[tower.type]??.34;
    let raw=Math.min(cap,Math.max(0,Number(tower.recoil)||0));
    Object.defineProperty(tower,'recoil',{
      configurable:true,
      enumerable:true,
      get(){return raw;},
      set(value){
        const next=Math.max(0,Number(value)||0);
        // fireTower() kicks recoil to 1. Clamp only the visual displacement;
        // updateTowers() can still decay it normally.
        raw=Math.min(cap,next);
      }
    });
    tower.__smoothRecoilInstalled=true;
    tower.__smoothRecoilCap=cap;
    wrappedTowers+=1;
  }

  function removeEnemyHitStop(enemy){
    if(!enemy||enemy.__smoothHitStopRemoved) return;

    let rawImpact=Math.max(0,Number(enemy.impact)||0);
    Object.defineProperty(enemy,'impact',{
      configurable:true,
      enumerable:true,
      // Movement speed already has a dedicated Cryo slowFactor. Returning zero here
      // removes the extra 0.13s impactDrag and the positional kick that looked like a hitch.
      get(){return 0;},
      set(value){rawImpact=Math.max(0,Number(value)||0);}
    });
    // difficulty-balance-v1.js checks this marker before installing its legacy impact accessor.
    enemy.__movementImpactPolicy='cryo-only-v1';
    enemy.__smoothHitStopRemoved=true;
    Object.defineProperty(enemy,'__rawVisualImpact',{
      configurable:true,
      enumerable:false,
      get(){return rawImpact;}
    });
    wrappedEnemies+=1;
  }

  function monitor(){
    if(!game?.state) return;
    installScreenShakePolicy();
    for(const tower of game.state.towers||[]) wrapTowerRecoil(tower);
    for(const enemy of game.state.enemies||[]) removeEnemyHitStop(enemy);
  }

  function publish(){
    if(!game?.state) return;
    window.__COMBAT_MOTION_RUNTIME={
      build:BUILD,
      ready:true,
      policy:'no routine camera shake; small local tower recoil; no hit-stop movement drag; cryo slows only through slowFactor',
      routinePlasmaCameraShake:false,
      enemyHitStop:false,
      cryoUsesSlowFactor:true,
      recoilCaps:{...RECOIL_CAP},
      suppressedRoutineShakes,
      wrappedTowers,
      wrappedEnemies,
      currentShake:game.state.screenShake,
      activeTowerRecoil:(game.state.towers||[]).map(tower=>({type:tower.type,level:tower.level,recoil:tower.recoil,cap:tower.__smoothRecoilCap??null}))
    };
  }

  function install(){
    game=window.__NEON_TEST__;
    if(!game?.state) return false;
    monitor();
    clearInterval(monitorTimer);
    clearInterval(publishTimer);
    monitorTimer=setInterval(monitor,25);
    publishTimer=setInterval(publish,250);
    publish();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
