(() => {
  'use strict';

  const PATH = [
    {x:40,y:570},{x:190,y:570},{x:310,y:535},{x:420,y:455},{x:500,y:360},
    {x:590,y:275},{x:720,y:220},{x:870,y:210},{x:1000,y:265},{x:1070,y:360},
    {x:1080,y:450},{x:1030,y:535},{x:970,y:595},{x:1060,y:655},{x:1230,y:650},
    {x:1360,y:585},{x:1460,y:520},{x:1515,y:485}
  ];

  // Calibrated against the actual platform centers in the generated battlefield.
  const SLOTS = [
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

  function rebuildPathInfo(pathInfo, points) {
    let total = 0;
    const seg = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      seg.push({a, b, len, start: total});
      total += len;
    }
    pathInfo.seg.splice(0, pathInfo.seg.length, ...seg);
    pathInfo.total = total;
  }

  function enhanceMap(image) {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 900;
    const context = canvas.getContext('2d', {alpha:false, willReadFrequently:true});
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.filter = 'saturate(1.08) contrast(1.07) brightness(.99)';
    context.drawImage(image, 0, 0, 1600, 900);
    context.filter = 'none';

    // One-time restrained unsharp pass. This recovers platform and architecture edges
    // after the generated map is compressed for browser delivery.
    try {
      const frame = context.getImageData(0, 0, 1600, 900);
      const source = new Uint8ClampedArray(frame.data);
      const data = frame.data;
      const width = 1600;
      for (let y = 1; y < 899; y += 1) {
        for (let x = 1; x < 1599; x += 1) {
          const i = (y * width + x) * 4;
          const up = i - width * 4;
          const down = i + width * 4;
          for (let c = 0; c < 3; c += 1) {
            const edge = source[i + c] * 5 - source[i - 4 + c] - source[i + 4 + c] - source[up + c] - source[down + c];
            data[i + c] = Math.max(0, Math.min(255, source[i + c] + edge * .16));
          }
        }
      }
      context.putImageData(frame, 0, 0);
    } catch (error) {
      console.warn('Map enhancement skipped', error);
    }
    return canvas;
  }

  function applyIntegration() {
    const game = window.__NEON_TEST__;
    const chunks = window.__RENDERED_MAP_CHUNKS;
    if (!game || !chunks || chunks.length < 3 || chunks.some(chunk => !chunk)) return false;

    const renderedMap = new Image();
    renderedMap.decoding = 'async';
    renderedMap.onload = () => {
      game.assets.background = enhanceMap(renderedMap);
      game.level.path.splice(0, game.level.path.length, ...PATH.map(point => ({...point})));
      game.level.slots.splice(0, game.level.slots.length, ...SLOTS.map(slot => ({...slot})));
      game.level.landmarks.splice(0, game.level.landmarks.length,
        {id:'breach',x:275,y:505,r:210},
        {id:'reactor',x:810,y:390,r:230},
        {id:'bridge',x:1210,y:585,r:260}
      );
      rebuildPathInfo(game.pathInfo, game.level.path);
      window.__RENDERED_MAP_READY = true;
      window.__TOWER_PLATFORM_CALIBRATION = SLOTS.map(slot => ({...slot}));
      window.dispatchEvent(new CustomEvent('neon:rendered-map-ready'));
      delete window.__RENDERED_MAP_CHUNKS;
    };
    renderedMap.src = `data:image/webp;base64,${chunks.join('')}`;

    const canvas = document.getElementById('game');
    if (canvas) canvas.style.filter = 'saturate(1.03) contrast(1.02)';

    const style = document.createElement('style');
    style.textContent = `
      .scanlines{opacity:.018!important}
      body:not(.combat-active) .mission-panel,
      body:not(.combat-active) .inspector{background:linear-gradient(165deg,rgba(4,13,25,.76),rgba(2,7,15,.7))}
      body.combat-active .mission-panel{opacity:.1!important}
      body.combat-active .inspector:not(:hover){opacity:.13!important}
      body.combat-active .bottom-deck:not(:hover){opacity:.7!important}
    `;
    document.head.appendChild(style);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (applyIntegration() || attempts > 240) clearInterval(timer);
  }, 25);
})();
