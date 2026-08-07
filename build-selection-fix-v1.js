(() => {
  'use strict';

  const BUILD='build-selection-fix-v1-20260807';
  let game=null;
  let canvas=null;
  let preferredBuild=null;
  let pendingPointer=null;

  function cards(){
    return [...document.querySelectorAll('.tower-card[data-type]')];
  }

  function validType(type){
    return Boolean(type&&game?.towerTypes?.[type]);
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

  function syncCards(){
    if(!game?.state) return;
    const atLimit=game.state.towers.length>=8;
    for(const card of cards()){
      const type=card.dataset.type;
      const def=game.towerTypes[type];
      if(!def) continue;
      card.disabled=atLimit||game.state.credits<def.cost;
      card.classList.toggle('selected',preferredBuild===type);
    }
  }

  function publish(){
    if(!game?.state) return;
    window.__BUILD_SELECTION_FIX={
      build:BUILD,
      ready:true,
      preferredBuild,
      selectedBuild:game.state.selectedBuild,
      selectedTower:game.state.selectedTower?{
        type:game.state.selectedTower.type,
        slot:game.state.selectedTower.slot
      }:null,
      credits:game.state.credits,
      towerCount:game.state.towers.length,
      cardState:Object.fromEntries(cards().map(card=>[
        card.dataset.type,
        {selected:card.classList.contains('selected'),disabled:card.disabled}
      ]))
    };
  }

  function selectPreferred(type){
    if(!validType(type)) return;
    preferredBuild=type;
    game.state.selectedBuild=type;
    game.state.selectedTower=null;
    syncCards();
    publish();
  }

  function onCanvasPointerCapture(event){
    pendingPointer=null;
    if(!game.state.ready||!game.state.running||game.state.paused) return;

    const point=pointerPos(event);
    const occupiedSlot=nearestSlot(point.x,point.y,64);
    const occupied=occupiedSlot>=0?towerAtSlot(occupiedSlot):null;
    if(occupied){
      // Inspecting or dragging a placed tower intentionally exits build mode.
      preferredBuild=null;
      game.state.selectedBuild=null;
      syncCards();
      publish();
      return;
    }

    const slot=nearestSlot(point.x,point.y,58);
    if(slot<0||!validType(preferredBuild)) return;

    // Core app.js clears selectedBuild after a successful build. Prime the state
    // before its pointer handler so this click always behaves like the visible
    // selected card says it should.
    game.state.selectedBuild=preferredBuild;
    pendingPointer={slot,type:preferredBuild,beforeCount:game.state.towers.length};
  }

  function onCanvasPointerBubble(){
    if(pendingPointer){
      const built=towerAtSlot(pendingPointer.slot);
      if(built&&built.type===pendingPointer.type&&game.state.towers.length>pendingPointer.beforeCount){
        // Continuous-build behavior: keep the same tower armed after placement.
        preferredBuild=pendingPointer.type;
        game.state.selectedBuild=pendingPointer.type;
      }
    }
    pendingPointer=null;
    syncCards();
    publish();
  }

  function onDrop(event){
    const draggedType=event.dataTransfer?.getData('text/tower');
    const type=validType(draggedType)?draggedType:preferredBuild;
    if(validType(type)){
      preferredBuild=type;
      game.state.selectedBuild=type;
    }
    syncCards();
    publish();
  }

  function frame(){
    // resetGame()/restart selects Railgun in app.js. Adopt explicit core build
    // selections when no placed tower is being inspected.
    if(validType(game.state.selectedBuild)&&!game.state.selectedTower){
      preferredBuild=game.state.selectedBuild;
    }
    syncCards();
    publish();
    requestAnimationFrame(frame);
  }

  function install(){
    game=window.__NEON_TEST__;
    canvas=document.getElementById('game');
    if(!game?.state||!game?.towerTypes||!canvas) return false;

    preferredBuild=validType(game.state.selectedBuild)
      ?game.state.selectedBuild
      :(document.querySelector('.tower-card.selected')?.dataset.type||'rail');

    for(const card of cards()){
      const choose=()=>selectPreferred(card.dataset.type);
      card.addEventListener('pointerdown',choose,true);
      card.addEventListener('click',choose,true);
      card.addEventListener('dragstart',choose,true);
    }

    canvas.addEventListener('pointerdown',onCanvasPointerCapture,true);
    canvas.addEventListener('pointerdown',onCanvasPointerBubble,false);
    canvas.addEventListener('drop',onDrop,false);

    syncCards();
    publish();
    requestAnimationFrame(frame);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(install()||attempts>600) clearInterval(timer);
  },25);
})();
