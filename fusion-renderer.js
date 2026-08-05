(() => {
  'use strict';

  const proto = CanvasRenderingContext2D.prototype;
  if (proto.__neonFusionPatched) return;
  proto.__neonFusionPatched = true;

  const originalDrawImage = proto.drawImage;
  const originalRoundRect = proto.roundRect;
  const originalEllipse = proto.ellipse;
  const originalArc = proto.arc;
  const originalFillRect = proto.fillRect;
  const originalFill = proto.fill;
  const originalStroke = proto.stroke;
  const originalFillText = proto.fillText;

  const towerProfiles = {
    rail:   {scale:1.08, x:0, y:-2, shadowX:36, shadowY:12, glow:'#55e9ff', muzzleY:-28, muzzleR:31, rimY:25},
    cryo:   {scale:1.03, x:0, y:0, shadowX:33, shadowY:11, glow:'#9cecff', muzzleY:-42, muzzleR:20, rimY:25},
    plasma: {scale:1.10, x:0, y:-2, shadowX:37, shadowY:12, glow:'#ff9c38', muzzleY:-28, muzzleR:32, rimY:25},
    arcane: {scale:1.06, x:0, y:0, shadowX:34, shadowY:11, glow:'#df6bff', muzzleY:-31, muzzleR:25, rimY:25}
  };

  window.__FUSION_RENDERER_DIAGNOSTICS = {
    version: 2,
    towerProfiles: Object.fromEntries(Object.entries(towerProfiles).map(([key, value]) => [key, {...value}]))
  };

  function assetKind(image) {
    const src = String(image?.currentSrc || image?.src || '');
    for (const kind of Object.keys(towerProfiles)) {
      if (src.includes(`/assets/towers/${kind}.webp`)) return kind;
    }
    if (src.includes('/assets/world/core.webp')) return 'core';
    if (src.includes('/assets/enemies/')) return 'enemy';
    if (src.includes('/assets/fx/hit.webp')) return 'hitFx';
    return '';
  }

  function isEmptyNodeStroke(value) {
    const color = String(value).replace(/\s+/g, '').toLowerCase();
    return color === '#58dfff' || color === 'rgb(88,223,255)' || color === 'rgba(88,223,255,1)';
  }

  function drawTowerFoundation(ctx, profile) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .74;
    ctx.fillStyle = 'rgba(0,0,0,.82)';
    ctx.beginPath();
    originalEllipse.call(ctx, 0, 27, profile.shadowX, profile.shadowY, 0, 0, Math.PI * 2);
    originalFill.call(ctx);

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .17;
    const glow = ctx.createRadialGradient(0, 21, 3, 0, 21, 44);
    glow.addColorStop(0, profile.glow);
    glow.addColorStop(.34, profile.glow + '6b');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    originalEllipse.call(ctx, 0, 21, 43, 19, 0, 0, Math.PI * 2);
    originalFill.call(ctx);

    ctx.globalAlpha = .28;
    ctx.strokeStyle = profile.glow;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    originalEllipse.call(ctx, 0, 22, 31, 11, 0, 0, Math.PI * 2);
    originalStroke.call(ctx);
    ctx.restore();
  }

  function drawTowerFrontRim(ctx, profile) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalAlpha = .50;
    ctx.fillStyle = 'rgba(2,9,18,.82)';
    ctx.beginPath();
    originalEllipse.call(ctx, 0, profile.rimY, 31, 10, 0, 0, Math.PI);
    ctx.lineTo(-31, profile.rimY);
    ctx.closePath();
    originalFill.call(ctx);

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .34;
    ctx.strokeStyle = profile.glow;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    originalEllipse.call(ctx, 0, profile.rimY, 31, 10, 0, 0, Math.PI);
    originalStroke.call(ctx);

    ctx.globalAlpha = .15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = .75;
    ctx.beginPath();
    originalEllipse.call(ctx, 0, profile.rimY - 1, 25, 7, 0, .08, Math.PI - .08);
    originalStroke.call(ctx);
    ctx.restore();
  }

  proto.drawImage = function(image, ...args) {
    if (this.canvas?.id !== 'game' || args.length !== 4) {
      return originalDrawImage.call(this, image, ...args);
    }

    const kind = assetKind(image);
    let [dx, dy, dw, dh] = args;

    if (kind === 'hitFx') return;

    if (towerProfiles[kind] && dw > 70 && dw < 150 && dh > 70 && dh < 150) {
      const profile = towerProfiles[kind];
      drawTowerFoundation(this, profile);
      const nw = dw * profile.scale;
      const nh = dh * profile.scale;
      dx += (dw - nw) / 2 + profile.x;
      dy += (dh - nh) / 2 + profile.y;
      const result = originalDrawImage.call(this, image, dx, dy, nw, nh);
      drawTowerFrontRim(this, profile);
      return result;
    }

    if (kind === 'core' && dw > 80 && dh > 80) return;

    if (kind === 'enemy' && dw > 25 && dw < 130) {
      this.save();
      this.globalAlpha *= .55;
      this.fillStyle = 'rgba(0,0,0,.76)';
      this.beginPath();
      originalEllipse.call(this, dx + dw / 2, dy + dh * .79, dw * .28, dh * .11, 0, 0, Math.PI * 2);
      originalFill.call(this);
      this.globalAlpha /= .55;
      this.shadowColor = 'rgba(0,0,0,.78)';
      this.shadowBlur = 7;
      this.shadowOffsetY = 5;
      const nw = dw * .94;
      const nh = dh * .94;
      const result = originalDrawImage.call(this, image, dx + (dw - nw) / 2, dy + (dh - nh) / 2 + 1, nw, nh);
      this.restore();
      return result;
    }

    return originalDrawImage.call(this, image, ...args);
  };

  proto.roundRect = function(x, y, w, h, radii) {
    if (this.canvas?.id === 'game' && x === 25 && y === 16 && w === 38 && h === 21) {
      this.__neonSkipShapeOps = 2;
      this.beginPath();
      this.rect(0, 0, 0, 0);
      return this;
    }
    if (this.canvas?.id === 'game' && x === -34 && y === -38 && w === 54 && h === 76) {
      this.__neonSkipShapeOps = 2;
      this.beginPath();
      this.rect(0, 0, 0, 0);
      return this;
    }
    if (this.canvas?.id === 'game' && h === 6 && radii === 4) {
      this.__neonHealthBar = true;
      return originalRoundRect.call(this, x, y + 1, w, 4, 2);
    }
    return originalRoundRect.call(this, x, y, w, h, radii);
  };

  proto.ellipse = function(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
    if (this.canvas?.id === 'game' && ((radiusX === 69 && radiusY === 29) || (radiusX === 49 && radiusY === 16))) {
      this.__neonSkipShapeOps = radiusX === 69 ? 2 : 1;
      this.beginPath();
      this.rect(0, 0, 0, 0);
      return;
    }
    return originalEllipse.call(this, x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
  };

  proto.arc = function(x, y, radius, startAngle, endAngle, counterclockwise) {
    if (this.canvas?.id === 'game' && x === 0 && y === -4 && radius >= 55 && radius <= 61) {
      this.__neonSkipShapeOps = 1;
      this.beginPath();
      this.rect(0, 0, 0, 0);
      return;
    }
    return originalArc.call(this, x, y, radius, startAngle, endAngle, counterclockwise);
  };

  proto.fillRect = function(x, y, w, h) {
    if (this.canvas?.id === 'game' && x === -24 && w === 31 && h === 3) return;
    return originalFillRect.call(this, x, y, w, h);
  };

  proto.fill = function(...args) {
    if (this.__neonSkipShapeOps > 0) {
      this.__neonSkipShapeOps -= 1;
      return;
    }
    if (this.__neonHealthBar) {
      this.__neonHealthBar = false;
      if (String(this.fillStyle).toLowerCase() === '#67f3a1') {
        this.save();
        this.fillStyle = '#ff586f';
        const result = originalFill.apply(this, args);
        this.restore();
        return result;
      }
    }
    if (this.canvas?.id === 'game' && String(this.fillStyle) === 'rgba(7, 20, 29, 0.22)') {
      if (document.body.classList.contains('combat-active')) return;
      this.save();
      this.globalAlpha *= .07;
      const result = originalFill.apply(this, args);
      this.restore();
      return result;
    }
    return originalFill.apply(this, args);
  };

  proto.stroke = function(...args) {
    if (this.__neonSkipShapeOps > 0) {
      this.__neonSkipShapeOps -= 1;
      return;
    }
    if (this.canvas?.id === 'game' && isEmptyNodeStroke(this.strokeStyle) && this.lineWidth <= 1.7) {
      if (document.body.classList.contains('combat-active')) return;
      this.save();
      this.globalAlpha *= .09;
      const result = originalStroke.apply(this, args);
      this.restore();
      return result;
    }
    return originalStroke.apply(this, args);
  };

  proto.fillText = function(text, ...args) {
    if (this.canvas?.id === 'game' && (/^L\d+$/.test(String(text)) || String(text) === 'BREACH')) return;
    return originalFillText.call(this, text, ...args);
  };

  function calibrateCombatOrigins() {
    const game = window.__NEON_TEST__;
    if (!game?.state || !game.level?.slots) {
      requestAnimationFrame(calibrateCombatOrigins);
      return;
    }

    for (const projectile of game.state.projectiles || []) {
      if (projectile.__fusionOrigin || !projectile.tower) continue;
      const tower = projectile.tower;
      const home = game.level.slots[tower.slot];
      const profile = towerProfiles[tower.type];
      if (!home || !profile) continue;
      const angle = tower.aim || -Math.PI / 2;
      projectile.x = home.x + Math.cos(angle) * profile.muzzleR;
      projectile.y = home.y + profile.muzzleY + Math.sin(angle) * profile.muzzleR;
      projectile.__fusionOrigin = true;
    }

    for (const beam of game.state.beams || []) {
      if (beam.__fusionOrigin || !String(beam.kind).startsWith('rail')) continue;
      let nearest = null;
      let best = Infinity;
      for (const tower of game.state.towers || []) {
        if (tower.type !== 'rail') continue;
        const home = game.level.slots[tower.slot];
        const distance = Math.hypot(home.x - beam.x1, home.y - beam.y1);
        if (distance < best) {
          best = distance;
          nearest = tower;
        }
      }
      if (nearest) {
        const home = game.level.slots[nearest.slot];
        const profile = towerProfiles.rail;
        const angle = nearest.aim || -Math.PI / 2;
        beam.x1 = home.x + Math.cos(angle) * profile.muzzleR;
        beam.y1 = home.y + profile.muzzleY + Math.sin(angle) * profile.muzzleR;
      }
      beam.__fusionOrigin = true;
    }

    requestAnimationFrame(calibrateCombatOrigins);
  }

  requestAnimationFrame(calibrateCombatOrigins);
})();
