(() => {
  'use strict';

  const CSS = `
    .three-zone-draft-dock .draft-next.reroll-strip-card {
      height: 96px !important;
      display: grid !important;
      grid-template-columns: 1fr !important;
      grid-template-rows: 15px 52px 24px !important;
      gap: 0 !important;
      padding: 6px 9px 5px !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card > span {
      grid-column: 1 !important;
      grid-row: 1 !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card > div:not(.draft-reroll) {
      grid-column: 1 !important;
      grid-row: 2 !important;
      height: 52px !important;
      display: grid !important;
      grid-template-columns: 52px minmax(0,1fr) !important;
      gap: 8px !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card img {
      width: 50px !important;
      height: 50px !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card b {
      max-width: none !important;
      font-size: 8px !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card .draft-reroll {
      grid-column: 1 !important;
      grid-row: 3 !important;
      width: 100% !important;
      height: 24px !important;
      min-width: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-left: 0 !important;
      align-self: stretch !important;
      background: transparent !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card .draft-reroll button {
      width: 100% !important;
      height: 24px !important;
      min-height: 24px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
      padding: 0 8px !important;
      border: 1px solid rgba(82,233,255,.22) !important;
      border-radius: 0 !important;
      background: linear-gradient(90deg,rgba(12,45,64,.7),rgba(5,21,35,.78)) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.025) !important;
      clip-path: polygon(3% 0,97% 0,100% 22%,100% 78%,97% 100%,3% 100%,0 78%,0 22%) !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card .draft-reroll button:hover:not(:disabled) {
      border-color: rgba(82,233,255,.48) !important;
      filter: brightness(1.1);
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card .draft-reroll button b {
      display: inline !important;
      color: #c9f8ff !important;
      font-size: 7px !important;
      letter-spacing: .1em !important;
      line-height: 1 !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card .draft-reroll button b::before {
      content: none !important;
      display: none !important;
    }

    .three-zone-draft-dock .draft-next.reroll-strip-card .draft-reroll button small {
      display: inline !important;
      margin: 0 !important;
      color: #ffd364 !important;
      font-size: 6px !important;
      line-height: 1 !important;
    }
  `;

  function install() {
    const next = document.getElementById('draftNext');
    const reroll = document.getElementById('draftReroll')?.closest('.draft-reroll');
    if (!next || !reroll || !document.querySelector('.three-zone-draft-dock')) return false;
    if (!next.contains(reroll)) next.append(reroll);
    next.classList.add('reroll-strip-card');

    if (!document.getElementById('rerollStripStyles')) {
      const style = document.createElement('style');
      style.id = 'rerollStripStyles';
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
