(() => {
  'use strict';

  const PATH = [
    {x:40,y:570},{x:190,y:570},{x:310,y:535},{x:420,y:455},{x:500,y:360},
    {x:590,y:275},{x:720,y:220},{x:870,y:210},{x:1000,y:265},{x:1070,y:360},
    {x:1080,y:450},{x:1030,y:535},{x:970,y:595},{x:1060,y:655},{x:1230,y:650},
    {x:1360,y:585},{x:1460,y:520},{x:1515,y:485}
  ];

  const SLOTS = [
    {x:490,y:208,zone:'north'},
    {x:284,y:451,zone:'street'},
    {x:356,y:679,zone:'street'},
    {x:620,y:523,zone:'reactor'},
    {x:955,y:137,zone:'north'},
    {x:936,y:535,zone:'reactor'},
    {x:1234,y:220,zone:'north'},
    {x:1180,y:554,zone:'bridge'},
    {x:1233,y:780,zone:'bridge'}
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

  function applyIntegration() {
    const game = window.__NEON_TEST__;
    const chunks = window.__RENDERED_MAP_CHUNKS;
    if (!game || !chunks || chunks.length < 3 || chunks.some(chunk => !chunk)) return false;

    const renderedMap = new Image();
    renderedMap.decoding = 'async';
    renderedMap.onload = () => {
      game.assets.background = renderedMap;
      game.level.path.splice(0, game.level.path.length, ...PATH.map(point => ({...point})));
      game.level.slots.splice(0, game.level.slots.length, ...SLOTS.map(slot => ({...slot})));
      game.level.landmarks.splice(0, game.level.landmarks.length,
        {id:'breach',x:270,y:530,r:210},
        {id:'reactor',x:810,y:390,r:230},
        {id:'bridge',x:1240,y:595,r:250}
      );
      rebuildPathInfo(game.pathInfo, game.level.path);
      window.dispatchEvent(new CustomEvent('neon:rendered-map-ready'));
      window.__RENDERED_MAP_READY = true;
      delete window.__RENDERED_MAP_CHUNKS;
    };
    renderedMap.src = `data:image/webp;base64,${chunks.join('')}`;

    const canvas = document.getElementById('game');
    if (canvas) canvas.style.filter = 'saturate(1.08) contrast(1.05) brightness(.98)';

    const style = document.createElement('style');
    style.textContent = `
      .scanlines{opacity:.035!important}
      body:not(.combat-active) .mission-panel,
      body:not(.combat-active) .inspector{background:linear-gradient(165deg,rgba(4,13,25,.82),rgba(2,7,15,.78))}
      body.combat-active .mission-panel{opacity:.16!important}
      body.combat-active .inspector:not(:hover){opacity:.2!important}
    `;
    document.head.appendChild(style);
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (applyIntegration() || attempts > 200) clearInterval(timer);
  }, 25);
})();
