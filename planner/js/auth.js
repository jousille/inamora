// ── auth.js — авторизация по токену через Supabase ────────────
// Токен привязывается к устройству — один токен = один телефон одновременно.
// Проверка актуальности токена в Supabase — раз в 7 дней.

const Auth = (() => {

  const SUPABASE_URL = 'https://lrogbpoacfrkvgxsyjoq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyb2dicG9hY2Zya3ZneHN5am9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODQwNjYsImV4cCI6MjA5ODM2MDA2Nn0.CMSzhdFPqmbNfvIO9-8zNGIJYztzowIomgqNKf0ghUI';

  const SESSION_KEY      = 'planer_session';
  const DEVICE_KEY       = 'planer_device_id';
  const VERIFY_KEY       = 'planer_last_verify';   // timestamp последней проверки
  const VERIFY_INTERVAL  = 7 * 24 * 60 * 60 * 1000; // 7 дней в мс

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

  // ── Проверка истечения токена ─────────────────────────────────

  function isExpired(expiresAt) {
    if (!expiresAt) return false; // null = бессрочный
    return new Date(expiresAt) < new Date();
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

      // ── Проверка срока действия ───────────────────────────────
      if (isExpired(data.expires_at)) {
        return { ok: false, reason: 'expired' };
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
        localStorage.setItem(VERIFY_KEY, Date.now().toString());
        return { ok: true };
      }

      return { ok: false, reason: 'busy', deviceName: data.device_name || 'другом устройстве' };

    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  // ── Еженедельная фоновая верификация ─────────────────────────
  // Вызывается при старте приложения. Если прошло >7 дней —
  // проверяет в Supabase что токен ещё действителен.
  // Возвращает: 'skip' | 'ok' | 'expired' | 'revoked' | 'error'

  async function verify() {
    const session = getSession();
    if (!session) return 'skip';

    const lastVerify = parseInt(localStorage.getItem(VERIFY_KEY) || '0', 10);
    const elapsed = Date.now() - lastVerify;

    if (elapsed < VERIFY_INTERVAL) return 'skip'; // ещё рано

    try {
      const rows = await sbFetch(`tokens?token=eq.${encodeURIComponent(session.token)}&select=expires_at,device_id,used`);
      const data = rows[0];

      if (!data) {
        // токен удалён из базы
        logout();
        return 'revoked';
      }

      if (isExpired(data.expires_at)) {
        logout();
        return 'expired';
      }

      // device_id изменился — токен перепривязан к другому устройству
      if (data.device_id && data.device_id !== session.deviceId) {
        logout();
        return 'revoked';
      }

      // всё в порядке — обновляем метку
      localStorage.setItem(VERIFY_KEY, Date.now().toString());
      return 'ok';

    } catch (e) {
      // сеть недоступна — не выгоняем пользователя, просто пропускаем
      return 'error';
    }
  }

  // ── Отвязка устройства ───────────────────────────────────────

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
      localStorage.removeItem(VERIFY_KEY);
      return { ok: true };

    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(VERIFY_KEY);
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

  return { login, verify, unlinkDevice, logout, currentToken, isLoggedIn, getDeviceId };

})();
