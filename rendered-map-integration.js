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

  const SLOTS=[
    {x:490,y:198,zone:'north'},
    {x:276,y:438,zone:'street'},
    {x:351,y:661,zone:'street'},
    {x:602,y:511,zone:'reactor'},
    {x:935,y:139,zone:'north'},
    {x:895,y:514,zone:'reactor'},
    {x:1208,y:220,zone:'north'},
    {x:1134,y:540,zone:'bridge'},
    {x:1202,y:744,zone:'bridge'}
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
        slots:SLOTS.length
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
