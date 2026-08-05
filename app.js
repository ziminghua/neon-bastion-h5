(() => {
  'use strict';
  const scripts = [
    'src/platform.js',
    'src/analytics.js',
    'src/storage.js',
    'src/monetization.js',
    'src/app-core.js',
    'src/app-combat.js',
    'src/app-render.js',
    'src/app-ui.js',
    'src/monetization-hooks.js'
  ];

  const loadNext = (index) => {
    if (index >= scripts.length) {
      Promise.resolve(window.GamePlatform?.init?.({ gameId: 'neon-bastion-h5', version: '0.2.0' }))
        .catch(error => console.error('Platform initialization failed', error));
      return;
    }
    const script = document.createElement('script');
    script.src = scripts[index];
    script.async = false;
    script.onload = () => loadNext(index + 1);
    script.onerror = () => {
      document.body.innerHTML = `<div style="padding:30px;color:white">Script failed to load: ${scripts[index]}</div>`;
    };
    document.body.appendChild(script);
  };

  loadNext(0);
})();
