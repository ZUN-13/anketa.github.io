(function () {
  const API_BASE = window.API_BASE || '';
  const listeners = new Set();
  let cache = { users: [], surveys: [], bots: [], responses: [] };
  let es = null;
  let pollTimer = null;
  let lastPayload = '';

  function notify(reason) {
    listeners.forEach(fn => { try { fn(cache, reason); } catch (e) {} });
  }

  async function fetchState() {
    try {
      const r = await fetch(API_BASE + '/api/state', { cache: 'no-store' });
      if (!r.ok) return cache;
      const data = await r.json();
      const sig = JSON.stringify(data);
      if (sig !== lastPayload) {
        lastPayload = sig;
        cache = data;
        notify('fetch');
      }
      return cache;
    } catch (e) {
      return cache;
    }
  }

  async function saveState(newState) {
    cache = {
      users: newState.users || [],
      surveys: newState.surveys || [],
      bots: newState.bots || [],
      responses: newState.responses || []
    };
    lastPayload = JSON.stringify(cache);
    notify('local');
    try {
      await fetch(API_BASE + '/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache)
      });
    } catch (e) {}
    return cache;
  }

  function connectSSE() {
    if (es) return;
    try {
      es = new EventSource(API_BASE + '/api/events');
      es.onmessage = async () => { await fetchState(); };
      es.onerror = () => {
        try { es.close(); } catch (e) {}
        es = null;
        setTimeout(connectSSE, 2000);
      };
    } catch (e) {}
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(fetchState, 1500);
  }

  async function init() {
    await fetchState();
    connectSSE();
    startPolling();
    window.addEventListener('focus', fetchState);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchState(); });
  }

  window.SurveyAPI = {
    init,
    fetchState,
    saveState,
    getState: () => cache,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();