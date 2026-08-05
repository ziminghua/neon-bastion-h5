'use strict';
(() => {
  const STORAGE_KEY = 'neon_bastion_profile_v1';
  const defaults = {
    version: 1,
    runsStarted: 0,
    runsCompleted: 0,
    wins: 0,
    bestWave: 0,
    bestScore: 0,
    totalKills: 0,
    rewardedCompleted: 0,
    rewardedByPlacement: {},
    updatedAt: null
  };

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        ...defaults,
        ...parsed,
        rewardedByPlacement: { ...defaults.rewardedByPlacement, ...(parsed.rewardedByPlacement || {}) }
      };
    } catch {
      return { ...defaults, rewardedByPlacement: {} };
    }
  }

  function write(next) {
    const value = { ...next, version: 1, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch {}
    return value;
  }

  function mutate(updater) {
    const current = read();
    const next = updater(current) || current;
    return write(next);
  }

  window.GameStorage = {
    get: read,
    reset() { return write({ ...defaults, rewardedByPlacement: {} }); },
    recordRunStart() {
      return mutate(profile => ({ ...profile, runsStarted: profile.runsStarted + 1 }));
    },
    recordRunEnd({ win = false, wave = 0, score = 0, kills = 0 } = {}) {
      return mutate(profile => ({
        ...profile,
        runsCompleted: profile.runsCompleted + 1,
        wins: profile.wins + (win ? 1 : 0),
        bestWave: Math.max(profile.bestWave, wave),
        bestScore: Math.max(profile.bestScore, score),
        totalKills: profile.totalKills + kills
      }));
    },
    recordRewarded(placement) {
      return mutate(profile => ({
        ...profile,
        rewardedCompleted: profile.rewardedCompleted + 1,
        rewardedByPlacement: {
          ...profile.rewardedByPlacement,
          [placement]: (profile.rewardedByPlacement[placement] || 0) + 1
        }
      }));
    }
  };
})();
