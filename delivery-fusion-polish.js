(() => {
  'use strict';

  const proto=CanvasRenderingContext2D.prototype;
  if(proto.__deliveryFusionPolished) return;
  proto.__deliveryFusionPolished=true;

  const previousDrawImage=proto.drawImage;
  const previousRoundRect=proto.roundRect;
  const previousFill=proto.fill;

  function assetKind(image){
    const source=String(image?.currentSrc||image?.src||'');
    if(source.includes('/assets/enemies/')) return 'enemy';
    return '';
  }

  proto.drawImage=function(image,...args){
    if(this.canvas?.id==='game'&&args.length===4&&assetKind(image)==='enemy'){
      let [dx,dy,dw,dh]=args;
      if(dw>25&&dw<150&&dh>25&&dh<150){
        const factor=1.115;
        const expandedW=dw*factor;
        const expandedH=dh*factor;
        dx-=(expandedW-dw)/2;
        dy-=(expandedH-dh)/2+1;
        return previousDrawImage.call(this,image,dx,dy,expandedW,expandedH);
      }
    }
    return previousDrawImage.call(this,image,...args);
  };

  proto.roundRect=function(x,y,w,h,radii){
    if(this.canvas?.id==='game'&&h===6&&radii===4){
      this.__deliveryHealthBar=true;
      return previousRoundRect.call(this,x,y+2,w,3,1.5);
    }
    return previousRoundRect.call(this,x,y,w,h,radii);
  };

  proto.fill=function(...args){
    if(this.__deliveryHealthBar){
      this.__deliveryHealthBar=false;
      const originalStyle=this.fillStyle;
      const normalized=String(originalStyle).toLowerCase();
      if(normalized==='#67f3a1') this.fillStyle='#ff687d';
      else if(normalized==='rgba(0, 0, 0, 0.8)') this.fillStyle='rgba(2,7,16,.88)';
      const result=previousFill.apply(this,args);
      this.fillStyle=originalStyle;
      return result;
    }
    return previousFill.apply(this,args);
  };

  function polishLiveEffects(){
    const game=window.__NEON_TEST__;
    if(game?.state){
      for(const rune of game.state.runes||[]){
        if(rune.__deliveryPolished) continue;
        rune.scale*=.62;
        rune.life=Math.min(rune.life,.46);
        rune.max=Math.min(rune.max,.46);
        rune.__deliveryPolished=true;
      }
      for(const beam of game.state.beams||[]){
        if(beam.kind!=='arcane'||beam.__deliveryPolished) continue;
        beam.width=Math.min(2.25,beam.width||2.25);
        beam.life=Math.min(beam.life,.2);
        beam.max=Math.min(beam.max,.2);
        beam.__deliveryPolished=true;
      }
    }
    requestAnimationFrame(polishLiveEffects);
  }

  window.__DELIVERY_FUSION_POLISH={
    enemyScaleMultiplier:1.115,
    healthBarHeight:3,
    runeScaleMultiplier:.62,
    arcaneBeamWidth:2.25
  };
  requestAnimationFrame(polishLiveEffects);
})();
