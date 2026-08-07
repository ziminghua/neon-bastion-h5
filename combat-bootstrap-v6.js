(() => {
  'use strict';

  const BUILD='fusion-network-v6-20260807';
  const WORLD={width:1600,height:900};
  const RANGE_BY_TYPE={rail:240,cryo:225,plasma:215,arcane:265};
  const RESONANCE_RADIUS_BY_TYPE={rail:340,cryo:360,plasma:350,arcane:420};

  let game=null;
  let overlay=null;
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
    return Boolean(overlay.getContext('2d'));
  }

  function installStyle(){
    if(document.getElementById('combat-bootstrap-v6-style')) return;
    const style=document.createElement('style');
    style.id='combat-bootstrap-v6-style';
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

  function publishDiagnostics(){
    if(!game) return;
    const slots=game.level.slots;
    const path=game.level.path;
    const nearestDistances=slots.map(slot=>nearestPathDistance(slot,path));
    const maximumNearestDistance=Math.max(...nearestDistances);
    window.__COMBAT_BALANCE_DIAGNOSTICS={
      version:4,
      build:BUILD,
      world:{...WORLD},
      towerRanges:{...RANGE_BY_TYPE},
      resonanceRanges:{...RESONANCE_RADIUS_BY_TYPE},
      maximumPlatformToPathDistance:maximumNearestDistance,
      minimumCoverageMargin:Object.fromEntries(Object.entries(RANGE_BY_TYPE).map(([type,range])=>[type,range-maximumNearestDistance])),
      resonancePolicy:'bootstrap only; fusion-network-v6 owns all resonance links and never applies generic damage',
      links:[],
      towerStacks:[],
      guide:null,
      mergeOnly:{
        installed:mergeOnlyInstalled,
        upgradeButtonHidden:Boolean(document.getElementById('upgradeBtn')?.hidden),
        upgradeButtonDisabled:Boolean(document.getElementById('upgradeBtn')?.disabled)
      },
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
    publishDiagnostics();
    window.__COMBAT_BALANCE__={
      build:BUILD,
      ranges:{...RANGE_BY_TYPE},
      resonanceRanges:{...RESONANCE_RADIUS_BY_TYPE},
      refresh:publishDiagnostics,
      snapshot:()=>structuredClone(window.__COMBAT_BALANCE_DIAGNOSTICS)
    };
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(initialize()||attempts>500) clearInterval(timer);
  },25);
})();
