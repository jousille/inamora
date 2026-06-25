// ── db.js — хранилище данных ──────────────────────────────────

const DB = (() => {

  let _token = null;

  function init(token) { _token = token; }

  function key(...parts) { return ['planer', _token, ...parts].join('_'); }

  // ── Текущий месяц (индекс) ───────────────────────────────────

  function getCurrentMonthIndex() {
    const meta = getMeta();
    return meta.currentMonth || 0; // 0 = первый месяц
  }

  function monthKey(monthIdx, ...parts) {
    return key('m' + monthIdx, ...parts);
  }

  // ── Задачи дня ───────────────────────────────────────────────

  function getTasks(week, day, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : getCurrentMonthIndex();
    const raw = localStorage.getItem(monthKey(mi, 'tasks', week, day));
    return raw ? JSON.parse(raw) : [];
  }

  function saveTasks(week, day, tasks, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : getCurrentMonthIndex();
    localStorage.setItem(monthKey(mi, 'tasks', week, day), JSON.stringify(tasks));
  }

  function addTask(week, day, name, score) {
    const tasks = getTasks(week, day);
    tasks.push({ id: Date.now(), name, score });
    saveTasks(week, day, tasks);
    return tasks;
  }

  function updateTask(week, day, id, fields) {
    const tasks = getTasks(week, day);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(tasks[idx], fields);
    saveTasks(week, day, tasks);
    return tasks;
  }

  function deleteTask(week, day, id) {
    const tasks = getTasks(week, day).filter(t => t.id !== id);
    saveTasks(week, day, tasks);
    return tasks;
  }

  // ── Рефлексия ────────────────────────────────────────────────

  function getReflection(scope, ...parts) {
    const mi = getCurrentMonthIndex();
    const raw = localStorage.getItem(monthKey(mi, 'reflection', scope, ...parts));
    return raw ? JSON.parse(raw) : {};
  }

  function saveReflection(data, scope, ...parts) {
    const mi = getCurrentMonthIndex();
    localStorage.setItem(monthKey(mi, 'reflection', scope, ...parts), JSON.stringify(data));
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

  function getWeekVampires(week, limit = 5) {
    return _getTopForWeeks(week, week, 'min', limit);
  }

  function getWeekDonors(week, limit = 5) {
    return _getTopForWeeks(week, week, 'max', limit);
  }

  function getMonthVampires(limit = 5, monthIdx) {
    return _getTopForWeeks(1, 4, 'min', limit, monthIdx);
  }

  function getMonthDonors(limit = 5, monthIdx) {
    return _getTopForWeeks(1, 4, 'max', limit, monthIdx);
  }

  function _getTopForWeeks(weekFrom, weekTo, mode, limit, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : getCurrentMonthIndex();
    let all = [];

    for (let w = weekFrom; w <= weekTo; w++) {
      for (let d = 1; d <= 7; d++) {
        getTasks(w, d, mi).forEach(t => {
          if (t.name && t.name.trim() && typeof t.score === 'number' && t.score !== 0) {
            all.push({ name: t.name.trim(), score: t.score });
          }
        });
      }
    }

    const map = {};
    all.forEach(({ name, score }) => {
      if (map[name] === undefined) { map[name] = score; return; }
      map[name] = mode === 'min' ? Math.min(map[name], score) : Math.max(map[name], score);
    });

    const entries = Object.entries(map)
      .map(([name, score]) => ({ name, score }))
      .filter(e => mode === 'min' ? e.score < 0 : e.score > 0);

    entries.sort((a, b) => mode === 'min' ? a.score - b.score : b.score - a.score);
    return entries.slice(0, limit);
  }

  // ── Позиция сегодня ───────────────────────────────────────────

  function getTodayPosition() {
    const meta = getMeta();
    if (!meta.startDate) return { week: 1, day: 1, isFinished: false };

    const start = new Date(meta.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));

    if (diffDays < 0)  return { week: 1, day: 1, isFinished: false };
    if (diffDays >= 28) return { week: 4, day: 7, isFinished: true };

    return {
      week: Math.floor(diffDays / 7) + 1,
      day:  (diffDays % 7) + 1,
      isFinished: false,
    };
  }

  // ── Архив месяцев ─────────────────────────────────────────────

  function getArchiveList() {
    // Возвращает массив индексов прошлых месяцев
    const meta = getMeta();
    const current = meta.currentMonth || 0;
    const list = [];
    for (let i = 0; i < current; i++) {
      const m = getMonthMeta(i);
      list.push({ index: i, ...m });
    }
    return list.reverse(); // последний сначала
  }

  function getMonthMeta(monthIdx) {
    const raw = localStorage.getItem(monthKey(monthIdx, 'monthmeta'));
    return raw ? JSON.parse(raw) : {};
  }

  function setMonthMeta(data, monthIdx) {
    const mi = monthIdx !== undefined ? monthIdx : getCurrentMonthIndex();
    const existing = getMonthMeta(mi);
    localStorage.setItem(monthKey(mi, 'monthmeta'), JSON.stringify({ ...existing, ...data }));
  }

  function startNewMonth(startDate) {
    const meta = getMeta();
    const currentIdx = meta.currentMonth || 0;

    // Сохраняем мету текущего месяца в архив
    const currentMeta = getMonthMeta(currentIdx);
    if (!currentMeta.startDate) {
      setMonthMeta({ startDate: meta.startDate, archivedAt: new Date().toISOString() }, currentIdx);
    } else {
      setMonthMeta({ archivedAt: new Date().toISOString() }, currentIdx);
    }

    // Переключаемся на новый месяц
    const newIdx = currentIdx + 1;
    setMeta({ currentMonth: newIdx, startDate });
    setMonthMeta({ startDate }, newIdx);
  }

  // ── Метаданные ────────────────────────────────────────────────

  function getMeta() {
    const raw = localStorage.getItem(key('meta'));
    return raw ? JSON.parse(raw) : { startDate: null, currentMonth: 0 };
  }

  function setMeta(data) {
    const meta = Object.assign(getMeta(), data);
    localStorage.setItem(key('meta'), JSON.stringify(meta));
  }

  function getToken() { return _token; }

  return {
    init, getToken,
    getTasks, saveTasks, addTask, updateTask, deleteTask,
    getReflection, saveReflection,
    getDayScore, getWeekScore,
    getWeekVampires, getWeekDonors,
    getMonthVampires, getMonthDonors,
    getTodayPosition,
    getCurrentMonthIndex,
    getArchiveList, getMonthMeta, setMonthMeta, startNewMonth,
    getMeta, setMeta,
  };

})();
