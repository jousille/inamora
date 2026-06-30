// ── auth.js — авторизация по токену через Supabase ────────────
// Токен привязывается к устройству — один токен = один телефон одновременно.

const Auth = (() => {

  const SUPABASE_URL = 'https://lrogbpoacfrkvgxsyjoq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyb2dicG9hY2Zya3ZneHN5am9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODQwNjYsImV4cCI6MjA5ODM2MDA2Nn0.CMSzhdFPqmbNfvIO9-8zNGIJYztzowIomgqNKf0ghUI';

  const SESSION_KEY = 'planer_session';
  const DEVICE_KEY  = 'planer_device_id';

  // ── REST API запросы к Supabase (без SDK, чистый fetch) ───────

  async function sbFetch(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    return res.json();
  }

  // ── Device ID ────────────────────────────────────────────────

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    id = 'web-' + crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  }

  function getDeviceName() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android (браузер)';
    return 'Браузер';
  }

  // ── Авторизация ──────────────────────────────────────────────

  async function login(tokenInput) {
    const token = tokenInput.trim().toUpperCase();
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    try {
      const rows = await sbFetch(`tokens?token=eq.${encodeURIComponent(token)}&select=*`);
      const data = rows[0];

      if (!data) {
        return { ok: false, reason: 'not_found' };
      }

      if (!data.device_id || data.device_id === deviceId) {
        await sbFetch(`tokens?token=eq.${encodeURIComponent(token)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            used: true,
            device_id: deviceId,
            device_name: deviceName,
            last_login: new Date().toISOString(),
          }),
        });

        localStorage.setItem(SESSION_KEY, JSON.stringify({ token, deviceId, loginAt: Date.now() }));
        return { ok: true };
      }

      return { ok: false, reason: 'busy', deviceName: data.device_name || 'другом устройстве' };

    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  async function unlinkDevice() {
    const session = getSession();
    if (!session) return { ok: false, reason: 'no_session' };

    try {
      const rows = await sbFetch(`tokens?token=eq.${encodeURIComponent(session.token)}&select=last_unlink`);
      const data = rows[0];

      if (data?.last_unlink) {
        const daysSince = (Date.now() - new Date(data.last_unlink).getTime()) / 86400000;
        if (daysSince < 14) {
          return { ok: false, reason: 'limit', daysLeft: Math.ceil(14 - daysSince) };
        }
      }

      await sbFetch(`tokens?token=eq.${encodeURIComponent(session.token)}`, {
        method: 'PATCH',
        body: JSON.stringify({ device_id: null, device_name: null, last_unlink: new Date().toISOString() }),
      });

      localStorage.removeItem(SESSION_KEY);
      return { ok: true };

    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function currentToken() {
    const s = getSession();
    return s ? s.token : null;
  }

  function isLoggedIn() {
    return !!currentToken();
  }

  return { login, unlinkDevice, logout, currentToken, isLoggedIn, getDeviceId };

})();
