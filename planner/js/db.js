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
      .filter(e => mode === 'min' ? e.score <= -3 : e.score >= 3);

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
      if (!m.deleted) list.push({ index: i, ...m });
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

  // ── Удалить месяц из архива ───────────────────────────────────
  function deleteArchivedMonth(monthIdx) {
    const prefix = monthKey(monthIdx, '');
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));

    // Обновляем список архива в мете — помечаем как удалённый
    const meta = getMonthMeta(monthIdx);
    setMonthMeta({ ...meta, deleted: true }, monthIdx);
  }

  // ── Привычки ─────────────────────────────────────────────────

  function getHabits() {
    const raw = localStorage.getItem(key('habits'));
    return raw ? JSON.parse(raw) : [];
  }

  function saveHabits(habits) {
    localStorage.setItem(key('habits'), JSON.stringify(habits));
  }

  function addHabit({ name, sphereId, energy }) {
    const habits = getHabits();
    habits.push({ id: Date.now(), name, sphereId, energy: energy || 3, createdAt: new Date().toISOString() });
    saveHabits(habits);
    return habits;
  }

  function deleteHabit(id) {
    saveHabits(getHabits().filter(h => h.id !== id));
  }

  function archiveHabit(id) {
    const habits = getHabits();
    const idx = habits.findIndex(h => h.id === id);
    if (idx !== -1) habits[idx].archived = true;
    saveHabits(habits);
  }

  // Ключ для хранения отметок одной недели
  // weekOffset: 0 = текущая неделя, -1 = прошлая, итд.
  // Храним абсолютный ISO-ключ начала недели (понедельник)
  function _weekKey(weekOffset) {
    const now = new Date();
    const dow = now.getDay() || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - (dow - 1) + weekOffset * 7);
    mon.setHours(0, 0, 0, 0);
    return key('comp', mon.toISOString().slice(0, 10));
  }

  // Возвращает объект { [habitId]: [bool×7] }
  function getCompletionsForWeek(weekOffset) {
    const raw = localStorage.getItem(_weekKey(weekOffset));
    return raw ? JSON.parse(raw) : {};
  }

  function toggleCompletion(habitId, weekOffset, dayIndex) {
    const comp = getCompletionsForWeek(weekOffset);
    if (!comp[habitId]) comp[habitId] = Array(7).fill(false);
    comp[habitId][dayIndex] = !comp[habitId][dayIndex];
    localStorage.setItem(_weekKey(weekOffset), JSON.stringify(comp));
  }

  // Получить выполненные привычки за конкретную дату (для дневника)
  function getCompletionsForDate(dateStr) {
    // dateStr = 'YYYY-MM-DD'
    const date = new Date(dateStr);
    const dow = date.getDay() || 7;
    const mon = new Date(date);
    mon.setDate(date.getDate() - (dow - 1));
    mon.setHours(0, 0, 0, 0);
    const wKey = key('comp', mon.toISOString().slice(0, 10));
    const comp = JSON.parse(localStorage.getItem(wKey) || '{}');
    const dayIdx = dow - 1; // 0=пн..6=вс
    const result = {};
    for (const hId of Object.keys(comp)) {
      result[hId] = comp[hId][dayIdx] || false;
    }
    return result;
  }

  function toggleCompletionByDate(habitId, dateStr) {
    const date = new Date(dateStr);
    const dow = date.getDay() || 7;
    const mon = new Date(date);
    mon.setDate(date.getDate() - (dow - 1));
    mon.setHours(0, 0, 0, 0);
    const wKey = key('comp', mon.toISOString().slice(0, 10));
    const comp = JSON.parse(localStorage.getItem(wKey) || '{}');
    const dayIdx = dow - 1;
    if (!comp[habitId]) comp[habitId] = Array(7).fill(false);
    comp[habitId][dayIdx] = !comp[habitId][dayIdx];
    localStorage.setItem(wKey, JSON.stringify(comp));
    return comp[habitId][dayIdx]; // новое состояние
  }

  // Суммарный бонус привычек за дату (только активные)
  function getHabitsEnergyForDate(dateStr) {
    const habits = getHabits().filter(h => !h.archived);
    const comp = getCompletionsForDate(dateStr);
    return habits.reduce((sum, h) => sum + (comp[h.id] ? h.energy : 0), 0);
  }

  // ── Статистика привычек по сферам за месяц ───────────────────
  // Возвращает { [sphereId]: { done, total, pct } }
  function getHabitsSphereStats() {
    const habits = getHabits(); // все, включая архивные
    const today = new Date();
    today.setHours(0,0,0,0);

    // Собираем все даты текущего месяца до сегодня включительно
    const year  = today.getFullYear();
    const month = today.getMonth();
    const days  = [];
    for (let d = 1; d <= today.getDate(); d++) {
      const dt = new Date(year, month, d);
      days.push(dt.toISOString().slice(0, 10));
    }

    // Кешируем completions по неделям чтобы не читать localStorage каждый раз
    const weekCache = {};
    function getWeekComp(dateStr) {
      const date = new Date(dateStr);
      const dow = date.getDay() || 7;
      const mon = new Date(date);
      mon.setDate(date.getDate() - (dow - 1));
      mon.setHours(0,0,0,0);
      const wKey = key('comp', mon.toISOString().slice(0,10));
      if (!weekCache[wKey]) {
        weekCache[wKey] = JSON.parse(localStorage.getItem(wKey) || '{}');
      }
      const dayIdx = dow - 1;
      const raw = weekCache[wKey];
      const result = {};
      // id может быть числом — приводим к строке для сравнения
      for (const hId of Object.keys(raw)) {
        result[hId] = raw[hId][dayIdx] || false;
      }
      return result;
    }

    const stats = {};
    habits.forEach(h => {
      if (!stats[h.sphereId]) stats[h.sphereId] = { done: 0, total: 0 };
      const hIdStr = String(h.id); // ключи в localStorage всегда строки
      days.forEach(dateStr => {
        const created = h.createdAt ? h.createdAt.slice(0,10) : '2000-01-01';
        if (created > dateStr) return;
        const comp = getWeekComp(dateStr);
        stats[h.sphereId].total++;
        if (comp[hIdStr]) stats[h.sphereId].done++;
      });
    });

    Object.keys(stats).forEach(id => {
      const s = stats[id];
      s.pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
    });

    return stats;
  }

  // ── Автоэкспорт ──────────────────────────────────────────────

  function checkAutoExport() {
    const lastRaw  = localStorage.getItem(key('last_export'));
    const lastDate = lastRaw ? new Date(lastRaw) : null;
    const daysSince = lastDate
      ? Math.floor((new Date() - lastDate) / 86400000)
      : 999;
    return daysSince >= 7;
  }

  function markExported() {
    localStorage.setItem(key('last_export'), new Date().toISOString());
  }

  function exportAllData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('planer_' + _token)) data[k] = localStorage.getItem(k);
    }
    return JSON.stringify({ version: 3, token: _token, exportedAt: new Date().toISOString(), data }, null, 2);
  }

  function importAllData(jsonStr) {
    const backup = JSON.parse(jsonStr);
    if (!backup.data) throw new Error('Неверный формат файла');
    Object.entries(backup.data).forEach(([k, v]) => localStorage.setItem(k, v));
  }

  return {
    init, getToken,
    getTasks, saveTasks, addTask, updateTask, deleteTask,
    getHabits, saveHabits, addHabit, deleteHabit, archiveHabit,
    getCompletionsForWeek, toggleCompletion,
    getCompletionsForDate, toggleCompletionByDate, getHabitsEnergyForDate,
    getHabitsSphereStats,
    getReflection, saveReflection,
    getDayScore, getWeekScore,
    getWeekVampires, getWeekDonors,
    getMonthVampires, getMonthDonors,
    getTodayPosition,
    getCurrentMonthIndex,
    getArchiveList, getMonthMeta, setMonthMeta, startNewMonth,
    getMeta, setMeta, deleteArchivedMonth,
    checkAutoExport, markExported, exportAllData, importAllData,
  };

})();
