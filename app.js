(() => {
  'use strict';

  const scripts = [
    'src/app-core.js',
    'src/app-combat.js',
    'src/app-render.js',
    'src/app-ui.js'
  ];

  const transparentPixel =
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const unusedAssets = new Set(['shield', 'rail_bolt', 'chain']);

  function installResilientAssetLoader() {
    loadAssets = () => {
      const failures = [];
      const entries = Object.entries(ASSET_PATHS).filter(([key]) => !unusedAssets.has(key));

      return Promise.all(entries.map(([key, src]) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          img[key] = image;
          resolve();
        };
        image.onerror = () => {
          failures.push(src);
          const fallback = new Image();
          fallback.onload = () => {
            img[key] = fallback;
            resolve();
          };
          fallback.src = transparentPixel;
        };
        image.src = src;
      }))).then(() => {
        if (!failures.length) return;

        window.__assetLoadFailures = failures;
        console.error('Image assets failed to load:', failures);

        const notice = document.createElement('div');
        notice.id = 'asset-load-warning';
        notice.style.cssText = [
          'position:fixed',
          'z-index:99999',
          'left:12px',
          'right:12px',
          'bottom:12px',
          'padding:10px 14px',
          'border:1px solid #ff6577',
          'background:rgba(20,4,12,.94)',
          'color:#ffd9df',
          'font:13px/1.45 system-ui,sans-serif',
          'word-break:break-all'
        ].join(';');
        notice.textContent = `部分图片加载失败：${failures.join(', ')}`;
        document.body.appendChild(notice);
      });
    };
  }

  const loadNext = (index) => {
    if (index >= scripts.length) return;

    const script = document.createElement('script');
    script.src = scripts[index];
    script.async = false;
    script.onload = () => {
      if (scripts[index] === 'src/app-core.js') installResilientAssetLoader();
      loadNext(index + 1);
    };
    script.onerror = () => {
      document.body.innerHTML = `<div style="padding:30px;color:white">脚本加载失败：${scripts[index]}</div>`;
    };
    document.body.appendChild(script);
  };

  loadNext(0);
})();
