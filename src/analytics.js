'use strict';
(() => {
  const STORAGE_KEY = 'neon_bastion_analytics_v1';
  const MAX_EVENTS = 250;
  const sessionId = createId('session');
  let runId = null;

  function createId(prefix) {
    const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${random}`;
  }

  function readEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeEvents(events) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS))); } catch {}
  }

  function track(name, properties = {}) {
    if (!name || typeof name !== 'string') return null;
    const event = {
      id: createId('event'),
      name,
      timestamp: new Date().toISOString(),
      sessionId,
      runId,
      platform: window.GamePlatform?.name || 'unknown',
      properties
    };
    const events = readEvents();
    events.push(event);
    writeEvents(events);
    console.info('[Analytics]', name, properties);
    window.dispatchEvent(new CustomEvent('neon:analytics', { detail: event }));
    return event;
  }

  window.GameAnalytics = {
    track,
    startRun(properties = {}) {
      runId = createId('run');
      track('run_started', properties);
      return runId;
    },
    endRun(properties = {}) {
      const event = track('run_completed', properties);
      runId = null;
      return event;
    },
    getRunId() { return runId; },
    getEvents() { return readEvents(); },
    clear() { writeEvents([]); }
  };
})();
