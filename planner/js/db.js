// ── db.js — хранилище данных (localStorage) ──────────────────

const DB = (() => {

  let _token = null;
  const _cache = {};

  function init(token) { _token = token; }
  function getToken()  { return _token; }
  function key(...parts) { return ['planer', _token, ...parts].join('_'); }
  function _mi() { return getMeta().currentMonth || 0; }

  async function loadMeta() {
    const raw = localStorage.getItem(key('meta'));
    const meta = raw ? JSON.parse(raw) : { startDate: null, currentMonth: 0 };
    _cache['__meta'] = meta;
    return meta;
  }

  function getMeta() {
    return _cache['__meta'] || { startDate: null, currentMonth: 0 };
  }

  async function setMeta(data) {
    const meta = Object.assign(getMeta(), data);
    _cache['__meta'] = meta;
    localStorage.setItem(key('meta'), JSON.stringify(meta));
  }

  // ── Задачи ────────────────────────────────────────────────────
  async function getTasks(week, day, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : _mi();
    const k  = key('tasks', mi, week, day);
    if (_cache[k]) return _cache[k];
    const raw = localStorage.getItem(k);
    const val = raw ? JSON.parse(raw) : [];
    _cache[k] = val;
    return val;
  }

  async function saveTasks(week, day, tasks, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : _mi();
    const k  = key('tasks', mi, week, day);
    _cache[k] = tasks;
    localStorage.setItem(k, JSON.stringify(tasks));
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
    const k   = key('refl', _mi(), scope, ...parts);
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : {};
  }

  async function saveReflection(data, scope, ...parts) {
    localStorage.setItem(key('refl', _mi(), scope, ...parts), JSON.stringify(data));
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
    const raw = localStorage.getItem(key('monthmeta', mi));
    return raw ? JSON.parse(raw) : {};
  }

  async function setMonthMeta(data, monthIdx) {
    const mi      = monthIdx !== undefined ? monthIdx : _mi();
    const existing = await getMonthMeta(mi);
    localStorage.setItem(key('monthmeta', mi), JSON.stringify({ ...existing, ...data }));
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
    await setMonthMeta({ startDate: mm.startDate || meta.startDate, archivedAt: new Date().toISOString() }, cur);
    const newIdx = cur + 1;
    await setMeta({ currentMonth: newIdx, startDate });
    await setMonthMeta({ startDate }, newIdx);
    Object.keys(_cache).forEach(k => { if (k.includes('tasks') || k.includes('refl')) delete _cache[k]; });
  }

  async function deleteArchivedMonth(mi) {
    await setMonthMeta({ deleted: true }, mi);
  }

  // ── Экспорт / Импорт ─────────────────────────────────────────
  async function exportAllData() {
    const prefix = 'planer_' + _token + '_';
    const data   = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) data[k] = localStorage.getItem(k);
    }
    return JSON.stringify({ version: 3, token: _token, exportedAt: new Date().toISOString(), data }, null, 2);
  }

  async function importAllData(jsonStr) {
    const backup = JSON.parse(jsonStr);
    if (!backup.data) throw new Error('Неверный формат файла');
    Object.entries(backup.data).forEach(([k, v]) => localStorage.setItem(k, v));
    const raw = localStorage.getItem(key('meta'));
    if (raw) _cache['__meta'] = JSON.parse(raw);
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  // ── Автоэкспорт ──────────────────────────────────────────────
  async function checkAutoExport() {
    const lastRaw   = localStorage.getItem(key('last_export'));
    const lastDate  = lastRaw ? new Date(lastRaw) : null;
    const daysSince = lastDate ? Math.floor((new Date() - lastDate) / 86400000) : 999;
    return daysSince >= 7;
  }

  async function markExported() {
    localStorage.setItem(key('last_export'), new Date().toISOString());
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
