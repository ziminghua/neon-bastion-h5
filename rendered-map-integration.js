(() => {
  'use strict';

  const DESIGN={width:1600,height:900};
  const DELIVERY_LENGTH=86436;
  const PATH=[
    {x:40,y:570},{x:190,y:570},{x:310,y:535},{x:420,y:455},{x:500,y:360},
    {x:590,y:275},{x:720,y:220},{x:870,y:210},{x:1000,y:265},{x:1070,y:360},
    {x:1080,y:450},{x:1030,y:535},{x:970,y:595},{x:1060,y:655},{x:1230,y:650},
    {x:1360,y:585},{x:1460,y:520},{x:1515,y:485}
  ];

  // Pixel-calibrated against the authored platform centers in the canonical map.
  // Ten pads are available on the map while the run still enforces the 8-tower cap.
  const SLOTS=[
    {x:490,y:198,zone:'north'},
    {x:276,y:438,zone:'street'},
    {x:351,y:661,zone:'street'},
    {x:602,y:511,zone:'reactor'},
    {x:935,y:139,zone:'north'},
    {x:895,y:514,zone:'reactor'},
    {x:1208,y:220,zone:'north'},
    {x:1134,y:540,zone:'bridge'},
    {x:1202,y:744,zone:'bridge'},
    {x:1342,y:377,zone:'core'}
  ];

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
    canvas.width=DESIGN.width;
    canvas.height=DESIGN.height;
    const context=canvas.getContext('2d',{alpha:false});
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.filter='saturate(1.08) contrast(1.075) brightness(1.018)';
    context.drawImage(image,0,0,DESIGN.width,DESIGN.height);
    context.filter='none';

    const focus=context.createRadialGradient(815,430,180,815,430,970);
    focus.addColorStop(0,'rgba(18,44,66,0.025)');
    focus.addColorStop(.58,'rgba(0,0,0,0)');
    focus.addColorStop(1,'rgba(0,4,12,0.16)');
    context.fillStyle=focus;
    context.fillRect(0,0,DESIGN.width,DESIGN.height);
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
    overlay.width=DESIGN.width;
    overlay.height=DESIGN.height;
    overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{
      position:'absolute',
      inset:'0',
      width:`${DESIGN.width}px`,
      height:`${DESIGN.height}px`,
      zIndex:'2',
      pointerEvents:'none'
    });
    shell.appendChild(overlay);

    const context=overlay.getContext('2d');
    const towerAtSlot=(slotIndex)=>game.state.towers.find(tower=>tower.slot===slotIndex);

    function drawNode(slot,slotIndex,now){
      const state=game.state;
      const tower=towerAtSlot(slotIndex);
      const dragging=Boolean(state.drag?.moved&&state.drag.tower);
      const dragSource=Boolean(tower&&dragging&&state.drag.tower===tower);
      if(tower&&!dragSource) return;

      const hovered=state.hoverSlot===slotIndex;
      const targeted=dragging&&hovered&&!dragSource;
      const revealed=Boolean(state.selectedBuild||dragging||dragSource||(!state.waveActive&&state.towers.length<2));
      const idleAlpha=dragSource?.62:revealed?.78:.18;
      const pulse=!dragSource&&(hovered||targeted)?1+Math.sin(now*.012)*.055:1;
      const color=dragSource?'#cda15f':targeted?'#82f1b0':hovered?'#ffd98b':'#e8b86e';

      context.save();
      context.translate(slot.x,slot.y);
      context.scale(pulse,pulse);

      // Cover the old cyan node without flattening the metal platform beneath it.
      const plateRadius=dragSource?38:34;
      const plate=context.createRadialGradient(0,-2,2,0,0,plateRadius);
      plate.addColorStop(0,'rgba(12,15,18,.97)');
      plate.addColorStop(.68,'rgba(12,15,18,.86)');
      plate.addColorStop(1,'rgba(12,15,18,.18)');
      context.fillStyle=plate;
      context.globalAlpha=dragSource?1:revealed||hovered||targeted?.94:.56;
      polygonPath(context,dragSource?35:31,8);
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

    function renderOverlay(now){
      context.clearRect(0,0,DESIGN.width,DESIGN.height);
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
        canvasWidth:DESIGN.width,
        canvasHeight:DESIGN.height,
        pathPoints:PATH.length,
        slots:SLOTS.length,
        placementOverlay:true
      };
      window.__TOWER_PLATFORM_CALIBRATION=SLOTS.map(slot=>({...slot}));
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
