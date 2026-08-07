(() => {
  'use strict';

  const BUILD='tower-level-art-v1-20260807';
  const MAX_LEVEL=3;
  const TYPES=['rail','cryo','plasma','arcane'];
  const META={
    rail:{color:'#55e9ff',secondary:'#d8fbff'},
    cryo:{color:'#8eeaff',secondary:'#ffffff'},
    plasma:{color:'#ff8f43',secondary:'#ffe49a'},
    arcane:{color:'#df72ff',secondary:'#fff0ff'}
  };

  const proto=CanvasRenderingContext2D.prototype;
  if(proto.__towerLevelArtV1) return;
  proto.__towerLevelArtV1=true;
  const previousDrawImage=proto.drawImage;

  let game=null;
  let ready=false;
  let syncTimer=0;
  const sprites={rail:{},cryo:{},plasma:{},arcane:{}};
  const dataUrls={rail:{},cryo:{},plasma:{},arcane:{}};
  const drawCounts={rail:{1:0,2:0,3:0},cryo:{1:0,2:0,3:0},plasma:{1:0,2:0,3:0},arcane:{1:0,2:0,3:0}};

  function rgba(hex,alpha){
    const value=parseInt(hex.slice(1),16);
    return `rgba(${value>>16},${(value>>8)&255},${value&255},${alpha})`;
  }

  function kindFromImage(image){
    const source=String(image?.currentSrc||image?.src||'');
    for(const type of TYPES){
      if(source.includes(`/assets/towers/${type}.webp`)||source.endsWith(`assets/towers/${type}.webp`)) return type;
    }
    return '';
  }

  function polygon(ctx,cx,cy,radius,sides,rotation=-Math.PI/2){
    ctx.beginPath();
    for(let index=0;index<sides;index+=1){
      const angle=rotation+index*Math.PI*2/sides;
      const x=cx+Math.cos(angle)*radius;
      const y=cy+Math.sin(angle)*radius;
      index?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath();
  }

  function glowDisc(ctx,x,y,r,color,alpha=.75){
    const gradient=ctx.createRadialGradient(x,y,1,x,y,r);
    gradient.addColorStop(0,'rgba(255,255,255,.95)');
    gradient.addColorStop(.22,rgba(color,alpha));
    gradient.addColorStop(1,rgba(color,0));
    ctx.fillStyle=gradient;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }

  function drawRailAttachments(ctx,level,color,secondary){
    ctx.save();
    ctx.globalCompositeOperation='screen';
    if(level>=2){
      ctx.strokeStyle=rgba(color,.72);ctx.lineWidth=5;ctx.shadowColor=color;ctx.shadowBlur=12;
      ctx.beginPath();ctx.moveTo(48,154);ctx.lineTo(82,139);ctx.moveTo(208,154);ctx.lineTo(174,139);ctx.stroke();
      for(const x of [48,208]){
        ctx.fillStyle='rgba(11,24,34,.92)';ctx.strokeStyle=rgba(color,.9);ctx.lineWidth=3;
        polygon(ctx,x,153,18,6);ctx.fill();ctx.stroke();glowDisc(ctx,x,153,11,color,.9);
      }
      ctx.fillStyle=rgba(secondary,.78);polygon(ctx,128,61,13,4,Math.PI/4);ctx.fill();
    }
    if(level>=3){
      ctx.strokeStyle=rgba(color,.82);ctx.lineWidth=3;ctx.shadowBlur=18;
      ctx.beginPath();ctx.arc(128,142,88,Math.PI*.12,Math.PI*.88);ctx.stroke();
      for(const [x,y] of [[32,139],[224,139],[54,104],[202,104]]){
        ctx.fillStyle='rgba(7,20,29,.92)';ctx.strokeStyle=rgba(color,.95);ctx.lineWidth=3;
        polygon(ctx,x,y,14,6);ctx.fill();ctx.stroke();glowDisc(ctx,x,y,9,color,.95);
      }
      ctx.strokeStyle=rgba(secondary,.9);ctx.lineWidth=2;
      for(const offset of [-1,1]){
        ctx.beginPath();ctx.moveTo(88,79+offset*8);ctx.lineTo(42,61+offset*10);ctx.stroke();
        ctx.beginPath();ctx.moveTo(168,79+offset*8);ctx.lineTo(214,61+offset*10);ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPlasmaAttachments(ctx,level,color,secondary){
    ctx.save();ctx.globalCompositeOperation='screen';
    if(level>=2){
      ctx.strokeStyle=rgba(color,.68);ctx.lineWidth=5;ctx.shadowColor=color;ctx.shadowBlur=15;
      ctx.beginPath();ctx.arc(128,146,77,0,Math.PI*2);ctx.stroke();
      for(const [x,y] of [[54,148],[202,148]]){
        ctx.fillStyle='rgba(28,17,12,.92)';ctx.strokeStyle=rgba(color,.95);ctx.lineWidth=3;
        polygon(ctx,x,y,18,8,Math.PI/8);ctx.fill();ctx.stroke();glowDisc(ctx,x,y,12,color,.9);
      }
    }
    if(level>=3){
      ctx.strokeStyle=rgba(secondary,.8);ctx.lineWidth=2.5;ctx.shadowBlur=18;
      ctx.beginPath();ctx.arc(128,142,94,0,Math.PI*2);ctx.stroke();
      for(const [x,y] of [[37,132],[219,132],[65,91],[191,91]]){
        ctx.fillStyle='rgba(32,18,9,.9)';ctx.strokeStyle=rgba(color,.95);ctx.lineWidth=3;
        polygon(ctx,x,y,14,8,Math.PI/8);ctx.fill();ctx.stroke();glowDisc(ctx,x,y,10,color,.95);
      }
      glowDisc(ctx,128,87,31,color,.9);
      glowDisc(ctx,128,87,14,secondary,.95);
    }
    ctx.restore();
  }

  function crystal(ctx,x,y,w,h,color,alpha=.9,rotation=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalCompositeOperation='screen';
    const gradient=ctx.createLinearGradient(0,-h/2,0,h/2);
    gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.25,rgba(color,alpha));gradient.addColorStop(1,rgba(color,.08));
    ctx.fillStyle=gradient;ctx.strokeStyle=rgba(color,.82);ctx.lineWidth=1.5;ctx.shadowColor=color;ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(0,-h/2);ctx.lineTo(w/2,-h*.08);ctx.lineTo(w*.32,h/2);ctx.lineTo(-w*.32,h/2);ctx.lineTo(-w/2,-h*.08);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }

  function drawCryoAttachments(ctx,level,color,secondary){
    if(level>=2){
      crystal(ctx,52,139,25,76,color,.75,-.32);crystal(ctx,204,139,25,76,color,.75,.32);
      crystal(ctx,76,105,18,58,color,.72,-.18);crystal(ctx,180,105,18,58,color,.72,.18);
    }
    if(level>=3){
      crystal(ctx,31,142,25,88,color,.82,-.42);crystal(ctx,225,142,25,88,color,.82,.42);
      crystal(ctx,55,83,20,72,color,.76,-.28);crystal(ctx,201,83,20,72,color,.76,.28);
      ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=rgba(secondary,.74);ctx.lineWidth=2;ctx.shadowColor=color;ctx.shadowBlur=16;
      ctx.beginPath();ctx.arc(128,137,94,0,Math.PI*2);ctx.stroke();glowDisc(ctx,128,97,28,color,.82);ctx.restore();
    }
  }

  function rune(ctx,x,y,r,color,rotation=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalCompositeOperation='screen';ctx.strokeStyle=rgba(color,.9);ctx.lineWidth=3;ctx.shadowColor=color;ctx.shadowBlur=13;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();polygon(ctx,0,0,r*.64,4,Math.PI/4);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-r*.8,0);ctx.lineTo(r*.8,0);ctx.moveTo(0,-r*.8);ctx.lineTo(0,r*.8);ctx.stroke();ctx.restore();
  }

  function drawArcaneAttachments(ctx,level,color,secondary){
    if(level>=2){rune(ctx,45,126,22,color,.24);rune(ctx,211,126,22,color,-.24);}
    if(level>=3){
      rune(ctx,30,104,19,color,-.4);rune(ctx,226,104,19,color,.4);rune(ctx,57,65,15,secondary,.25);rune(ctx,199,65,15,secondary,-.25);
      ctx.save();ctx.globalCompositeOperation='screen';ctx.strokeStyle=rgba(color,.82);ctx.lineWidth=3;ctx.shadowColor=color;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(128,128,99,Math.PI*.08,Math.PI*.92);ctx.stroke();
      glowDisc(ctx,128,70,24,color,.88);ctx.restore();
    }
  }

  function renderSprite(type,level,base){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');
    const meta=META[type];
    ctx.clearRect(0,0,256,256);

    const aura=ctx.createRadialGradient(128,148,8,128,148,level===1?74:level===2?92:108);
    aura.addColorStop(0,rgba(meta.color,level===1?.10:level===2?.18:.25));aura.addColorStop(1,rgba(meta.color,0));
    ctx.fillStyle=aura;ctx.fillRect(0,25,256,220);

    if(type==='rail') drawRailAttachments(ctx,level,meta.color,meta.secondary);
    if(type==='plasma') drawPlasmaAttachments(ctx,level,meta.color,meta.secondary);
    if(type==='cryo') drawCryoAttachments(ctx,level,meta.color,meta.secondary);
    if(type==='arcane') drawArcaneAttachments(ctx,level,meta.color,meta.secondary);

    const baseSize=level===1?210:level===2?218:224;
    const x=(256-baseSize)/2;
    const y=18-(level-1)*3;
    ctx.save();ctx.shadowColor=meta.color;ctx.shadowBlur=level===1?6:level===2?10:15;ctx.drawImage(base,x,y,baseSize,baseSize);ctx.restore();

    ctx.save();ctx.globalCompositeOperation='screen';
    if(level>=2){
      ctx.strokeStyle=rgba(meta.color,.62);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(128,185,70+(level-2)*10,17+(level-2)*3,0,0,Math.PI*2);ctx.stroke();
    }
    if(level>=3){
      ctx.strokeStyle=rgba(meta.secondary,.66);ctx.lineWidth=1.5;ctx.setLineDash([5,7]);ctx.beginPath();ctx.ellipse(128,184,88,22,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.restore();

    const data=canvas.toDataURL('image/webp',.92);
    const image=new Image();image.__towerLevelSprite=true;image.__towerType=type;image.__towerLevel=level;image.src=data;
    return {image,data};
  }

  function towerPosition(tower,now=performance.now()){
    const state=game.state;
    if(state.drag?.tower===tower&&state.drag.moved) return {x:state.drag.x,y:state.drag.y-26};
    if(tower.motion){
      const raw=Math.max(0,Math.min(1,(now-tower.motion.start)/tower.motion.duration));
      const eased=1-Math.pow(1-raw,3);
      return {
        x:tower.motion.fromX+(tower.motion.toX-tower.motion.fromX)*eased,
        y:tower.motion.fromY+(tower.motion.toY-tower.motion.fromY)*eased-Math.sin(raw*Math.PI)*2.5
      };
    }
    const slot=game.level.slots[tower.slot];
    return slot?{x:slot.x,y:slot.y}:null;
  }

  function currentTowerForDraw(ctx,type){
    if(!game?.state?.towers?.length) return null;
    if(game.state.drag?.moved&&game.state.drag.tower?.type===type) return game.state.drag.tower;
    const transform=ctx.getTransform();
    let best=null;let bestDistance=Infinity;
    const now=performance.now();
    for(const tower of game.state.towers){
      if(tower.type!==type) continue;
      const position=towerPosition(tower,now);if(!position) continue;
      const distance=Math.hypot(position.x-transform.e,position.y-transform.f);
      if(distance<bestDistance){bestDistance=distance;best=tower;}
    }
    return bestDistance<135?best:null;
  }

  proto.drawImage=function towerLevelDrawImage(image,...args){
    if(this.canvas?.id!=='game'||!ready||args.length!==4||image?.__towerLevelSprite){
      return previousDrawImage.call(this,image,...args);
    }
    const type=kindFromImage(image);
    if(!type) return previousDrawImage.call(this,image,...args);
    const tower=currentTowerForDraw(this,type);
    if(!tower) return previousDrawImage.call(this,image,...args);
    const level=Math.max(1,Math.min(MAX_LEVEL,tower.level||1));
    const sprite=sprites[type]?.[level];
    if(!sprite?.complete) return previousDrawImage.call(this,image,...args);

    const alpha=this.globalAlpha;
    this.globalAlpha=0;
    previousDrawImage.call(this,image,...args);
    this.globalAlpha=alpha;

    const [dx,dy,dw,dh]=args;
    const cx=dx+dw/2;
    const cy=dy+dh/2;
    const scale=level===1?1.08:level===2?1.17:1.27;
    const width=dw*scale;
    const height=dh*scale;
    drawCounts[type][level]+=1;
    return previousDrawImage.call(this,sprite,cx-width/2,cy-height/2-(level-1)*2,width,height);
  };

  function slotAtPointer(event){
    const canvas=document.getElementById('game');
    const rect=canvas.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*1600;
    const y=(event.clientY-rect.top)/rect.height*900;
    let best=-1;let distance=72;
    game.level.slots.forEach((slot,index)=>{
      const value=Math.hypot(x-slot.x,y-slot.y);
      if(value<distance){distance=value;best=index;}
    });
    return best;
  }

  function toast(text){
    const element=document.getElementById('toast');if(!element) return;
    element.textContent=text;element.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('show'),1500);
  }

  function installMaxLevelGuard(){
    const canvas=document.getElementById('game');if(!canvas||canvas.__towerMaxLevelGuard) return;
    canvas.__towerMaxLevelGuard=true;
    canvas.addEventListener('pointerup',event=>{
      const drag=game?.state?.drag;
      if(!drag?.moved||!drag.tower||drag.tower.level<MAX_LEVEL) return;
      const slot=slotAtPointer(event);if(slot<0) return;
      const target=game.state.towers.find(tower=>tower.slot===slot);
      if(!target||target===drag.tower) return;
      if(target.type!==drag.tower.type||target.level!==MAX_LEVEL) return;
      event.preventDefault();event.stopImmediatePropagation();
      try{canvas.releasePointerCapture(event.pointerId);}catch{}
      game.state.drag=null;game.state.hoverSlot=-1;game.state.selectedTower=drag.tower;canvas.style.cursor='default';
      toast('MAX LEVEL 3 — THIS TOWER IS FULLY EVOLVED');
    },true);
  }

  function syncDom(){
    if(!ready||!game?.state) return;
    for(const tower of game.state.towers){if(tower.level>MAX_LEVEL) tower.level=MAX_LEVEL;}
    document.querySelectorAll('.tower-card[data-type] img').forEach(image=>{
      const type=image.closest('.tower-card')?.dataset.type;
      const sprite=sprites[type]?.[1];if(sprite&&image.src!==sprite.src) image.src=sprite.src;
    });
    const selected=game.state.selectedTower;
    const inspector=document.getElementById('inspectImage');
    if(selected&&inspector){
      const level=Math.max(1,Math.min(MAX_LEVEL,selected.level||1));
      const sprite=sprites[selected.type]?.[level];if(sprite&&inspector.src!==sprite.src) inspector.src=sprite.src;
    }
    const name=document.getElementById('inspectName');
    if(selected&&name&&!name.textContent.includes('MAX')&&selected.level>=MAX_LEVEL) name.textContent=`${selected.def.name} · Lv.3 MAX`;
  }

  function publish(){
    window.__TOWER_LEVEL_VISUALS__={
      build:BUILD,ready,maxLevel:MAX_LEVEL,assetCount:TYPES.length*MAX_LEVEL,
      sprites:Object.fromEntries(TYPES.map(type=>[type,[1,2,3].map(level=>({level,ready:Boolean(sprites[type][level]?.complete),dataLength:dataUrls[type][level]?.length||0}))])),
      drawCounts:structuredClone(drawCounts),
      policy:'four tower families, three generated visual stages each; level 3 is the merge cap'
    };
  }

  async function install(){
    game=window.__NEON_TEST__;
    if(!game?.state||!game?.assets) return false;
    for(const type of TYPES){
      const base=game.assets[type];if(!base?.complete) return false;
    }
    const pending=[];
    for(const type of TYPES){
      for(let level=1;level<=MAX_LEVEL;level+=1){
        const result=renderSprite(type,level,game.assets[type]);
        sprites[type][level]=result.image;dataUrls[type][level]=result.data;
        pending.push(result.image.decode?.().catch(()=>{})||Promise.resolve());
      }
    }
    await Promise.all(pending);
    ready=true;
    window.__TOWER_LEVEL_SPRITES__=sprites;
    installMaxLevelGuard();
    clearInterval(syncTimer);syncTimer=setInterval(()=>{syncDom();publish();},120);
    syncDom();publish();
    return true;
  }

  let attempts=0;
  const timer=setInterval(async()=>{
    attempts+=1;
    if(await install()||attempts>600) clearInterval(timer);
  },25);
})();
