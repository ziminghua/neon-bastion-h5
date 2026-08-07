(() => {
  'use strict';

  const BUILD='build-selection-fix-v2-20260807';
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

  function syncCards(){
    if(!game?.state) return;
    const authoritative=draftType()||preferredBuild;
    if(validType(authoritative)) preferredBuild=authoritative;
    const atLimit=game.state.towers.length>=8;
    for(const card of cards()){
      const type=card.dataset.type;
      const def=game.towerTypes[type];
      if(!def) continue;
      // Core updateUI(false) does not refresh disabled card state while credits
      // change during combat. Keep affordability live so "enough credits" is
      // immediately actionable.
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
      offeredBuild:offeredType(),
      draftBuild:draftType(),
      selectedBuild:game.state.selectedBuild,
      selectedTower:game.state.selectedTower?{
        type:game.state.selectedTower.type,
        slot:game.state.selectedTower.slot
      }:null,
      credits:game.state.credits,
      towerCount:game.state.towers.length,
      cardState:Object.fromEntries(cards().map(card=>[
        card.dataset.type,
        {
          selected:card.classList.contains('selected'),
          disabled:card.disabled,
          current:card.classList.contains('draft-current'),
          hidden:card.classList.contains('draft-hidden')
        }
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

  function rearmAfterDraftAdvance(fallbackType){
    requestAnimationFrame(()=>{
      const type=offeredType()||fallbackType;
      if(validType(type)){
        preferredBuild=type;
        game.state.selectedBuild=type;
      }
      syncCards();
      publish();
    });
  }

  function onCanvasPointerCapture(event){
    pendingPointer=null;
    if(!game.state.ready||!game.state.running||game.state.paused) return;

    const point=pointerPos(event);
    const occupiedSlot=nearestSlot(point.x,point.y,64);
    const occupied=occupiedSlot>=0?towerAtSlot(occupiedSlot):null;
    if(occupied){
      // Let app.js enter inspect/drag mode. Keep the visible draft/build offer in
      // reserve so the next empty-node click can re-arm it automatically.
      pendingPointer={kind:'inspect',slot:occupiedSlot};
      return;
    }

    const slot=nearestSlot(point.x,point.y,58);
    const type=offeredType();
    if(slot<0||!validType(type)) return;

    // The UI may still show a current/selected tower while app.js has
    // selectedBuild=null (after placement or after inspecting a placed tower).
    // Make the visible offer authoritative before app.js handles this same click.
    preferredBuild=type;
    game.state.selectedBuild=type;
    pendingPointer={kind:'build',slot,type,beforeCount:game.state.towers.length};
    syncCards();
    publish();
  }

  function onCanvasPointerBubble(){
    const pending=pendingPointer;
    pendingPointer=null;
    if(!pending){
      syncCards();
      publish();
      return;
    }

    if(pending.kind==='build'){
      const built=towerAtSlot(pending.slot);
      const succeeded=Boolean(
        built&&
        built.type===pending.type&&
        game.state.towers.length>pending.beforeCount
      );
      if(succeeded){
        if(draftType()){
          // random-draft advances on the next animation frame. Re-arm whatever
          // becomes CURRENT after that advance instead of pinning the old draw.
          rearmAfterDraftAdvance(pending.type);
        }else{
          preferredBuild=pending.type;
          game.state.selectedBuild=pending.type;
        }
      }else{
        // A failed build (usually insufficient credits) must not silently drop
        // the selection; the player can try another node once funds are ready.
        preferredBuild=pending.type;
        game.state.selectedBuild=pending.type;
      }
    }

    // For inspect mode app.js intentionally sets selectedBuild=null. Do not
    // fight that inspector state here; the next empty-node click will re-arm the
    // still-visible offer in the capture handler above.
    syncCards();
    publish();
  }

  function onDrop(event){
    const draggedType=event.dataTransfer?.getData('text/tower');
    const type=validType(draggedType)?draggedType:offeredType();
    if(validType(type)){
      preferredBuild=type;
      if(draftType()) rearmAfterDraftAdvance(type);
      else game.state.selectedBuild=type;
    }
    syncCards();
    publish();
  }

  function frame(){
    const draft=draftType();
    if(draft){
      preferredBuild=draft;
    }else if(validType(game.state.selectedBuild)&&!game.state.drag){
      preferredBuild=game.state.selectedBuild;
    }else if(!validType(preferredBuild)){
      preferredBuild=visibleOfferType();
    }
    syncCards();
    publish();
    requestAnimationFrame(frame);
  }

  function install(){
    game=window.__NEON_TEST__;
    canvas=document.getElementById('game');
    if(!game?.state||!game?.towerTypes||!canvas) return false;

    preferredBuild=offeredType()||'rail';

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
