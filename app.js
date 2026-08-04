(() => {
  'use strict';
  const scripts = [
    'src/app-core.js',
    'src/app-combat.js',
    'src/app-render.js',
    'src/app-ui.js'
  ];

  const loadNext = (index) => {
    if (index >= scripts.length) return;
    const script = document.createElement('script');
    script.src = scripts[index];
    script.async = false;
    script.onload = () => loadNext(index + 1);
    script.onerror = () => {
      document.body.innerHTML = `<div style="padding:30px;color:white">脚本加载失败：${scripts[index]}</div>`;
    };
    document.body.appendChild(script);
  };

  loadNext(0);
})();
