'use strict';
(() => {
  const original = {
    resetGame,
    finishWave,
    showProtocolChoices,
    endGame,
    buildTower,
    upgradeTower,
    sellTower
  };

  let pendingLoss = false;
  let runFinalized = false;
  let protocolRerollUsed = false;
  let reviveInFlight = false;
  let adPauseState = false;
  let readyTracked = false;

  injectStyles();
  const reviveButton = injectReviveButton();

  GameMonetization.configure({
    beforeAd() {
      adPauseState = state.paused;
      state.paused = true;
      GamePlatform.gameplayStop();
      audioCtx?.suspend?.().catch?.(() => {});
      updateUI();
    },
    afterAd() {
      if (!adPauseState && state.running) state.paused = false;
      audioCtx?.resume?.().catch?.(() => {});
      if (state.running && !state.paused) GamePlatform.gameplayStart();
      updateUI();
    }
  });

  resetGame = function monetizedResetGame() {
    original.resetGame();
    pendingLoss = false;
    runFinalized = false;
    protocolRerollUsed = false;
    reviveInFlight = false;
    state.__commercialEndHandled = false;
    state.__commercialReviveUsed = false;
    reviveButton.classList.add('hidden');
    GameStorage.recordRunStart();
    GameAnalytics.startRun({ startingCredits: state.credits, startingTowers: state.towers.length });
    GamePlatform.gameplayStart();
  };

  finishWave = function monetizedFinishWave() {
    const completedWave = state.wave;
    original.finishWave();
    GameAnalytics.track('wave_completed', {
      wave: completedWave,
      hp: state.hp,
      credits: Math.floor(state.credits),
      kills: state.kills,
      towers: state.towers.length
    });
  };

  showProtocolChoices = function monetizedProtocolChoices() {
    protocolRerollUsed = false;
    original.showProtocolChoices();
    renderProtocolReroll();
    GameAnalytics.track('protocol_offer_shown', { wave: state.wave });
  };

  endGame = function monetizedEndGame(win) {
    if (state.__commercialEndHandled) return;
    state.__commercialEndHandled = true;
    original.endGame(win);
    GamePlatform.gameplayStop();
    GameAnalytics.track('run_end_screen_shown', {
      win,
      wave: state.wave,
      score: Math.round(state.score),
      kills: state.kills,
      reviveUsed: Boolean(state.__commercialReviveUsed)
    });

    if (!win && !state.__commercialReviveUsed) {
      pendingLoss = true;
      reviveButton.classList.remove('hidden');
      GameAnalytics.track('rewarded_offer_shown', { placement: 'revive', wave: state.wave });
      return;
    }

    reviveButton.classList.add('hidden');
    finalizeRun(win);
  };

  buildTower = function monetizedBuildTower(type, slot) {
    const built = original.buildTower(type, slot);
    if (built) GameAnalytics.track('tower_built', { type, slot, wave: state.wave, credits: Math.floor(state.credits) });
    return built;
  };

  upgradeTower = function monetizedUpgradeTower(tower) {
    const beforeLevel = tower?.level || 0;
    const beforeCredits = state.credits;
    original.upgradeTower(tower);
    if (tower && tower.level > beforeLevel) {
      GameAnalytics.track('tower_upgraded', {
        type: tower.type,
        level: tower.level,
        cost: Math.round(beforeCredits - state.credits),
        wave: state.wave
      });
    }
  };

  sellTower = function monetizedSellTower(tower) {
    if (!tower) return original.sellTower(tower);
    const type = tower.type;
    const level = tower.level;
    const beforeCredits = state.credits;
    original.sellTower(tower);
    GameAnalytics.track('tower_sold', {
      type,
      level,
      value: Math.round(state.credits - beforeCredits),
      wave: state.wave
    });
  };

  reviveButton.addEventListener('click', async () => {
    if (reviveInFlight || !pendingLoss || state.__commercialReviveUsed) return;
    reviveInFlight = true;
    reviveButton.disabled = true;
    const result = await GameMonetization.rewarded('revive', { wave: state.wave, score: state.score });
    reviveButton.disabled = false;
    reviveInFlight = false;

    if (!result.completed) {
      showToast('Rewarded ad unavailable. You can restart without watching.');
      return;
    }

    const threats = [...state.enemies].sort((a, b) => b.progress - a.progress).slice(0, 3);
    const removedIds = new Set(threats.map(enemy => enemy.id));
    state.enemies = state.enemies.filter(enemy => !removedIds.has(enemy.id));
    state.projectiles = state.projectiles.filter(projectile => !removedIds.has(projectile.target?.id));
    state.hp = Math.max(1, Math.ceil(state.maxHp * 0.35));
    state.running = true;
    state.paused = false;
    state.__commercialReviveUsed = true;
    state.__commercialEndHandled = false;
    pendingLoss = false;
    ui.result.classList.add('hidden');
    reviveButton.classList.add('hidden');
    GamePlatform.gameplayStart();
    GameAnalytics.track('run_revived', { wave: state.wave, restoredHp: state.hp, clearedEnemies: threats.length });
    showToast(`Core restored to ${state.hp} armor.`);
    updateUI();
  });

  $('restartBtn').addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pendingLoss) finalizeRun(false);
    $('restartBtn').disabled = true;
    await GameMonetization.interstitial('run_complete', {
      win: state.hp > 0 && state.wave >= LEVEL.waves,
      wave: state.wave,
      score: state.score
    });
    $('restartBtn').disabled = false;
    ui.result.classList.add('hidden');
    resetGame();
  }, true);

  $('enterBtn').addEventListener('click', () => {
    GameAnalytics.track('intro_completed');
  });

  ui.startWave.addEventListener('click', () => {
    queueMicrotask(() => {
      if (state.waveActive) GameAnalytics.track('wave_started', { wave: state.wave, towers: state.towers.length, credits: Math.floor(state.credits) });
    });
  });

  ui.pause.addEventListener('click', () => {
    queueMicrotask(() => {
      GameAnalytics.track(state.paused ? 'gameplay_paused' : 'gameplay_resumed', { wave: state.wave });
      if (state.paused) GamePlatform.gameplayStop();
      else if (state.running) GamePlatform.gameplayStart();
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (!state.running) return;
    if (document.hidden) {
      state.paused = true;
      GamePlatform.gameplayStop();
      GameAnalytics.track('gameplay_backgrounded', { wave: state.wave });
      updateUI();
    } else {
      GameAnalytics.track('gameplay_foregrounded', { wave: state.wave, paused: state.paused });
    }
  });

  GameAnalytics.track('game_boot', { mockAds: new URLSearchParams(location.search).get('mockAds') === '1' });
  const readyTimer = setInterval(() => {
    if (!state.ready || readyTracked) return;
    readyTracked = true;
    clearInterval(readyTimer);
    GameAnalytics.track('game_loaded', { assetCount: Object.keys(img).length });
  }, 100);

  function finalizeRun(win) {
    if (runFinalized) return;
    runFinalized = true;
    pendingLoss = false;
    GameMonetization.noteRunComplete();
    GameStorage.recordRunEnd({ win, wave: state.wave, score: Math.round(state.score), kills: state.kills });
    GameAnalytics.endRun({
      win,
      wave: state.wave,
      score: Math.round(state.score),
      kills: state.kills,
      hp: Math.max(0, state.hp),
      reviveUsed: Boolean(state.__commercialReviveUsed)
    });
  }

  function renderProtocolReroll() {
    document.getElementById('protocolRerollBtn')?.remove();
    if (protocolRerollUsed) return;
    const button = document.createElement('button');
    button.id = 'protocolRerollBtn';
    button.className = 'protocol-reroll';
    button.innerHTML = '<b>↻ Reroll choices</b><small>Watch a rewarded ad · once per offer</small>';
    button.addEventListener('click', async () => {
      if (protocolRerollUsed) return;
      button.disabled = true;
      const result = await GameMonetization.rewarded('protocol_reroll', { wave: state.wave });
      if (!result.completed) {
        button.disabled = false;
        showToast('Rewarded ad unavailable. Keep the current choices.');
        return;
      }
      protocolRerollUsed = true;
      original.showProtocolChoices();
      document.getElementById('protocolRerollBtn')?.remove();
      GameAnalytics.track('protocol_rerolled', { wave: state.wave });
      showToast('Protocol choices refreshed.');
    });
    ui.protocolChoices.appendChild(button);
    GameAnalytics.track('rewarded_offer_shown', { placement: 'protocol_reroll', wave: state.wave });
  }

  function injectReviveButton() {
    const restartButton = $('restartBtn');
    const button = document.createElement('button');
    button.id = 'reviveBtn';
    button.className = 'enter-btn rewarded-action hidden';
    button.innerHTML = '<b>Revive</b><small>Watch ad · restore 35% armor</small>';
    restartButton.parentElement.insertBefore(button, restartButton);
    return button;
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .rewarded-action{margin-bottom:10px;background:linear-gradient(145deg,#755100,#2b1800);border-color:#ffd45f;color:#fff4b8}
      .rewarded-action b,.rewarded-action small{display:block}.rewarded-action small{font-size:11px;margin-top:4px;opacity:.82}
      .protocol-reroll{grid-column:1/-1;min-height:62px;padding:10px 18px;border:1px solid #ffd45f;color:#fff2b0;background:linear-gradient(145deg,rgba(79,50,0,.95),rgba(20,12,2,.96));cursor:pointer}
      .protocol-reroll b,.protocol-reroll small{display:block}.protocol-reroll small{margin-top:5px;color:#cbbd8a}
      .protocol-reroll:disabled,.rewarded-action:disabled{opacity:.55;cursor:wait}
    `;
    document.head.appendChild(style);
  }
})();
