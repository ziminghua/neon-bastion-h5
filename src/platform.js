'use strict';
(() => {
  const unavailableAdapter = {
    name: 'standalone',
    async init() {},
    gameplayStart() {},
    gameplayStop() {},
    async showRewarded() { return { completed: false, reason: 'unavailable' }; },
    async showInterstitial() { return { completed: false, reason: 'unavailable' }; }
  };

  const query = new URLSearchParams(location.search);
  const mockAdsEnabled = query.get('mockAds') === '1';
  const mockAdapter = {
    name: 'mock',
    async init() {},
    gameplayStart() {},
    gameplayStop() {},
    async showRewarded(placement) {
      const completed = window.confirm(`[Mock rewarded ad]\nComplete ad for: ${placement}?`);
      return { completed, reason: completed ? 'completed' : 'dismissed' };
    },
    async showInterstitial(placement) {
      window.alert(`[Mock interstitial]\nPlacement: ${placement}`);
      return { completed: true, reason: 'completed' };
    }
  };

  let adapter = mockAdsEnabled ? mockAdapter : unavailableAdapter;
  let initialized = false;

  function normalizeResult(result) {
    if (result === true) return { completed: true, reason: 'completed' };
    if (!result || typeof result !== 'object') return { completed: false, reason: 'invalid_result' };
    return {
      completed: result.completed === true,
      reason: result.reason || (result.completed ? 'completed' : 'not_completed')
    };
  }

  async function call(method, ...args) {
    const fn = adapter?.[method];
    if (typeof fn !== 'function') return normalizeResult(null);
    try {
      return normalizeResult(await fn.apply(adapter, args));
    } catch (error) {
      console.error(`[GamePlatform] ${method} failed`, error);
      return { completed: false, reason: 'error', error };
    }
  }

  window.GamePlatform = {
    get name() { return adapter?.name || 'unknown'; },
    get initialized() { return initialized; },
    setAdapter(nextAdapter) {
      if (!nextAdapter || typeof nextAdapter !== 'object') throw new TypeError('A platform adapter object is required.');
      adapter = nextAdapter;
      initialized = false;
    },
    async init(context = {}) {
      try {
        if (typeof adapter.init === 'function') await adapter.init(context);
        initialized = true;
        window.dispatchEvent(new CustomEvent('neon:platform-ready', { detail: { platform: this.name } }));
      } catch (error) {
        initialized = false;
        console.error('[GamePlatform] init failed', error);
      }
      return initialized;
    },
    gameplayStart() {
      try { adapter?.gameplayStart?.(); } catch (error) { console.error('[GamePlatform] gameplayStart failed', error); }
    },
    gameplayStop() {
      try { adapter?.gameplayStop?.(); } catch (error) { console.error('[GamePlatform] gameplayStop failed', error); }
    },
    showRewarded(placement, context = {}) {
      return call('showRewarded', placement, context);
    },
    showInterstitial(placement, context = {}) {
      return call('showInterstitial', placement, context);
    }
  };
})();
