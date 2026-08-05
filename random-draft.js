(() => {
  'use strict';

  const TYPES = ['rail', 'cryo', 'plasma', 'arcane'];
  const META = {
    rail: { name: 'RAILGUN', desc: 'Fast single target', image: 'assets/towers/rail.webp', color: '#55e9ff' },
    cryo: { name: 'CRYO SPIRE', desc: 'Slow and control', image: 'assets/towers/cryo.webp', color: '#8abfff' },
    plasma: { name: 'PLASMA', desc: 'Area burst', image: 'assets/towers/plasma.webp', color: '#ff9c38' },
    arcane: { name: 'ARCANE', desc: 'Chain damage', image: 'assets/towers/arcane.webp', color: '#df6bff' }
  };

  const params = new URLSearchParams(location.search);
  let seed = Number(params.get('draftSeed')) || ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  let bag = [];
  let current = null;
  let next = null;
  let freeReroll = true;
  let paidRerolls = 0;
  let drawCount = 0;
  let observedTowerCount = 0;
  let observedWave = 0;
  let test = null;
  let rerollButton = null;
  let rerollCostLabel = null;
  let nextImage = null;
  let nextName = null;
  let nextType = null;
  let toastTimer = 0;

  function random() {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  function refillBag() {
    bag = shuffle(TYPES.flatMap(type => [type, type]));
  }

  function drawTower(excluded = []) {
    const blocked = new Set(excluded.filter(Boolean));
    if (!bag.length) refillBag();
    let index = bag.findIndex(type => !blocked.has(type));
    if (index < 0) {
      refillBag();
      index = bag.findIndex(type => !blocked.has(type));
    }
    if (index < 0) index = 0;
    const [type] = bag.splice(index, 1);
    drawCount += 1;
    return type;
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  function selectCurrentOffer() {
    if (!test || !current) return;
    test.state.selectedBuild = current;
    test.state.selectedTower = null;
    document.querySelectorAll('.tower-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.type === current);
      card.classList.toggle('draft-current', card.dataset.type === current);
      card.classList.toggle('draft-hidden', card.dataset.type !== current);
    });
    const meta = META[current];
    const selectedName = document.getElementById('selectedTowerName');
    const selectedDesc = document.getElementById('selectedTowerDesc');
    if (selectedName) selectedName.textContent = meta.name;
    if (selectedDesc) selectedDesc.textContent = `${meta.desc} · RANDOM DRAW`;
  }

  function rerollCost() {
    return freeReroll ? 0 : 20 + paidRerolls * 15;
  }

  function renderOffer() {
    if (!current || !next) return;
    selectCurrentOffer();
    const nextMeta = META[next];
    if (nextImage) nextImage.src = nextMeta.image;
    if (nextName) nextName.textContent = nextMeta.name;
    if (nextType) nextType.textContent = nextMeta.desc;
    if (rerollCostLabel) rerollCostLabel.textContent = freeReroll ? 'FREE' : `${rerollCost()} CREDITS`;
    updateRerollState();
  }

  function consumeOffer() {
    current = next;
    next = drawTower([current]);
    renderOffer();
  }

  function resetDraft() {
    bag = [];
    drawCount = 0;
    freeReroll = true;
    paidRerolls = 0;
    current = drawTower();
    next = drawTower([current]);
    observedTowerCount = test?.state.towers.length || 0;
    observedWave = test?.state.wave || 0;
    renderOffer();
  }

  function reroll() {
    if (!test) return false;
    const state = test.state;
    if (!state.running || !state.buildPhase || state.paused) {
      notify('REROLL AVAILABLE DURING BUILD PHASE');
      return false;
    }
    const cost = rerollCost();
    if (state.credits < cost) {
      notify('NOT ENOUGH CREDITS TO REROLL');
      return false;
    }
    state.credits -= cost;
    if (freeReroll) freeReroll = false;
    else paidRerolls += 1;
    const previous = current;
    current = drawTower([previous, next]);
    renderOffer();
    notify(cost ? `TOWER SIGNAL REROLLED · -${cost}` : 'FREE TOWER REROLL USED');
    return true;
  }

  function updateRerollState() {
    if (!rerollButton || !test) return;
    const cost = rerollCost();
    const state = test.state;
    rerollButton.disabled = !state.running || !state.buildPhase || state.paused || state.credits < cost;
  }

  function buildDraftUI() {
    const deck = document.getElementById('towerDeck');
    if (!deck || document.getElementById('draftNext')) return;
    deck.classList.add('draft-mode');

    const nextPanel = document.createElement('div');
    nextPanel.id = 'draftNext';
    nextPanel.className = 'draft-next';
    nextPanel.innerHTML = '<span>NEXT SIGNAL</span><div><img alt="Next tower"><p><b></b><small></small></p></div>';
    nextImage = nextPanel.querySelector('img');
    nextName = nextPanel.querySelector('b');
    nextType = nextPanel.querySelector('small');

    const rerollPanel = document.createElement('div');
    rerollPanel.className = 'draft-reroll';
    rerollPanel.innerHTML = '<span>BAD DRAW?</span><button id="draftReroll" type="button"><b>↻ REROLL</b><small></small></button>';
    rerollButton = rerollPanel.querySelector('button');
    rerollCostLabel = rerollPanel.querySelector('small');
    rerollButton.addEventListener('click', reroll);

    deck.append(nextPanel, rerollPanel);

    const style = document.createElement('style');
    style.textContent = `
      .tower-deck.draft-mode{grid-template-columns:minmax(285px,1fr) 188px 160px;align-items:stretch}
      .tower-card.draft-hidden{display:none!important}
      .tower-card.draft-current{display:grid;grid-template-columns:92px 1fr auto;padding-right:16px;border-color:var(--accent);background:linear-gradient(110deg,color-mix(in srgb,var(--accent) 10%,#061224),rgba(4,13,27,.94));box-shadow:inset 0 0 34px color-mix(in srgb,var(--accent) 10%,transparent)}
      .tower-card.draft-current:before{content:'CURRENT DRAW';position:absolute;left:96px;top:7px;color:var(--accent);font-size:7px;font-weight:900;letter-spacing:.2em}
      .tower-card.draft-current img{width:88px;height:98px}
      .tower-card.draft-current span{padding-top:12px}
      .tower-card.draft-current b{font-size:15px}
      .draft-next,.draft-reroll{min-width:0;padding:8px 10px;border:1px solid rgba(117,204,235,.18);background:rgba(4,13,27,.82)}
      .draft-next>span,.draft-reroll>span{display:block;color:#6d91a4;font-size:7px;font-weight:850;letter-spacing:.18em}
      .draft-next>div{display:flex;align-items:center;gap:5px;height:78px}
      .draft-next img{width:72px;height:72px;object-fit:contain;opacity:.72;filter:drop-shadow(0 0 9px rgba(90,225,255,.25))}
      .draft-next p{min-width:0;margin:0}.draft-next b{display:block;color:#bceeff;font-size:10px}.draft-next small{display:block;margin-top:5px;color:#688b9d;font-size:8px;line-height:1.35}
      .draft-reroll{display:flex;flex-direction:column;gap:8px}.draft-reroll button{flex:1;color:#d9fbff;border:1px solid rgba(82,233,255,.35);background:linear-gradient(145deg,rgba(10,39,63,.92),rgba(5,15,29,.95));cursor:pointer}
      .draft-reroll button:hover:not(:disabled){filter:brightness(1.18)}.draft-reroll button:disabled{opacity:.38;cursor:default}
      .draft-reroll b,.draft-reroll small{display:block}.draft-reroll b{font-size:11px;letter-spacing:.08em}.draft-reroll small{margin-top:6px;color:#ffd364;font-size:8px}
    `;
    document.head.appendChild(style);

    const introCopy = document.querySelector('.intro-card p');
    if (introCopy) introCopy.textContent = 'Draw one tower at a time, adapt your formation, reroll bad signals, and survive a compact five-wave run.';
    const firstFeature = document.querySelector('.intro-features span');
    if (firstFeature) firstFeature.textContent = 'RANDOM DRAFT';
  }

  function tick() {
    if (!test) return;
    const state = test.state;
    if (state.wave !== observedWave) {
      observedWave = state.wave;
      freeReroll = true;
      paidRerolls = 0;
      renderOffer();
    }

    const towerCount = state.towers.length;
    if (towerCount > observedTowerCount) {
      const built = towerCount - observedTowerCount;
      for (let index = 0; index < built; index += 1) consumeOffer();
    }
    observedTowerCount = towerCount;
    updateRerollState();
    requestAnimationFrame(tick);
  }

  function initialize() {
    test = window.__NEON_TEST__;
    buildDraftUI();
    resetDraft();

    document.getElementById('enterBtn')?.addEventListener('click', () => setTimeout(resetDraft));
    document.getElementById('restartBtn')?.addEventListener('click', () => setTimeout(resetDraft));

    window.__NEON_DRAFT__ = {
      get current() { return current; },
      get next() { return next; },
      get bag() { return [...bag]; },
      get freeReroll() { return freeReroll; },
      get rerollCost() { return rerollCost(); },
      get drawCount() { return drawCount; },
      reroll,
      reset: resetDraft,
      snapshot: () => ({ current, next, bag: [...bag], freeReroll, paidRerolls, rerollCost: rerollCost(), drawCount })
    };

    requestAnimationFrame(tick);
  }

  const readyTimer = setInterval(() => {
    if (!window.__NEON_TEST__) return;
    clearInterval(readyTimer);
    initialize();
  }, 25);
})();
