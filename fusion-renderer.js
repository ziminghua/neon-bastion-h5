(() => {
  'use strict';

  const proto = CanvasRenderingContext2D.prototype;
  if (proto.__neonFusionPatched) return;
  proto.__neonFusionPatched = true;

  const originalDrawImage = proto.drawImage;
  const originalRoundRect = proto.roundRect;
  const originalFill = proto.fill;
  const originalStroke = proto.stroke;
  const originalFillText = proto.fillText;

  const towerProfiles = {
    rail:   {scale:.73, x:0, y:8, shadowX:31, shadowY:11, glow:'#55e9ff'},
    cryo:   {scale:.68, x:0, y:9, shadowX:27, shadowY:10, glow:'#9cecff'},
    plasma: {scale:.74, x:0, y:8, shadowX:31, shadowY:12, glow:'#ff9c38'},
    arcane: {scale:.70, x:0, y:9, shadowX:29, shadowY:11, glow:'#df6bff'}
  };

  function assetKind(image) {
    const src = String(image?.currentSrc || image?.src || '');
    for (const kind of Object.keys(towerProfiles)) {
      if (src.includes(`/assets/towers/${kind}.webp`)) return kind;
    }
    if (src.includes('/assets/world/core.webp')) return 'core';
    if (src.includes('/assets/enemies/')) return 'enemy';
    return '';
  }

  function drawTowerFoundation(ctx, profile) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .52;
    ctx.fillStyle = 'rgba(0,0,0,.74)';
    ctx.beginPath();
    ctx.ellipse(0, 23, profile.shadowX, profile.shadowY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .18;
    const glow = ctx.createRadialGradient(0, 19, 2, 0, 19, 37);
    glow.addColorStop(0, profile.glow);
    glow.addColorStop(.34, profile.glow + '66');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 19, 37, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = .33;
    ctx.strokeStyle = profile.glow;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 20, 28, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  proto.drawImage = function(image, ...args) {
    if (this.canvas?.id !== 'game' || args.length !== 4) {
      return originalDrawImage.call(this, image, ...args);
    }

    const kind = assetKind(image);
    let [dx, dy, dw, dh] = args;

    if (towerProfiles[kind] && dw > 70 && dw < 150 && dh > 70 && dh < 150) {
      const profile = towerProfiles[kind];
      drawTowerFoundation(this, profile);
      const nw = dw * profile.scale;
      const nh = dh * profile.scale;
      dx += (dw - nw) / 2 + profile.x;
      dy += (dh - nh) / 2 + profile.y;
      return originalDrawImage.call(this, image, dx, dy, nw, nh);
    }

    if (kind === 'core' && dw > 80 && dh > 80) {
      const scale = .76;
      const nw = dw * scale;
      const nh = dh * scale;
      dx += (dw - nw) / 2;
      dy += (dh - nh) / 2 + 10;
      this.save();
      this.globalCompositeOperation = 'screen';
      this.globalAlpha = .72;
      const result = originalDrawImage.call(this, image, dx, dy, nw, nh);
      this.restore();
      return result;
    }

    if (kind === 'enemy' && dw > 25 && dw < 130) {
      this.save();
      this.shadowColor = 'rgba(0,0,0,.72)';
      this.shadowBlur = 8;
      this.shadowOffsetY = 6;
      const nw = dw * .92;
      const nh = dh * .92;
      const result = originalDrawImage.call(this, image, dx + (dw - nw) / 2, dy + (dh - nh) / 2 + 2, nw, nh);
      this.restore();
      return result;
    }

    return originalDrawImage.call(this, image, ...args);
  };

  proto.roundRect = function(x, y, w, h, radii) {
    if (this.canvas?.id === 'game' && x === 25 && y === 16 && w === 38 && h === 21) {
      this.__neonHideLevelBadge = true;
      this.beginPath();
      this.rect(0, 0, 0, 0);
      return this;
    }
    return originalRoundRect.call(this, x, y, w, h, radii);
  };

  proto.fill = function(...args) {
    if (this.__neonHideLevelBadge) {
      this.__neonHideLevelBadge = false;
      this.__neonSkipLevelStroke = true;
      return;
    }
    return originalFill.apply(this, args);
  };

  proto.stroke = function(...args) {
    if (this.__neonSkipLevelStroke) {
      this.__neonSkipLevelStroke = false;
      return;
    }
    return originalStroke.apply(this, args);
  };

  proto.fillText = function(text, ...args) {
    if (this.canvas?.id === 'game' && /^L\d+$/.test(String(text))) return;
    return originalFillText.call(this, text, ...args);
  };
})();
