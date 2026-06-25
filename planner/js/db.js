// ── db.js — хранилище данных (localStorage) ──────────────────

const DB = (() => {

  let _token = null;

  function init(token) { _token = token; }

  function key(...parts) { return ['planer', _token, ...parts].join('_'); }

  // ── Задачи дня ──────────────────────────────────────────────

  function getTasks(week, day) {
    const raw = localStorage.getItem(key('tasks', week, day));
    return raw ? JSON.parse(raw) : [];
  }

  function saveTasks(week, day, tasks) {
    localStorage.setItem(key('tasks', week, day), JSON.stringify(tasks));
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

  // ── Рефлексия ───────────────────────────────────────────────

  function getReflection(scope, ...parts) {
    const raw = localStorage.getItem(key('reflection', scope, ...parts));
    return raw ? JSON.parse(raw) : {};
  }

  function saveReflection(data, scope, ...parts) {
    localStorage.setItem(key('reflection', scope, ...parts), JSON.stringify(data));
  }

  // ── Агрегация ────────────────────────────────────────────────

  function getDayScore(week, day) {
    return getTasks(week, day).reduce((s, t) => s + (t.score || 0), 0);
  }

  function getWeekScore(week) {
    let total = 0;
    for (let d = 1; d <= 7; d++) total += getDayScore(week, d);
    return total;
  }

  // ── Вампиры / доноры (исправлено) ───────────────────────────

  function getWeekVampires(week, limit = 5) {
    return _getTopForWeeks(week, week, 'min', limit);
  }

  function getWeekDonors(week, limit = 5) {
    return _getTopForWeeks(week, week, 'max', limit);
  }

  function getMonthVampires(limit = 5) {
    return _getTopForWeeks(1, 4, 'min', limit);
  }

  function getMonthDonors(limit = 5) {
    return _getTopForWeeks(1, 4, 'max', limit);
  }

  function _getTopForWeeks(weekFrom, weekTo, mode, limit) {
    let all = [];

    for (let w = weekFrom; w <= weekTo; w++) {
      for (let d = 1; d <= 7; d++) {
        getTasks(w, d).forEach(t => {
          if (t.name && t.name.trim() && typeof t.score === 'number' && t.score !== 0) {
            all.push({ name: t.name.trim(), score: t.score });
          }
        });
      }
    }

    // Группируем по названию: min для вампиров, max для доноров
    const map = {};
    all.forEach(({ name, score }) => {
      if (map[name] === undefined) { map[name] = score; return; }
      map[name] = mode === 'min'
        ? Math.min(map[name], score)
        : Math.max(map[name], score);
    });

    // Фильтруем по знаку и сортируем
    const entries = Object.entries(map)
      .map(([name, score]) => ({ name, score }))
      .filter(e => mode === 'min' ? e.score < 0 : e.score > 0);

    entries.sort((a, b) => mode === 'min' ? a.score - b.score : b.score - a.score);

    return entries.slice(0, limit);
  }

  // ── Вычислить текущую неделю и день по дате начала ───────────

  function getTodayPosition() {
    const meta = getMeta();
    if (!meta.startDate) return { week: 1, day: 1 };

    const start = new Date(meta.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { week: 1, day: 1 };           // ещё не начался
    if (diffDays >= 28) return { week: 4, day: 7 };          // закончился

    const week = Math.floor(diffDays / 7) + 1;
    const day  = (diffDays % 7) + 1;
    return { week, day };
  }

  // ── Метаданные ───────────────────────────────────────────────

  function getMeta() {
    const raw = localStorage.getItem(key('meta'));
    return raw ? JSON.parse(raw) : { startDate: null };
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
    getMeta, setMeta,
  };

})();
