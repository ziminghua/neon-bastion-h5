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
    rail:   {scale:.90, x:0, y:5, shadowX:34, shadowY:12, glow:'#55e9ff', muzzleY:-20, muzzleR:27},
    cryo:   {scale:.84, x:0, y:6, shadowX:30, shadowY:11, glow:'#9cecff', muzzleY:-34, muzzleR:17},
    plasma: {scale:.90, x:0, y:5, shadowX:34, shadowY:12, glow:'#ff9c38', muzzleY:-20, muzzleR:26},
    arcane: {scale:.86, x:0, y:6, shadowX:32, shadowY:11, glow:'#df6bff', muzzleY:-23, muzzleR:21}
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
    ctx.globalAlpha = .66;
    ctx.fillStyle = 'rgba(0,0,0,.78)';
    ctx.beginPath();
    ctx.ellipse(0, 24, profile.shadowX, profile.shadowY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .10;
    const glow = ctx.createRadialGradient(0, 20, 2, 0, 20, 39);
    glow.addColorStop(0, profile.glow);
    glow.addColorStop(.34, profile.glow + '55');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 20, 39, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = .22;
    ctx.strokeStyle = profile.glow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 21, 30, 11, 0, 0, Math.PI * 2);
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

    // The authored map already contains the core crystal and its platform. Keeping the
    // legacy sprite here creates a duplicated, floating crystal, so only the live rings
    // and damage feedback from drawCore are retained.
    if (kind === 'core' && dw > 80 && dh > 80) return;

    if (kind === 'enemy' && dw > 25 && dw < 130) {
      this.save();
      this.shadowColor = 'rgba(0,0,0,.82)';
      this.shadowBlur = 8;
      this.shadowOffsetY = 6;
      const nw = dw * .88;
      const nh = dh * .88;
      const result = originalDrawImage.call(this, image, dx + (dw - nw) / 2, dy + (dh - nh) / 2 + 3, nw, nh);
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
    if (this.canvas?.id === 'game' && String(this.fillStyle) === 'rgba(7, 20, 29, 0.22)') {
      this.save();
      this.globalAlpha *= .12;
      const result = originalFill.apply(this, args);
      this.restore();
      return result;
    }
    return originalFill.apply(this, args);
  };

  proto.stroke = function(...args) {
    if (this.__neonSkipLevelStroke) {
      this.__neonSkipLevelStroke = false;
      return;
    }
    if (this.canvas?.id === 'game' && String(this.strokeStyle).toLowerCase() === '#58dfff' && this.lineWidth <= 1.7) {
      this.save();
      this.globalAlpha *= .16;
      const result = originalStroke.apply(this, args);
      this.restore();
      return result;
    }
    return originalStroke.apply(this, args);
  };

  proto.fillText = function(text, ...args) {
    if (this.canvas?.id === 'game' && /^L\d+$/.test(String(text))) return;
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
        const d = Math.hypot(home.x - beam.x1, home.y - beam.y1);
        if (d < best) { best = d; nearest = tower; }
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
