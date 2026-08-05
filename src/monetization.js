'use strict';
(() => {
  const POLICY_KEY = 'neon_bastion_ad_policy_v1';
  const MIN_INTERSTITIAL_GAP_MS = 120000;
  const REWARDED_COOLDOWN_MS = 60000;
  const RUNS_PER_INTERSTITIAL = 2;
  let hooks = { beforeAd: () => {}, afterAd: () => {} };

  function readPolicy() {
    try {
      return {
        lastInterstitialAt: 0,
        lastRewardedAt: 0,
        completedRunsSinceInterstitial: 0,
        ...JSON.parse(localStorage.getItem(POLICY_KEY) || '{}')
      };
    } catch {
      return { lastInterstitialAt: 0, lastRewardedAt: 0, completedRunsSinceInterstitial: 0 };
    }
  }

  function writePolicy(policy) {
    try { localStorage.setItem(POLICY_KEY, JSON.stringify(policy)); } catch {}
    return policy;
  }

  async function withAd(kind, placement, request) {
    GameAnalytics?.track(`${kind}_requested`, { placement });
    hooks.beforeAd(kind, placement);
    let result;
    try {
      result = await request();
    } finally {
      hooks.afterAd(kind, placement);
    }
    GameAnalytics?.track(`${kind}_${result.completed ? 'completed' : 'failed'}`, {
      placement,
      reason: result.reason || 'unknown'
    });
    return result;
  }

  window.GameMonetization = {
    configure(nextHooks = {}) {
      hooks = { ...hooks, ...nextHooks };
    },
    noteRunComplete() {
      const policy = readPolicy();
      policy.completedRunsSinceInterstitial += 1;
      writePolicy(policy);
    },
    async rewarded(placement, context = {}) {
      GameAnalytics?.track('rewarded_clicked', { placement });
      const result = await withAd('rewarded', placement, () => GamePlatform.showRewarded(placement, context));
      if (result.completed) {
        const policy = readPolicy();
        policy.lastRewardedAt = Date.now();
        writePolicy(policy);
        GameStorage?.recordRewarded(placement);
      }
      return result;
    },
    async interstitial(placement, context = {}) {
      const policy = readPolicy();
      const now = Date.now();
      const profile = GameStorage?.get?.() || { runsCompleted: 0 };
      let reason = null;
      if (profile.runsCompleted < 1) reason = 'first_run';
      else if (policy.completedRunsSinceInterstitial < RUNS_PER_INTERSTITIAL) reason = 'run_frequency';
      else if (now - policy.lastInterstitialAt < MIN_INTERSTITIAL_GAP_MS) reason = 'time_frequency';
      else if (now - policy.lastRewardedAt < REWARDED_COOLDOWN_MS) reason = 'rewarded_cooldown';
      if (reason) {
        GameAnalytics?.track('interstitial_skipped', { placement, reason });
        return { completed: false, skipped: true, reason };
      }

      const result = await withAd('interstitial', placement, () => GamePlatform.showInterstitial(placement, context));
      if (result.completed) {
        policy.lastInterstitialAt = now;
        policy.completedRunsSinceInterstitial = 0;
        writePolicy(policy);
      }
      return result;
    },
    getPolicy: readPolicy
  };
})();
