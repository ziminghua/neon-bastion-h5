(() => {
  'use strict';

  const CSS = `
    .bottom-deck.three-zone-draft-dock {
      width: 930px !important;
      height: 116px !important;
      display: grid !important;
      grid-template-columns: 390px 210px 330px !important;
      gap: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      border: 1px solid rgba(84,225,255,.38) !important;
      border-top-color: rgba(103,235,255,.62) !important;
      background: linear-gradient(180deg,rgba(7,20,38,.975),rgba(2,8,19,.99)) !important;
      box-shadow: 0 20px 58px rgba(0,0,0,.64), inset 0 1px 0 rgba(255,255,255,.045) !important;
      clip-path: polygon(1.2% 0,98.8% 0,100% 17%,100% 83%,98.8% 100%,1.2% 100%,0 83%,0 17%);
    }

    .three-zone-draft-dock .draft-zone-primary,
    .three-zone-draft-dock .draft-zone-signal,
    .three-zone-draft-dock .draft-zone-combat {
      min-width: 0;
      height: 114px;
    }

    .three-zone-draft-dock .draft-zone-primary {
      padding: 8px;
      background: linear-gradient(100deg,rgba(9,30,52,.78),rgba(3,11,23,.36));
      border-right: 1px solid rgba(106,213,241,.16);
    }

    .three-zone-draft-dock .tower-deck.draft-mode {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
    }

    .three-zone-draft-dock .tower-card.draft-hidden {
      display: none !important;
    }

    .three-zone-draft-dock .tower-card.draft-current {
      width: 100% !important;
      height: 98px !important;
      min-width: 0 !important;
      display: grid !important;
      grid-template-columns: 94px minmax(0,1fr) 58px !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 4px 12px 4px 5px !important;
      border: 0 !important;
      border-left: 3px solid var(--accent) !important;
      background: linear-gradient(100deg,color-mix(in srgb,var(--accent) 13%,#071528),rgba(4,13,27,.97) 70%) !important;
      box-shadow: inset 0 0 34px color-mix(in srgb,var(--accent) 8%,transparent) !important;
      clip-path: polygon(0 0,96% 0,100% 18%,100% 82%,96% 100%,0 100%);
      transform: none !important;
    }

    .three-zone-draft-dock .tower-card.draft-current:hover {
      transform: none !important;
      filter: brightness(1.06);
    }

    .three-zone-draft-dock .tower-card.draft-current::before {
      content: 'CURRENT TOWER' !important;
      left: 109px !important;
      top: 12px !important;
      color: color-mix(in srgb,var(--accent) 82%,white) !important;
      font-size: 7px !important;
      font-weight: 900 !important;
      letter-spacing: .19em !important;
    }

    .three-zone-draft-dock .tower-card.draft-current::after {
      content: 'DRAG TO DEPLOY';
      position: absolute;
      left: 109px;
      bottom: 13px;
      color: rgba(181,222,237,.58);
      font-size: 7px;
      font-weight: 800;
      letter-spacing: .12em;
    }

    .three-zone-draft-dock .tower-card.draft-current img {
      width: 91px !important;
      height: 91px !important;
      object-fit: contain !important;
    }

    .three-zone-draft-dock .tower-card.draft-current span {
      align-self: center !important;
      padding: 0 0 5px !important;
      overflow: hidden;
    }

    .three-zone-draft-dock .tower-card.draft-current b {
      font-size: 15px !important;
      letter-spacing: .055em !important;
      white-space: nowrap;
    }

    .three-zone-draft-dock .tower-card.draft-current small {
      margin-top: 5px !important;
      color: #789caf !important;
      font-size: 8px !important;
      white-space: nowrap;
    }

    .three-zone-draft-dock .tower-card.draft-current > strong {
      display: grid !important;
      place-items: center !important;
      min-width: 54px !important;
      height: 50px !important;
      padding-top: 7px !important;
      color: #ffe175 !important;
      border: 1px solid rgba(255,213,79,.32) !important;
      background: rgba(31,24,4,.42) !important;
      font-size: 14px !important;
      clip-path: polygon(13% 0,87% 0,100% 18%,100% 82%,87% 100%,13% 100%,0 82%,0 18%);
    }

    .three-zone-draft-dock .tower-card.draft-current > strong::after {
      content: 'CR';
      display: block;
      margin-top: -12px;
      color: #9f8c4a;
      font-size: 6px;
      letter-spacing: .14em;
    }

    .three-zone-draft-dock .draft-zone-signal {
      display: grid;
      grid-template-rows: 1fr 34px;
      gap: 6px;
      padding: 9px 12px;
      border-right: 1px solid rgba(106,213,241,.16);
      background: rgba(3,11,23,.48);
    }

    .three-zone-draft-dock .draft-next {
      min-width: 0 !important;
      height: auto !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      clip-path: none !important;
    }

    .three-zone-draft-dock .draft-next > span {
      display: block !important;
      color: #668fa3 !important;
      font-size: 6px !important;
      font-weight: 850 !important;
      letter-spacing: .2em !important;
    }

    .three-zone-draft-dock .draft-next > div {
      height: 61px !important;
      display: grid !important;
      grid-template-columns: 64px minmax(0,1fr) !important;
      align-items: center !important;
      gap: 8px !important;
    }

    .three-zone-draft-dock .draft-next img {
      width: 62px !important;
      height: 62px !important;
      object-fit: contain !important;
      opacity: .82 !important;
      filter: drop-shadow(0 0 8px rgba(90,225,255,.2)) !important;
    }

    .three-zone-draft-dock .draft-next p {
      display: block !important;
      min-width: 0 !important;
      margin: 0 !important;
      overflow: hidden !important;
    }

    .three-zone-draft-dock .draft-next b {
      display: block !important;
      overflow: hidden !important;
      color: #bdefff !important;
      font-size: 9px !important;
      letter-spacing: .035em !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .three-zone-draft-dock .draft-next small {
      display: none !important;
    }

    .three-zone-draft-dock .draft-reroll {
      min-width: 0 !important;
      width: 100% !important;
      height: 34px !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      display: block !important;
    }

    .three-zone-draft-dock .draft-reroll > span {
      display: none !important;
    }

    .three-zone-draft-dock .draft-reroll button {
      width: 100% !important;
      height: 34px !important;
      min-height: 34px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 9px !important;
      padding: 0 10px !important;
      border: 1px solid rgba(82,233,255,.28) !important;
      background: linear-gradient(180deg,rgba(15,50,71,.72),rgba(4,18,31,.92)) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.035) !important;
    }

    .three-zone-draft-dock .draft-reroll button:hover:not(:disabled) {
      border-color: rgba(82,233,255,.52) !important;
      filter: brightness(1.08);
    }

    .three-zone-draft-dock .draft-reroll button b {
      font-size: 9px !important;
      letter-spacing: .1em !important;
    }

    .three-zone-draft-dock .draft-reroll button small {
      margin: 0 !important;
      color: #ffd364 !important;
      font-size: 7px !important;
      line-height: 1 !important;
    }

    .three-zone-draft-dock .draft-zone-combat {
      display: grid;
      grid-template-columns: 108px minmax(0,1fr);
      gap: 10px;
      padding: 10px;
      background: linear-gradient(100deg,rgba(4,13,27,.32),rgba(8,25,43,.7));
    }

    .three-zone-draft-dock .command-copy {
      display: none !important;
    }

    .three-zone-draft-dock .emp-button {
      width: auto !important;
      height: 94px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 7px !important;
      border-color: rgba(199,92,255,.28) !important;
      background: linear-gradient(160deg,rgba(52,22,82,.72),rgba(7,16,33,.92)) !important;
    }

    .three-zone-draft-dock .emp-button i {
      width: 34px !important;
      height: 34px !important;
      font-size: 20px !important;
    }

    .three-zone-draft-dock .emp-button span {
      text-align: center !important;
    }

    .three-zone-draft-dock .emp-button b,
    .three-zone-draft-dock .emp-button small {
      text-align: center !important;
    }

    .three-zone-draft-dock .emp-button b {
      font-size: 8px !important;
    }

    .three-zone-draft-dock .emp-button small {
      margin-top: 2px !important;
      font-size: 6px !important;
    }

    .three-zone-draft-dock .start-wave {
      width: auto !important;
      height: 94px !important;
      box-shadow: 0 10px 24px rgba(52,196,255,.16) !important;
    }

    .three-zone-draft-dock .start-wave b {
      font-size: 15px !important;
    }

    .three-zone-draft-dock .start-wave small {
      margin-top: 5px !important;
    }
  `;

  function install() {
    const deck = document.querySelector('.bottom-deck');
    const towerDeck = document.querySelector('.tower-deck.draft-mode');
    const next = document.getElementById('draftNext');
    const rerollButton = document.getElementById('draftReroll');
    const rerollPanel = rerollButton?.closest('.draft-reroll');
    const emp = document.getElementById('empBtn');
    const start = document.getElementById('startWaveBtn');
    const commandCopy = deck?.querySelector('.command-copy');

    if (!deck || !towerDeck || !next || !rerollPanel || !emp || !start) return false;
    if (deck.dataset.threeZoneInstalled === 'true') return true;

    const primary = document.createElement('section');
    primary.className = 'draft-zone-primary';
    primary.setAttribute('aria-label', 'Current tower draw');

    const signal = document.createElement('section');
    signal.className = 'draft-zone-signal';
    signal.setAttribute('aria-label', 'Next tower and reroll');

    const combat = document.createElement('section');
    combat.className = 'draft-zone-combat';
    combat.setAttribute('aria-label', 'Combat controls');

    primary.append(towerDeck);
    signal.append(next, rerollPanel);
    combat.append(emp, start);

    const children = [primary, signal, combat];
    if (commandCopy) children.push(commandCopy);
    deck.replaceChildren(...children);
    deck.classList.remove('compact-draft-dock');
    deck.classList.add('three-zone-draft-dock');
    deck.dataset.threeZoneInstalled = 'true';

    const nextLabel = next.querySelector(':scope > span');
    if (nextLabel) nextLabel.textContent = 'UP NEXT';

    if (!document.getElementById('threeZoneDraftDockStyles')) {
      const style = document.createElement('style');
      style.id = 'threeZoneDraftDockStyles';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    return true;
  }

  if (install()) return;

  const observer = new MutationObserver(() => {
    if (!install()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
