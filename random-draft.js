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
  let currentCard = null;
  let nextPanel = null;
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

  function replaySignalAnimation(element) {
    if (!element) return;
    element.classList.remove('signal-enter');
    void element.offsetWidth;
    element.classList.add('signal-enter');
  }

  function selectCurrentOffer() {
    if (!test || !current) return;
    test.state.selectedBuild = current;
    test.state.selectedTower = null;
    currentCard = null;

    document.querySelectorAll('.tower-card').forEach(card => {
      const isCurrent = card.dataset.type === current;
      card.classList.toggle('selected', isCurrent);
      card.classList.toggle('draft-current', isCurrent);
      card.classList.toggle('draft-hidden', !isCurrent);
      if (isCurrent) {
        currentCard = card;
        card.setAttribute('aria-label', `${META[current].name}, active random tower. Drag to a defense node.`);
      }
    });

    const meta = META[current];
    const selectedName = document.getElementById('selectedTowerName');
    const selectedDesc = document.getElementById('selectedTowerDesc');
    if (selectedName) selectedName.textContent = meta.name;
    if (selectedDesc) selectedDesc.textContent = `${meta.desc} · RANDOM DRAW`;
    replaySignalAnimation(currentCard);
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
    if (nextPanel) nextPanel.style.setProperty('--next-color', nextMeta.color);
    if (rerollCostLabel) rerollCostLabel.textContent = freeReroll ? 'FREE THIS WAVE' : `${rerollCost()} CREDITS`;
    replaySignalAnimation(nextPanel);
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
    const bottomDeck = document.querySelector('.bottom-deck');
    if (!deck || document.getElementById('draftNext')) return;
    deck.classList.add('draft-mode');
    bottomDeck?.classList.add('draft-layout');

    const queue = document.createElement('div');
    queue.className = 'draft-queue';

    nextPanel = document.createElement('div');
    nextPanel.id = 'draftNext';
    nextPanel.className = 'draft-next';
    nextPanel.innerHTML = `
      <span class="draft-label">UP NEXT</span>
      <div class="draft-next-body">
        <img alt="Next tower">
        <p><b></b><small></small></p>
      </div>
    `;
    nextImage = nextPanel.querySelector('img');
    nextName = nextPanel.querySelector('b');
    nextType = nextPanel.querySelector('small');

    rerollButton = document.createElement('button');
    rerollButton.id = 'draftReroll';
    rerollButton.className = 'draft-reroll';
    rerollButton.type = 'button';
    rerollButton.innerHTML = `
      <i aria-hidden="true">↻</i>
      <span><b>RESCAN</b><small></small></span>
    `;
    rerollCostLabel = rerollButton.querySelector('small');
    rerollButton.addEventListener('click', reroll);

    queue.append(nextPanel, rerollButton);
    deck.append(queue);

    const style = document.createElement('style');
    style.id = 'randomDraftPolish';
    style.textContent = `
      .bottom-deck.draft-layout{
        height:122px;
        gap:12px;
        padding:9px 10px;
        border:1px solid rgba(88,222,255,.34);
        border-top-color:rgba(108,236,255,.58);
        background:
          linear-gradient(90deg,rgba(34,112,150,.08),transparent 22%,transparent 78%,rgba(120,75,210,.08)),
          linear-gradient(180deg,rgba(5,18,35,.97),rgba(2,8,18,.98));
        box-shadow:0 18px 55px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.035);
      }
      .bottom-deck.draft-layout:before{
        content:'';
        position:absolute;
        left:18px;
        right:18px;
        top:-1px;
        height:1px;
        background:linear-gradient(90deg,transparent,#55e9ff 18%,#d75dff 55%,transparent);
        opacity:.7;
        pointer-events:none;
      }
      .bottom-deck.draft-layout .tower-deck{
        min-width:0;
      }
      .bottom-deck.draft-layout .command-copy{
        display:none;
      }
      .bottom-deck.draft-layout .emp-button{
        width:138px;
        flex:0 0 138px;
        border-color:rgba(190,89,255,.34);
        background:linear-gradient(155deg,rgba(65,26,104,.7),rgba(6,16,33,.96));
      }
      .bottom-deck.draft-layout .start-wave{
        width:190px;
        flex:0 0 190px;
      }
      .tower-deck.draft-mode{
        display:grid;
        grid-template-columns:minmax(430px,1fr) 286px;
        gap:12px;
        align-items:stretch;
      }
      .tower-card.draft-hidden{
        display:none!important;
      }
      .tower-card.draft-current{
        position:relative;
        display:grid;
        grid-template-columns:118px minmax(0,1fr) 92px;
        align-items:center;
        gap:14px;
        min-width:0;
        height:100%;
        padding:8px 16px 8px 5px;
        border:1px solid color-mix(in srgb,var(--accent) 82%,white 18%);
        background:
          linear-gradient(105deg,color-mix(in srgb,var(--accent) 15%,#061124),rgba(5,15,31,.96) 46%,rgba(4,12,25,.98)),
          repeating-linear-gradient(90deg,transparent 0 31px,rgba(255,255,255,.018) 32px);
        box-shadow:
          inset 0 0 42px color-mix(in srgb,var(--accent) 10%,transparent),
          0 0 24px color-mix(in srgb,var(--accent) 9%,transparent);
        overflow:hidden;
      }
      .tower-card.draft-current:before{
        content:'ACTIVE SIGNAL';
        position:absolute;
        left:126px;
        top:10px;
        color:color-mix(in srgb,var(--accent) 86%,white 14%);
        font-size:7px;
        font-weight:900;
        letter-spacing:.24em;
      }
      .tower-card.draft-current:after{
        content:'DRAG TO A NODE';
        position:absolute;
        left:126px;
        bottom:10px;
        color:#66899c;
        font-size:7px;
        font-weight:800;
        letter-spacing:.16em;
      }
      .tower-card.draft-current:hover{
        transform:translateY(-2px);
        border-color:white;
        background:
          linear-gradient(105deg,color-mix(in srgb,var(--accent) 20%,#07162d),rgba(7,20,39,.98) 48%,rgba(4,12,25,.98));
      }
      .tower-card.draft-current img{
        width:112px;
        height:108px;
        object-fit:contain;
        transform:translateY(-1px);
        filter:drop-shadow(0 0 15px color-mix(in srgb,var(--accent) 46%,transparent));
      }
      .tower-card.draft-current>span{
        min-width:0;
        padding:10px 0 8px;
      }
      .tower-card.draft-current b{
        font-size:17px;
        letter-spacing:.075em;
      }
      .tower-card.draft-current small{
        margin-top:6px;
        color:#94afbd;
        font-size:9px;
      }
      .tower-card.draft-current>strong{
        position:relative;
        display:grid;
        place-items:center;
        width:78px;
        height:55px;
        padding-top:2px;
        color:#ffe075;
        border:1px solid rgba(255,214,94,.34);
        background:rgba(36,29,9,.34);
        font-size:16px;
        clip-path:polygon(10% 0,100% 0,100% 78%,88% 100%,0 100%,0 20%);
      }
      .tower-card.draft-current>strong:after{
        content:'CREDITS';
        position:absolute;
        bottom:6px;
        color:#a28d48;
        font-size:6px;
        letter-spacing:.15em;
      }
      .draft-queue{
        display:grid;
        grid-template-columns:minmax(0,1fr) 96px;
        min-width:0;
        height:100%;
        border:1px solid rgba(105,195,225,.18);
        background:linear-gradient(145deg,rgba(7,22,40,.9),rgba(3,10,22,.96));
        overflow:hidden;
      }
      .draft-next{
        --next-color:#55e9ff;
        position:relative;
        min-width:0;
        padding:10px 11px 8px;
        background:radial-gradient(circle at 30% 58%,color-mix(in srgb,var(--next-color) 10%,transparent),transparent 54%);
      }
      .draft-next:after{
        content:'';
        position:absolute;
        right:0;
        top:12px;
        bottom:12px;
        width:1px;
        background:linear-gradient(transparent,rgba(108,218,255,.28),transparent);
      }
      .draft-label{
        display:block;
        color:#6f95a7;
        font-size:7px;
        font-weight:900;
        letter-spacing:.22em;
      }
      .draft-next-body{
        display:flex;
        align-items:center;
        gap:7px;
        height:79px;
      }
      .draft-next img{
        width:78px;
        height:78px;
        flex:0 0 78px;
        object-fit:contain;
        opacity:.88;
        filter:drop-shadow(0 0 12px color-mix(in srgb,var(--next-color) 38%,transparent));
      }
      .draft-next p{
        min-width:0;
        margin:0;
      }
      .draft-next b{
        display:block;
        color:color-mix(in srgb,var(--next-color) 76%,white 24%);
        font-size:10px;
        letter-spacing:.045em;
      }
      .draft-next small{
        display:block;
        margin-top:5px;
        color:#7899a9;
        font-size:8px;
        line-height:1.35;
      }
      .draft-reroll{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:7px;
        min-width:0;
        padding:7px;
        color:#dffbff;
        border:0;
        background:linear-gradient(180deg,rgba(11,37,59,.78),rgba(4,14,27,.98));
        cursor:pointer;
      }
      .draft-reroll i{
        display:grid;
        place-items:center;
        width:34px;
        height:34px;
        color:#9eeeff;
        border:1px solid rgba(87,225,255,.42);
        border-radius:50%;
        background:rgba(59,207,255,.07);
        box-shadow:0 0 18px rgba(67,213,255,.1);
        font-size:20px;
        font-style:normal;
        transition:.18s transform,.18s border-color;
      }
      .draft-reroll span{
        min-width:0;
        text-align:center;
      }
      .draft-reroll b,.draft-reroll small{
        display:block;
      }
      .draft-reroll b{
        font-size:9px;
        letter-spacing:.12em;
      }
      .draft-reroll small{
        margin-top:4px;
        color:#ffd364;
        font-size:6px;
        line-height:1.25;
        letter-spacing:.04em;
      }
      .draft-reroll:hover:not(:disabled){
        background:linear-gradient(180deg,rgba(15,54,83,.92),rgba(5,18,34,.98));
      }
      .draft-reroll:hover:not(:disabled) i{
        transform:rotate(70deg) scale(1.05);
        border-color:#dffcff;
      }
      .draft-reroll:disabled{
        opacity:.38;
        cursor:default;
      }
      .signal-enter{
        animation:signalEnter .28s ease-out both;
      }
      @keyframes signalEnter{
        from{opacity:.45;transform:translateY(5px);filter:brightness(1.65)}
        to{opacity:1;transform:translateY(0);filter:brightness(1)}
      }
    `;
    document.head.appendChild(style);

    const introCopy = document.querySelector('.intro-card p');
    if (introCopy) introCopy.textContent = 'Draw one tower at a time, read the next signal, rescan bad options, and build a new defense every run.';
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
