(() => {
  'use strict';

  const BUILD='build-flow-v3-unlimited-20260807';
  let game=null;
  let canvas=null;
  let originalBuild=null;
  let preferredBuild=null;
  let pendingPointer=null;
  let maintenanceTimer=0;

  function cards(){
    return [...document.querySelectorAll('.tower-card[data-type]')];
  }

  function validType(type){
    return Boolean(type&&game?.towerTypes?.[type]);
  }

  function draftType(){
    const type=window.__NEON_DRAFT__?.current;
    return validType(type)?type:null;
  }

  function visibleOfferType(){
    const current=document.querySelector('.tower-card.draft-current:not(.draft-hidden)');
    if(validType(current?.dataset.type)) return current.dataset.type;
    const selected=document.querySelector('.tower-card.selected:not(.draft-hidden)')||document.querySelector('.tower-card.selected');
    return validType(selected?.dataset.type)?selected.dataset.type:null;
  }

  function offeredType(){
    return draftType()
      ||visibleOfferType()
      ||(validType(game?.state?.selectedBuild)?game.state.selectedBuild:null)
      ||(validType(preferredBuild)?preferredBuild:null);
  }

  function towerAtSlot(slot){
    return game?.state?.towers?.find(tower=>tower.slot===slot)||null;
  }

  function nearestSlot(x,y,limit=58){
    let best=-1;
    let bestDistance=limit;
    for(let i=0;i<(game?.level?.slots?.length||0);i+=1){
      const slot=game.level.slots[i];
      const distance=Math.hypot(x-slot.x,y-slot.y);
      if(distance<bestDistance){
        bestDistance=distance;
        best=i;
      }
    }
    return best;
  }

  function pointerPos(event){
    const rect=canvas.getBoundingClientRect();
    return {
      x:(event.clientX-rect.left)/rect.width*canvas.width,
      y:(event.clientY-rect.top)/rect.height*canvas.height
    };
  }

  function syncHudAndCards(){
    if(!game?.state) return;
    const draft=draftType();
    if(validType(draft)) preferredBuild=draft;
    else if(validType(game.state.selectedBuild)&&!game.state.drag) preferredBuild=game.state.selectedBuild;
    else if(!validType(preferredBuild)) preferredBuild=visibleOfferType();

    for(const card of cards()){
      const type=card.dataset.type;
      const def=game.towerTypes[type];
      if(!def) continue;
      // No artificial tower-count cap: affordability is the only card-level lock.
      card.disabled=game.state.credits<def.cost;
      if(preferredBuild===type&&!game.state.selectedTower) card.classList.add('selected');
    }

    const power=document.getElementById('powerText');
    if(power) power.dataset.towerCount=String(game.state.towers.length);
  }

  function installPowerCountStyle(){
    if(document.getElementById('unlimitedTowerCountStyle')) return;
    const style=document.createElement('style');
    style.id='unlimitedTowerCountStyle';
    style.textContent=`
      #powerText{font-size:0!important}
      #powerText::after{content:attr(data-tower-count);font-size:18px;line-height:1}
    `;
    document.head.appendChild(style);
  }

  function publish(){
    if(!game?.state) return;
    window.__BUILD_FLOW_RUNTIME={
      build:BUILD,
      ready:true,
      artificialTowerLimit:false,
      physicalNodeCount:game.level?.slots?.length||0,
      towerCount:game.state.towers.length,
      preferredBuild,
      offeredBuild:offeredType(),
      selectedBuild:game.state.selectedBuild,
      credits:game.state.credits,
      cards:Object.fromEntries(cards().map(card=>[
        card.dataset.type,
        {disabled:card.disabled,selected:card.classList.contains('selected'),current:card.classList.contains('draft-current')}
      ]))
    };
  }

  function refreshFusion(){
    try{window.__COMBAT_BALANCE__?.refresh?.();}catch{}
  }

  function buildBeyondLegacyCap(type,slot){
    const state=game.state;
    const def=game.towerTypes[type];
    if(!validType(type)||slot<0||!game.level.slots[slot]) return false;
    if(towerAtSlot(slot)) return false;
    if(state.credits<def.cost) return originalBuild(type,slot);

    const existing=state.towers;
    // app.js still contains the historical >=8 guard. Execute its native build
    // path against a temporary seven-tower view, then restore every real tower
    // plus the newly created tower. This preserves native FX/audio/inspector
    // behavior while removing the obsolete global cap at runtime.
    const compatibilityView=existing.slice(0,7);
    state.towers=compatibilityView;
    let succeeded=false;
    let created=null;
    try{
      succeeded=Boolean(originalBuild(type,slot));
      if(succeeded) created=state.towers.find(tower=>!compatibilityView.includes(tower))||state.towers.at(-1)||null;
    }finally{
      state.towers=existing;
    }

    if(!succeeded||!created) return false;
    existing.push(created);
    state.selectedTower=created;
    preferredBuild=type;
    refreshFusion();
    syncHudAndCards();
    publish();
    return true;
  }

  function unlimitedBuild(type,slot){
    if(game.state.towers.length<8) return originalBuild(type,slot);
    return buildBeyondLegacyCap(type,slot);
  }

  function rearmAfterDraftAdvance(fallbackType){
    setTimeout(()=>{
      const type=draftType()||offeredType()||fallbackType;
      if(validType(type)){
        preferredBuild=type;
        game.state.selectedBuild=type;
        game.state.selectedTower=null;
      }
      syncHudAndCards();
      publish();
    },120);
  }

  function selectPreferred(type){
    if(!validType(type)) return;
    preferredBuild=type;
    game.state.selectedBuild=type;
    game.state.selectedTower=null;
    syncHudAndCards();
    publish();
  }

  function onCanvasPointerCapture(event){
    pendingPointer=null;
    const state=game.state;
    if(!state.ready||!state.running||state.paused) return;

    const point=pointerPos(event);
    const occupiedSlot=nearestSlot(point.x,point.y,64);
    const occupied=occupiedSlot>=0?towerAtSlot(occupiedSlot):null;
    if(occupied){
      pendingPointer={kind:'inspect',slot:occupiedSlot};
      return;
    }

    const slot=nearestSlot(point.x,point.y,58);
    const type=offeredType();
    if(slot<0||!validType(type)) return;

    preferredBuild=type;
    state.selectedBuild=type;

    if(state.towers.length>=8){
      const beforeCount=state.towers.length;
      const succeeded=unlimitedBuild(type,slot);
      if(succeeded){
        pendingPointer=null;
        event.preventDefault();
        event.stopImmediatePropagation();
        if(state.towers.length>beforeCount) rearmAfterDraftAdvance(type);
      }
      syncHudAndCards();
      publish();
      return;
    }

    pendingPointer={kind:'build',slot,type,beforeCount:state.towers.length};
    syncHudAndCards();
    publish();
  }

  function onCanvasPointerBubble(){
    const pending=pendingPointer;
    pendingPointer=null;
    if(!pending){
      syncHudAndCards();
      publish();
      return;
    }

    if(pending.kind==='build'){
      const built=towerAtSlot(pending.slot);
      const succeeded=Boolean(built&&built.type===pending.type&&game.state.towers.length>pending.beforeCount);
      if(succeeded) rearmAfterDraftAdvance(pending.type);
      else{
        preferredBuild=pending.type;
        game.state.selectedBuild=pending.type;
      }
    }

    syncHudAndCards();
    publish();
  }

  function onDropCapture(event){
    if(game.state.towers.length<8) return;
    const point=pointerPos(event);
    const slot=nearestSlot(point.x,point.y,62);
    const draggedType=event.dataTransfer?.getData('text/tower');
    const type=validType(draggedType)?draggedType:offeredType();
    if(slot<0||!validType(type)||towerAtSlot(slot)) return;
    const beforeCount=game.state.towers.length;
    const succeeded=unlimitedBuild(type,slot);
    if(!succeeded) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(game.state.towers.length>beforeCount) rearmAfterDraftAdvance(type);
  }

  function onDropBubble(){
    const type=offeredType();
    if(validType(type)) rearmAfterDraftAdvance(type);
  }

  function maintenance(){
    syncHudAndCards();
    publish();
  }

  function install(){
    game=window.__NEON_TEST__;
    canvas=document.getElementById('game');
    if(!game?.state||!game?.towerTypes||!canvas||!window.__NEON_DRAFT__) return false;

    originalBuild=game.buildTower.bind(game);
    game.buildTower=unlimitedBuild;
    preferredBuild=offeredType()||'rail';
    installPowerCountStyle();

    for(const card of cards()){
      const choose=()=>selectPreferred(card.dataset.type);
      card.addEventListener('pointerdown',choose,true);
      card.addEventListener('click',choose,true);
      card.addEventListener('dragstart',choose,true);
    }

    canvas.addEventListener('pointerdown',onCanvasPointerCapture,true);
    canvas.addEventListener('pointerdown',onCanvasPointerBubble,false);
    canvas.addEventListener('drop',onDropCapture,true);
    canvas.addEventListener('drop',onDropBubble,false);

    clearInterval(maintenanceTimer);
    maintenanceTimer=setInterval(maintenance,100);
    maintenance();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
