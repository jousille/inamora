// ── db.js — хранилище данных (localStorage) ──────────────────

const DB = (() => {

  let _token = null;

  function init(token) { _token = token; }
  function getToken()  { return _token; }
  function key(...parts) { return ['planer', _token, ...parts].join('_'); }
  function _mi() { return getMeta().currentMonth || 0; }

  // ── Мета ──────────────────────────────────────────────────────
  function getMeta() {
    const raw = localStorage.getItem(key('meta'));
    return raw ? JSON.parse(raw) : { startDate: null, currentMonth: 0 };
  }

  function setMeta(data) {
    const meta = Object.assign(getMeta(), data);
    localStorage.setItem(key('meta'), JSON.stringify(meta));
  }

  // ── Задачи ────────────────────────────────────────────────────
  function getTasks(week, day, monthIdx) {
    const mi  = monthIdx !== undefined ? monthIdx : _mi();
    const raw = localStorage.getItem(key('tasks', mi, week, day));
    return raw ? JSON.parse(raw) : [];
  }

  function saveTasks(week, day, tasks, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : _mi();
    localStorage.setItem(key('tasks', mi, week, day), JSON.stringify(tasks));
  }

  function addTask(week, day, name, score) {
    const tasks = getTasks(week, day);
    tasks.push({ id: Date.now(), name, score });
    saveTasks(week, day, tasks);
    return tasks;
  }

  function updateTask(week, day, id, fields) {
    const tasks = getTasks(week, day);
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(tasks[idx], fields);
    saveTasks(week, day, tasks);
    return tasks;
  }

  function deleteTask(week, day, id) {
    const tasks = getTasks(week, day).filter(t => t.id !== id);
    saveTasks(week, day, tasks);
    return tasks;
  }

  // ── Рефлексия ─────────────────────────────────────────────────
  function getReflection(scope, ...parts) {
    const raw = localStorage.getItem(key('refl', _mi(), scope, ...parts));
    return raw ? JSON.parse(raw) : {};
  }

  function saveReflection(data, scope, ...parts) {
    localStorage.setItem(key('refl', _mi(), scope, ...parts), JSON.stringify(data));
  }

  // ── Агрегация ─────────────────────────────────────────────────
  function getDayScore(week, day, monthIdx) {
    return getTasks(week, day, monthIdx).reduce((s, t) => s + (t.score || 0), 0);
  }

  function getWeekScore(week, monthIdx) {
    let total = 0;
    for (let d = 1; d <= 7; d++) total += getDayScore(week, d, monthIdx);
    return total;
  }

  function getWeekVampires(week, limit = 5) { return _top(week, week, 'min', limit); }
  function getWeekDonors(week,   limit = 5) { return _top(week, week, 'max', limit); }
  function getMonthVampires(limit = 5, mi)  { return _top(1, 4, 'min', limit, mi); }
  function getMonthDonors(limit = 5,   mi)  { return _top(1, 4, 'max', limit, mi); }

  function _top(wFrom, wTo, mode, limit, monthIdx) {
    const mi  = monthIdx !== undefined ? monthIdx : _mi();
    const all = [];
    for (let w = wFrom; w <= wTo; w++)
      for (let d = 1; d <= 7; d++)
        getTasks(w, d, mi).forEach(t => {
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
  function getMonthMeta(mi) {
    const raw = localStorage.getItem(key('monthmeta', mi));
    return raw ? JSON.parse(raw) : {};
  }

  function setMonthMeta(data, monthIdx) {
    const mi      = monthIdx !== undefined ? monthIdx : _mi();
    const existing = getMonthMeta(mi);
    localStorage.setItem(key('monthmeta', mi), JSON.stringify({ ...existing, ...data }));
  }

  function getArchiveList() {
    const current = _mi();
    const list    = [];
    for (let i = 0; i < current; i++) {
      const m = getMonthMeta(i);
      if (!m.deleted) list.push({ index: i, ...m });
    }
    return list.reverse();
  }

  function startNewMonth(startDate) {
    const meta = getMeta();
    const cur  = meta.currentMonth || 0;
    const mm   = getMonthMeta(cur);
    setMonthMeta({ startDate: mm.startDate || meta.startDate, archivedAt: new Date().toISOString() }, cur);
    const newIdx = cur + 1;
    setMeta({ currentMonth: newIdx, startDate });
    setMonthMeta({ startDate }, newIdx);
  }

  function deleteArchivedMonth(mi) {
    setMonthMeta({ deleted: true }, mi);
  }

  // ── Экспорт / Импорт ─────────────────────────────────────────
  function exportAllData() {
    const prefix = 'planer_' + _token + '_';
    const data   = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) data[k] = localStorage.getItem(k);
    }
    return JSON.stringify({ version: 3, token: _token, exportedAt: new Date().toISOString(), data }, null, 2);
  }

  function importAllData(jsonStr) {
    const backup = JSON.parse(jsonStr);
    if (!backup.data) throw new Error('Неверный формат файла');
    Object.entries(backup.data).forEach(([k, v]) => localStorage.setItem(k, v));
  }

  function getCurrentMonthIndex() { return _mi(); }

  return {
    init, getToken,
    getMeta, setMeta,
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
  };

})();
