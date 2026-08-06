(() => {
  'use strict';

  // The battlefield is authored once in a fixed 1600×900 logical coordinate system.
  // Every viewport scales the complete game shell uniformly; platform data never changes per resolution.
  const WORLD={width:1600,height:900};
  const DELIVERY_LENGTH=86436;
  const PATH=[
    {x:40,y:570},{x:190,y:570},{x:310,y:535},{x:420,y:455},{x:500,y:360},
    {x:590,y:275},{x:720,y:220},{x:870,y:210},{x:1000,y:265},{x:1070,y:360},
    {x:1080,y:450},{x:1030,y:535},{x:970,y:595},{x:1060,y:655},{x:1230,y:650},
    {x:1360,y:585},{x:1460,y:520},{x:1515,y:485}
  ];

  // anchor: gameplay hit-testing, tower placement, ranges and projectiles.
  // marker: visual placement prompt. It may differ when UI occlusion requires a small visual lift.
  // mask: covers the legacy canvas slot rendering at the gameplay anchor.
  // The authored platforms have perspective depth; their perceived centers sit about 10 logical pixels
  // below the old debug anchors. Keeping these roles explicit prevents future visual tweaks from
  // silently changing combat geometry.
  const PLATFORM_MODEL=[
    {id:'north-west',zone:'north',anchor:{x:490,y:208},marker:{x:490,y:208},mask:{x:490,y:208}},
    {id:'street-west',zone:'street',anchor:{x:276,y:448},marker:{x:276,y:448},mask:{x:276,y:448}},
    {id:'street-south',zone:'street',anchor:{x:351,y:671},marker:{x:351,y:671},mask:{x:351,y:671}},
    {id:'reactor-west',zone:'reactor',anchor:{x:602,y:521},marker:{x:602,y:521},mask:{x:602,y:521}},
    {id:'north-center',zone:'north',anchor:{x:935,y:149},marker:{x:935,y:149},mask:{x:935,y:149}},
    {id:'reactor-east',zone:'reactor',anchor:{x:895,y:524},marker:{x:895,y:524},mask:{x:895,y:524}},
    {id:'north-east',zone:'north',anchor:{x:1208,y:230},marker:{x:1208,y:230},mask:{x:1208,y:230}},
    {id:'bridge-center',zone:'bridge',anchor:{x:1134,y:550},marker:{x:1134,y:550},mask:{x:1134,y:550}},
    // The platform center is y=754, but its prompt is lifted 10px so the bottom command deck never clips it.
    {id:'bridge-south',zone:'bridge',anchor:{x:1202,y:754},marker:{x:1202,y:744},mask:{x:1202,y:754}},
    {id:'core-west',zone:'core',anchor:{x:1342,y:387},marker:{x:1342,y:387},mask:{x:1342,y:387}}
  ];

  const SLOTS=PLATFORM_MODEL.map(platform=>({
    id:platform.id,
    zone:platform.zone,
    x:platform.anchor.x,
    y:platform.anchor.y,
    markerX:platform.marker.x,
    markerY:platform.marker.y,
    maskX:platform.mask.x,
    maskY:platform.mask.y
  }));

  function resolveMapSource(){
    const delivery=window.__RENDERED_MAP_DELIVERY;
    if(typeof delivery==='string'&&delivery.length===DELIVERY_LENGTH){
      return {quality:'delivery',base64:delivery};
    }
    return null;
  }

  function rebuildPathInfo(pathInfo,points){
    let total=0;
    const seg=[];
    for(let index=0;index<points.length-1;index+=1){
      const a=points[index];
      const b=points[index+1];
      const len=Math.hypot(b.x-a.x,b.y-a.y);
      seg.push({a,b,len,start:total});
      total+=len;
    }
    pathInfo.seg.splice(0,pathInfo.seg.length,...seg);
    pathInfo.total=total;
  }

  function prepareMap(image){
    const canvas=document.createElement('canvas');
    canvas.width=WORLD.width;
    canvas.height=WORLD.height;
    const context=canvas.getContext('2d',{alpha:false});
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.filter='saturate(1.08) contrast(1.075) brightness(1.018)';
    context.drawImage(image,0,0,WORLD.width,WORLD.height);
    context.filter='none';

    const focus=context.createRadialGradient(815,430,180,815,430,970);
    focus.addColorStop(0,'rgba(18,44,66,0.025)');
    focus.addColorStop(.58,'rgba(0,0,0,0)');
    focus.addColorStop(1,'rgba(0,4,12,0.16)');
    context.fillStyle=focus;
    context.fillRect(0,0,WORLD.width,WORLD.height);
    return canvas;
  }

  function polygonPath(context,radius,sides=8){
    context.beginPath();
    for(let index=0;index<sides;index+=1){
      const angle=-Math.PI/8+index*Math.PI*2/sides;
      const x=Math.cos(angle)*radius;
      const y=Math.sin(angle)*radius;
      if(index===0) context.moveTo(x,y);
      else context.lineTo(x,y);
    }
    context.closePath();
  }

  function drawSegmentedOctagon(context,radius,color,alpha,lineWidth){
    const points=[];
    for(let index=0;index<8;index+=1){
      const angle=-Math.PI/8+index*Math.PI/4;
      points.push({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});
    }
    context.strokeStyle=color;
    context.globalAlpha=alpha;
    context.lineWidth=lineWidth;
    context.lineCap='round';
    for(let index=0;index<8;index+=1){
      const a=points[index];
      const b=points[(index+1)%8];
      const start=.17;
      const end=.43;
      context.beginPath();
      context.moveTo(a.x+(b.x-a.x)*start,a.y+(b.y-a.y)*start);
      context.lineTo(a.x+(b.x-a.x)*end,a.y+(b.y-a.y)*end);
      context.stroke();
    }
  }

  function installPlacementOverlay(game){
    if(document.getElementById('placement-node-overlay')) return;
    const shell=document.getElementById('game-shell');
    if(!shell) return;

    const overlay=document.createElement('canvas');
    overlay.id='placement-node-overlay';
    overlay.width=WORLD.width;
    overlay.height=WORLD.height;
    overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{
      position:'absolute',
      inset:'0',
      width:`${WORLD.width}px`,
      height:`${WORLD.height}px`,
      zIndex:'2',
      pointerEvents:'none',
      transformOrigin:'top left'
    });
    shell.appendChild(overlay);

    const context=overlay.getContext('2d');
    const towerAtSlot=(slotIndex)=>game.state.towers.find(tower=>tower.slot===slotIndex);

    function drawLegacyMask(slot,dragSource){
      const x=slot.maskX??slot.x;
      const y=slot.maskY??slot.y;
      const radius=dragSource?39:36;
      context.save();
      context.translate(x,y);
      const plate=context.createRadialGradient(0,-2,2,0,0,radius);
      plate.addColorStop(0,'rgba(12,15,18,.97)');
      plate.addColorStop(.68,'rgba(12,15,18,.86)');
      plate.addColorStop(1,'rgba(12,15,18,.08)');
      context.fillStyle=plate;
      context.globalAlpha=dragSource?1:.96;
      polygonPath(context,dragSource?36:33,8);
      context.fill();
      context.restore();
    }

    function drawMarker(slot,{dragSource,targeted,hovered,revealed,now}){
      const x=slot.markerX??slot.x;
      const y=slot.markerY??slot.y;
      const idleAlpha=dragSource?.62:revealed?.78:.18;
      const pulse=!dragSource&&(hovered||targeted)?1+Math.sin(now*.012)*.055:1;
      const color=dragSource?'#cda15f':targeted?'#82f1b0':hovered?'#ffd98b':'#e8b86e';

      context.save();
      context.translate(x,y);
      context.scale(pulse,pulse);

      const markerPlate=context.createRadialGradient(0,-2,2,0,0,32);
      markerPlate.addColorStop(0,'rgba(12,15,18,.82)');
      markerPlate.addColorStop(.72,'rgba(12,15,18,.56)');
      markerPlate.addColorStop(1,'rgba(12,15,18,0)');
      context.fillStyle=markerPlate;
      context.globalAlpha=dragSource?1:revealed||hovered||targeted?.86:.42;
      polygonPath(context,30,8);
      context.fill();

      context.shadowColor=color;
      context.shadowBlur=dragSource?0:targeted?18:hovered?13:revealed?5:0;
      drawSegmentedOctagon(context,targeted?29:27,color,targeted||hovered?1:idleAlpha,targeted?2.5:1.55);
      context.shadowBlur=0;

      context.globalAlpha=targeted||hovered?1:idleAlpha;
      context.strokeStyle=color;
      context.lineWidth=targeted?2.3:1.55;
      context.lineCap='round';
      context.beginPath();
      context.moveTo(-6,0);context.lineTo(6,0);
      context.moveTo(0,-6);context.lineTo(0,6);
      context.stroke();

      context.globalAlpha=dragSource?.24:revealed?.34:.12;
      context.strokeStyle='rgba(255,244,220,.9)';
      context.lineWidth=1;
      polygonPath(context,18,8);
      context.stroke();

      if((hovered||targeted)&&!dragSource){
        context.globalAlpha=1;
        context.fillStyle=color;
        context.font='800 9px ui-sans-serif,system-ui,sans-serif';
        context.textAlign='center';
        context.fillText(targeted?'DEPLOY':'PLACE',0,44);
      }
      context.restore();
    }

    function drawNode(slot,slotIndex,now){
      const state=game.state;
      const tower=towerAtSlot(slotIndex);
      const dragging=Boolean(state.drag?.moved&&state.drag.tower);
      const dragSource=Boolean(tower&&dragging&&state.drag.tower===tower);
      if(tower&&!dragSource) return;

      const hovered=state.hoverSlot===slotIndex;
      const targeted=dragging&&hovered&&!dragSource;
      const revealed=Boolean(state.selectedBuild||dragging||dragSource||(!state.waveActive&&state.towers.length<2));

      drawLegacyMask(slot,dragSource);
      drawMarker(slot,{dragSource,targeted,hovered,revealed,now});
    }

    function renderOverlay(now){
      context.clearRect(0,0,WORLD.width,WORLD.height);
      game.level.slots.forEach((slot,index)=>drawNode(slot,index,now));
      requestAnimationFrame(renderOverlay);
    }

    requestAnimationFrame(renderOverlay);
    window.__PLACEMENT_OVERLAY_READY=true;
  }

  function installPresentationStyle(){
    if(document.getElementById('rendered-map-presentation')) return;
    const style=document.createElement('style');
    style.id='rendered-map-presentation';
    style.textContent=`
      .scanlines{opacity:.006!important}
      .mission-panel{transform:scale(.84);transform-origin:left top;opacity:.64}
      .inspector{transform:scale(.84);transform-origin:right top;opacity:.66}
      .brand-block{opacity:.84}
      body.combat-active .mission-panel,
      body.combat-active .inspector{opacity:0!important;pointer-events:none;transform:scale(.8) translateY(-10px)!important}
      body.combat-active .bottom-deck:not(:hover){opacity:.5!important;transform:translateX(-50%) translateY(14px)!important}
      body.combat-active .topbar{opacity:.88}
    `;
    document.head.appendChild(style);
  }

  function applyIntegration(){
    const game=window.__NEON_TEST__;
    const source=resolveMapSource();
    if(!game||!source) return false;

    const renderedMap=new Image();
    renderedMap.decoding='async';
    renderedMap.onload=()=>{
      game.assets.background=prepareMap(renderedMap);
      game.level.path.splice(0,game.level.path.length,...PATH.map(point=>({...point})));
      game.level.slots.splice(0,game.level.slots.length,...SLOTS.map(slot=>({...slot})));
      game.level.landmarks.splice(0,game.level.landmarks.length,
        {id:'breach',x:275,y:505,r:210},
        {id:'reactor',x:810,y:390,r:230},
        {id:'bridge',x:1210,y:585,r:260}
      );
      rebuildPathInfo(game.pathInfo,game.level.path);
      installPlacementOverlay(game);

      window.__RENDERED_MAP_READY=true;
      window.__RENDERED_MAP_SOURCE=source.quality;
      window.__RENDERED_MAP_DIAGNOSTICS={
        source:source.quality,
        base64Length:source.base64.length,
        naturalWidth:renderedMap.naturalWidth,
        naturalHeight:renderedMap.naturalHeight,
        worldWidth:WORLD.width,
        worldHeight:WORLD.height,
        canvasWidth:WORLD.width,
        canvasHeight:WORLD.height,
        pathPoints:PATH.length,
        slots:SLOTS.length,
        placementOverlay:true,
        anchorModel:'game-marker-mask-v1'
      };
      window.__TOWER_PLATFORM_CALIBRATION=SLOTS.map(slot=>({...slot}));
      window.__PLACEMENT_WORLD={...WORLD};
      window.dispatchEvent(new CustomEvent('neon:rendered-map-ready',{detail:window.__RENDERED_MAP_DIAGNOSTICS}));
      delete window.__RENDERED_MAP_DELIVERY_PARTS;
      delete window.__RENDERED_MAP_DELIVERY_TAIL;
    };
    renderedMap.onerror=()=>{
      window.__RENDERED_MAP_ERROR='Unable to decode canonical delivery battlefield image';
      console.error(window.__RENDERED_MAP_ERROR);
    };
    renderedMap.src=`data:image/webp;base64,${source.base64}`;

    const canvas=document.getElementById('game');
    if(canvas) canvas.style.filter='saturate(1.015) contrast(1.015)';
    installPresentationStyle();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts+=1;
    if(applyIntegration()||attempts>400) clearInterval(timer);
  },25);
})();
