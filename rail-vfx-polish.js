(() => {
  'use strict';

  const overlay = document.createElement('canvas');
  overlay.id = 'combatVfxOverlay';
  overlay.width = 1600;
  overlay.height = 900;
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    width: '1600px',
    height: '900px',
    zIndex: '2',
    pointerEvents: 'none',
    mixBlendMode: 'screen'
  });

  const shell = document.getElementById('game-shell');
  const scanlines = shell?.querySelector('.scanlines');
  if (!shell) return;
  shell.insertBefore(overlay, scanlines || shell.firstChild);

  const ctx = overlay.getContext('2d');

  function drawRailBeam(beam) {
    const alpha = Math.max(0, Math.min(1, beam.life / beam.max));
    const dx = beam.x2 - beam.x1;
    const dy = beam.y2 - beam.y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    ctx.globalAlpha = alpha * 0.32;
    ctx.strokeStyle = '#2bdcff';
    ctx.shadowColor = '#36dcff';
    ctx.shadowBlur = 26;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = '#85f4ff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.lineTo(beam.x2, beam.y2);
    ctx.stroke();

    ctx.translate(beam.x2, beam.y2);
    ctx.strokeStyle = '#d9fcff';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha * 0.95;
    ctx.beginPath();
    ctx.moveTo(-nx * 20, -ny * 20);
    ctx.lineTo(nx * 20, ny * 20);
    ctx.moveTo(-dx / length * 20, -dy / length * 20);
    ctx.lineTo(dx / length * 20, dy / length * 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 10 + (1 - alpha) * 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const beams = window.__NEON_TEST__?.state?.beams || [];
    for (const beam of beams) {
      if (beam.kind === 'rail' || beam.kind === 'rail-core') drawRailBeam(beam);
    }
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
