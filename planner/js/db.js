// ── db.js — хранилище IndexedDB ───────────────────────────────
// Данные хранятся в IndexedDB — не удаляются при очистке кэша браузера.
// Автоэкспорт предлагается раз в неделю для защиты от потери данных.

const DB = (() => {

  let _token = null;
  let _idb   = null;       // IndexedDB connection
  const _cache = {};       // кэш в памяти для скорости

  // ── IndexedDB инициализация ───────────────────────────────────

  function _openDB() {
    return new Promise((resolve, reject) => {
      // Таймаут 5 секунд — если IndexedDB не отвечает
      const timeout = setTimeout(() => {
        reject(new Error('IndexedDB timeout — попробуйте обычный браузер, не режим инкогнито'));
      }, 5000);

      let req;
      try {
        req = indexedDB.open('inamora_planer', 2);
      } catch(e) {
        clearTimeout(timeout);
        reject(new Error('IndexedDB недоступен: ' + e.message));
        return;
      }

      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data');
        }
      };

      req.onsuccess = e => {
        clearTimeout(timeout);
        resolve(e.target.result);
      };
      req.onerror = e => {
        clearTimeout(timeout);
        reject(new Error('IndexedDB error: ' + (e.target.error?.message || 'unknown')));
      };
      req.onblocked = () => {
        clearTimeout(timeout);
        reject(new Error('IndexedDB заблокирован — закройте другие вкладки с планером'));
      };
    });
  }

  async function _get(key) {
    if (_cache[key] !== undefined) return _cache[key];
    return new Promise((resolve, reject) => {
      const tx   = _idb.transaction('data', 'readonly');
      const req  = tx.objectStore('data').get(key);
      req.onsuccess = () => {
        _cache[key] = req.result ?? null;
        resolve(_cache[key]);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function _set(key, value) {
    _cache[key] = value;
    return new Promise((resolve, reject) => {
      const tx  = _idb.transaction('data', 'readwrite');
      const req = tx.objectStore('data').put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async function _del(key) {
    delete _cache[key];
    return new Promise((resolve, reject) => {
      const tx  = _idb.transaction('data', 'readwrite');
      const req = tx.objectStore('data').delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async function _getAllKeys() {
    return new Promise((resolve, reject) => {
      const tx  = _idb.transaction('data', 'readonly');
      const req = tx.objectStore('data').getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Ключи ─────────────────────────────────────────────────────

  function init(token) { _token = token; }
  function getToken()  { return _token; }

  async function loadMeta() {
    console.log('[DB] loadMeta start, token=', _token);
    try {
      _idb = await _openDB();
      console.log('[DB] IndexedDB opened OK');
    } catch(e) {
      console.error('[DB] openDB failed:', e);
      throw e;
    }
    try {
      const meta = await _get(_k('meta'));
      console.log('[DB] meta loaded:', meta);
      if (meta) _cache['__meta'] = meta;
      return meta || { startDate: null, currentMonth: 0 };
    } catch(e) {
      console.error('[DB] get meta failed:', e);
      throw e;
    }
  }

  function _k(...parts) { return [_token, ...parts].join('::'); }
  function _mi()        { return getMeta().currentMonth || 0; }

  // ── Мета ──────────────────────────────────────────────────────

  function getMeta() {
    return _cache['__meta'] || { startDate: null, currentMonth: 0 };
  }

  async function setMeta(data) {
    const meta = Object.assign(getMeta(), data);
    _cache['__meta'] = meta;
    await _set(_k('meta'), meta);
  }

  // ── Задачи ────────────────────────────────────────────────────

  async function getTasks(week, day, monthIdx) {
    const mi  = monthIdx !== undefined ? monthIdx : _mi();
    const key = _k('tasks', mi, week, day);
    const val = await _get(key);
    return val || [];
  }

  async function saveTasks(week, day, tasks, monthIdx) {
    const mi  = monthIdx !== undefined ? monthIdx : _mi();
    await _set(_k('tasks', mi, week, day), tasks);
  }

  async function addTask(week, day, name, score) {
    const tasks = await getTasks(week, day);
    tasks.push({ id: Date.now(), name, score });
    await saveTasks(week, day, tasks);
    return tasks;
  }

  async function updateTask(week, day, id, fields) {
    const tasks = await getTasks(week, day);
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(tasks[idx], fields);
    await saveTasks(week, day, tasks);
    return tasks;
  }

  async function deleteTask(week, day, id) {
    const tasks = (await getTasks(week, day)).filter(t => t.id !== id);
    await saveTasks(week, day, tasks);
    return tasks;
  }

  // ── Рефлексия ─────────────────────────────────────────────────

  async function getReflection(scope, ...parts) {
    const key = _k('refl', _mi(), scope, ...parts);
    return (await _get(key)) || {};
  }

  async function saveReflection(data, scope, ...parts) {
    await _set(_k('refl', _mi(), scope, ...parts), data);
  }

  // ── Агрегация ─────────────────────────────────────────────────

  async function getDayScore(week, day, monthIdx) {
    const tasks = await getTasks(week, day, monthIdx);
    return tasks.reduce((s, t) => s + (t.score || 0), 0);
  }

  async function getWeekScore(week, monthIdx) {
    let total = 0;
    for (let d = 1; d <= 7; d++) total += await getDayScore(week, d, monthIdx);
    return total;
  }

  async function getWeekVampires(week, limit = 5) { return _top(week, week, 'min', limit); }
  async function getWeekDonors(week,   limit = 5) { return _top(week, week, 'max', limit); }
  async function getMonthVampires(limit = 5, mi)  { return _top(1, 4, 'min', limit, mi); }
  async function getMonthDonors(limit = 5,   mi)  { return _top(1, 4, 'max', limit, mi); }

  async function _top(wFrom, wTo, mode, limit, monthIdx) {
    const mi  = monthIdx !== undefined ? monthIdx : _mi();
    const all = [];

    for (let w = wFrom; w <= wTo; w++)
      for (let d = 1; d <= 7; d++)
        (await getTasks(w, d, mi)).forEach(t => {
          if (t.name && t.name.trim() && typeof t.score === 'number' && t.score !== 0)
            all.push({ name: t.name.trim(), score: t.score });
        });

    const map = {};
    all.forEach(({ name, score }) => {
      map[name] = map[name] === undefined ? score
        : mode === 'min' ? Math.min(map[name], score) : Math.max(map[name], score);
    });

    return Object.entries(map)
      .map(([name, score]) => ({ name, score }))
      .filter(e => mode === 'min' ? e.score <= -3 : e.score >= 3)
      .sort((a, b) => mode === 'min' ? a.score - b.score : b.score - a.score)
      .slice(0, limit);
  }

  // ── Позиция сегодня ───────────────────────────────────────────

  function getTodayPosition() {
    const { startDate } = getMeta();
    if (!startDate) return { week: 1, day: 1, isFinished: false };
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const today = new Date();          today.setHours(0, 0, 0, 0);
    const diff  = Math.floor((today - start) / 86400000);
    if (diff < 0)   return { week: 1, day: 1, isFinished: false };
    if (diff >= 28) return { week: 4, day: 7, isFinished: true };
    return { week: Math.floor(diff / 7) + 1, day: (diff % 7) + 1, isFinished: false };
  }

  // ── Архив ─────────────────────────────────────────────────────

  async function getMonthMeta(mi) {
    return (await _get(_k('monthmeta', mi))) || {};
  }

  async function setMonthMeta(data, monthIdx) {
    const mi      = monthIdx !== undefined ? monthIdx : _mi();
    const existing = await getMonthMeta(mi);
    await _set(_k('monthmeta', mi), { ...existing, ...data });
  }

  async function getArchiveList() {
    const current = _mi();
    const list    = [];
    for (let i = 0; i < current; i++) {
      const m = await getMonthMeta(i);
      if (!m.deleted) list.push({ index: i, ...m });
    }
    return list.reverse();
  }

  async function startNewMonth(startDate) {
    const meta = getMeta();
    const cur  = meta.currentMonth || 0;
    const mm   = await getMonthMeta(cur);
    await setMonthMeta({
      startDate: mm.startDate || meta.startDate,
      archivedAt: new Date().toISOString()
    }, cur);
    const newIdx = cur + 1;
    await setMeta({ currentMonth: newIdx, startDate });
    await setMonthMeta({ startDate }, newIdx);
    // Сбрасываем кэш задач
    Object.keys(_cache).forEach(k => {
      if (k.includes('::tasks::') || k.includes('::refl::')) delete _cache[k];
    });
  }

  async function deleteArchivedMonth(mi) {
    await setMonthMeta({ deleted: true }, mi);
  }

  // ── Экспорт / Импорт ─────────────────────────────────────────

  async function exportAllData() {
    const keys   = await _getAllKeys();
    const myKeys = keys.filter(k => k.startsWith(_token + '::'));
    const data   = {};
    for (const k of myKeys) {
      data[k] = await _get(k);
    }
    const backup = {
      version: 3,
      token: _token,
      exportedAt: new Date().toISOString(),
      data,
    };
    return JSON.stringify(backup, null, 2);
  }

  async function importAllData(jsonStr) {
    const backup = JSON.parse(jsonStr);
    if (!backup.data || backup.version < 3) throw new Error('Неверный формат файла');
    for (const [k, v] of Object.entries(backup.data)) {
      await _set(k, v);
    }
    // Перезагружаем мету
    const meta = await _get(_k('meta'));
    if (meta) _cache['__meta'] = meta;
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  // ── Автоэкспорт ──────────────────────────────────────────────
  // Раз в 7 дней предлагает скачать резервную копию.

  async function checkAutoExport() {
    const key      = _k('last_export');
    const lastRaw  = await _get(key);
    const lastDate = lastRaw ? new Date(lastRaw) : null;
    const now      = new Date();
    const daysSince = lastDate
      ? Math.floor((now - lastDate) / 86400000)
      : 999;

    if (daysSince >= 7) {
      return true; // нужен экспорт
    }
    return false;
  }

  async function markExported() {
    await _set(_k('last_export'), new Date().toISOString());
  }

  function getCurrentMonthIndex() { return _mi(); }

  return {
    init, getToken,
    loadMeta, getMeta, setMeta,
    getTasks, saveTasks, addTask, updateTask, deleteTask,
    getReflection, saveReflection,
    getDayScore, getWeekScore,
    getWeekVampires, getWeekDonors,
    getMonthVampires, getMonthDonors,
    getTodayPosition,
    getCurrentMonthIndex,
    getArchiveList, getMonthMeta, setMonthMeta,
    startNewMonth, deleteArchivedMonth,
    exportAllData, importAllData,
    checkAutoExport, markExported,
  };

})();
