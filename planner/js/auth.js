// ── auth.js — авторизация по токену ──────────────────────────
// Токены хранятся в VALID_TOKENS.
// В продакшне замените на запрос к вашему серверу.

const Auth = (() => {

  // ── Список валидных токенов (замените на свои перед продажей)
  // Формат: 'КОД': { expires: null или 'YYYY-MM-DD' }
  // null = бессрочный доступ
  const VALID_TOKENS = {
    'INAMORA-DEMO':  { expires: null },
    'INAMORA-NINA':  { expires: null },
    // Добавляйте токены для каждого покупателя:
    // 'INAMORA-XXXXX': { expires: null },
  };

  const SESSION_KEY = 'planer_session';

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function validate(token) {
    const t = token.trim().toUpperCase();
    const entry = VALID_TOKENS[t];
    if (!entry) return false;
    if (entry.expires && new Date(entry.expires) < new Date()) return false;
    return t;
  }

  function login(token) {
    const valid = validate(token);
    if (!valid) return false;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: valid, loginAt: Date.now() }));
    return valid;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function currentToken() {
    const s = getSession();
    return s ? s.token : null;
  }

  function isLoggedIn() {
    return !!currentToken();
  }

  return { login, logout, currentToken, isLoggedIn };

})();
