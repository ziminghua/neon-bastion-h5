(() => {
  'use strict';

  const CSS = `
    .bottom-deck.compact-draft-dock {
      width: 960px !important;
      height: 112px !important;
      gap: 8px !important;
      padding: 8px !important;
      border: 1px solid rgba(84,225,255,.36) !important;
      border-top-color: rgba(84,225,255,.58) !important;
      background:
        linear-gradient(180deg,rgba(7,20,38,.97),rgba(2,8,19,.985)) !important;
      box-shadow: 0 18px 55px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.045) !important;
      clip-path: polygon(1.3% 0,98.7% 0,100% 16%,100% 84%,98.7% 100%,1.3% 100%,0 84%,0 16%);
    }

    .bottom-deck.compact-draft-dock .tower-deck.draft-mode {
      flex: 0 0 566px !important;
      width: 566px !important;
      grid-template-columns: 334px 142px 74px !important;
      gap: 8px !important;
      align-items: stretch !important;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current {
      min-width: 0 !important;
      height: 94px !important;
      grid-template-columns: 92px minmax(0,1fr) 62px !important;
      gap: 9px !important;
      padding: 5px 10px 5px 4px !important;
      border-color: color-mix(in srgb,var(--accent) 72%,#8defff) !important;
      background:
        linear-gradient(100deg,color-mix(in srgb,var(--accent) 13%,#061225),rgba(4,13,27,.98) 66%) !important;
      box-shadow:
        inset 3px 0 0 var(--accent),
        inset 0 0 30px color-mix(in srgb,var(--accent) 10%,transparent),
        0 0 24px color-mix(in srgb,var(--accent) 8%,transparent) !important;
      clip-path: polygon(0 0,96% 0,100% 18%,100% 82%,96% 100%,0 100%);
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current::before {
      content: 'ACTIVE DRAW' !important;
      left: 100px !important;
      top: 9px !important;
      font-size: 7px !important;
      letter-spacing: .18em !important;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current::after {
      content: 'DRAG TO AN EMPTY NODE';
      position: absolute;
      left: 100px;
      bottom: 9px;
      color: rgba(181,222,237,.62);
      font-size: 7px;
      font-weight: 800;
      letter-spacing: .11em;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current img {
      width: 88px !important;
      height: 88px !important;
      object-fit: contain !important;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current span {
      align-self: center !important;
      padding: 0 0 7px !important;
      overflow: hidden;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current b {
      font-size: 15px !important;
      white-space: nowrap;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current small {
      margin-top: 5px !important;
      font-size: 8px !important;
      white-space: nowrap;
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current > strong {
      display: grid !important;
      place-items: center !important;
      min-width: 56px !important;
      height: 52px !important;
      padding-top: 8px !important;
      color: #ffe175 !important;
      border: 1px solid rgba(255,213,79,.38) !important;
      background: rgba(31,24,4,.48) !important;
      font-size: 14px !important;
      clip-path: polygon(12% 0,88% 0,100% 18%,100% 82%,88% 100%,12% 100%,0 82%,0 18%);
    }

    .bottom-deck.compact-draft-dock .tower-card.draft-current > strong::after {
      content: 'CR';
      display: block;
      margin-top: -12px;
      color: #9f8c4a;
      font-size: 6px;
      letter-spacing: .14em;
    }

    .bottom-deck.compact-draft-dock .draft-next {
      min-width: 0 !important;
      height: 94px !important;
      padding: 7px 8px !important;
      border-color: rgba(112,211,239,.24) !important;
      background: linear-gradient(155deg,rgba(7,21,39,.96),rgba(3,10,22,.96)) !important;
      clip-path: polygon(0 0,92% 0,100% 12%,100% 100%,0 100%);
    }

    .bottom-deck.compact-draft-dock .draft-next > span {
      font-size: 6px !important;
      letter-spacing: .2em !important;
    }

    .bottom-deck.compact-draft-dock .draft-next > div {
      height: 70px !important;
      gap: 4px !important;
    }

    .bottom-deck.compact-draft-dock .draft-next img {
      width: 64px !important;
      height: 68px !important;
      opacity: .82 !important;
    }

    .bottom-deck.compact-draft-dock .draft-next p {
      overflow: hidden;
    }

    .bottom-deck.compact-draft-dock .draft-next b {
      max-width: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 9px !important;
      white-space: nowrap;
    }

    .bottom-deck.compact-draft-dock .draft-next small {
      display: none !important;
    }

    .bottom-deck.compact-draft-dock .draft-reroll {
      min-width: 0 !important;
      width: 74px !important;
      height: 94px !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      display: grid !important;
      place-items: center !important;
    }

    .bottom-deck.compact-draft-dock .draft-reroll > span {
      display: none !important;
    }

    .bottom-deck.compact-draft-dock .draft-reroll button {
      width: 68px !important;
      height: 68px !important;
      min-height: 68px !important;
      border-radius: 50% !important;
      border: 1px solid rgba(82,233,255,.46) !important;
      background:
        radial-gradient(circle at 50% 38%,rgba(32,104,135,.58),rgba(4,17,31,.96) 66%) !important;
      box-shadow: inset 0 0 18px rgba(77,220,255,.1),0 0 16px rgba(69,215,255,.08) !important;
    }

    .bottom-deck.compact-draft-dock .draft-reroll button b {
      font-size: 0 !important;
    }

    .bottom-deck.compact-draft-dock .draft-reroll button b::before {
      content: '↻';
      display: block;
      color: #bff7ff;
      font-size: 25px;
      line-height: 1;
    }

    .bottom-deck.compact-draft-dock .draft-reroll button small {
      margin-top: 4px !important;
      color: #ffd364 !important;
      font-size: 6px !important;
      line-height: 1.1 !important;
    }

    .bottom-deck.compact-draft-dock .command-copy {
      display: none !important;
    }

    .bottom-deck.compact-draft-dock .emp-button {
      width: 126px !important;
      height: 94px !important;
      padding: 8px !important;
      gap: 7px !important;
    }

    .bottom-deck.compact-draft-dock .emp-button i {
      width: 37px !important;
      height: 48px !important;
      font-size: 22px !important;
    }

    .bottom-deck.compact-draft-dock .emp-button b {
      font-size: 9px !important;
    }

    .bottom-deck.compact-draft-dock .start-wave {
      width: 230px !important;
      height: 94px !important;
    }

    .bottom-deck.compact-draft-dock .start-wave b {
      font-size: 15px !important;
    }

    @media (max-aspect-ratio: 16/9) {
      .bottom-deck.compact-draft-dock {
        width: 940px !important;
      }
      .bottom-deck.compact-draft-dock .tower-deck.draft-mode {
        flex-basis: 550px !important;
        width: 550px !important;
        grid-template-columns: 324px 140px 70px !important;
      }
      .bottom-deck.compact-draft-dock .start-wave {
        width: 216px !important;
      }
    }
  `;

  function install() {
    const deck = document.querySelector('.bottom-deck');
    const towerDeck = document.querySelector('.tower-deck.draft-mode');
    const next = document.getElementById('draftNext');
    const reroll = document.getElementById('draftReroll');
    if (!deck || !towerDeck || !next || !reroll) return false;

    deck.classList.add('compact-draft-dock');
    if (!document.getElementById('compactDraftDockStyles')) {
      const style = document.createElement('style');
      style.id = 'compactDraftDockStyles';
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
