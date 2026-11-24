// ── db.js — хранилище данных ──────────────────────────────────

const DB = (() => {

  let _token = null;
  const SPHERES = Object.freeze([
    {id:'energy',emoji:'🔥',name:'Энергия и тело'},
    {id:'self',emoji:'💛',name:'Я и только я'},
    {id:'work',emoji:'💼',name:'Дело и деньги'},
    {id:'love',emoji:'💞',name:'Отношения'},
    {id:'home',emoji:'🏡',name:'Пространство'},
    {id:'growth',emoji:'🌱',name:'Саморазвитие'},
    {id:'values',emoji:'✨',name:'Ценности'}
  ].map(Object.freeze));
  function normalizeSphere(id) { return SPHERES.some(s=>s.id===id) ? id : null; }

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

  function addTask(week, day, name, score, sphereId = null) {
    const tasks = getTasks(week, day);
    tasks.push({ id: Date.now(), name, score, sphereId: normalizeSphere(sphereId) });
    saveTasks(week, day, tasks);
    return tasks;
  }

  function updateTask(week, day, id, fields) {
    const tasks = getTasks(week, day);
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(tasks[idx], fields, Object.hasOwn(fields,'sphereId') ? {sphereId:normalizeSphere(fields.sphereId)} : {});
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

  function localDate(d = new Date()) {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function parseDate(s) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y,m-1,d,12);
  }
  function dateForDay(week, day, monthIdx = getCurrentMonthIndex()) {
    const start = monthIdx === getCurrentMonthIndex() ? getMeta().startDate : getMonthMeta(monthIdx).startDate;
    if (!start) return null;
    const d = parseDate(start);
    d.setDate(d.getDate() + (week-1)*7 + day-1);
    return localDate(d);
  }
  function getDayBreakdown(week, day, monthIdx) {
    const tasks = getTasks(week, day, monthIdx).reduce((sum,t)=>sum+(Number(t.score)||0),0);
    const date = dateForDay(week,day,monthIdx);
    const habits = date ? getHabitsEnergyForDate(date) : 0;
    return {tasks, habits, total:tasks+habits};
  }
  function getDayScore(week, day, monthIdx) {
    return getDayBreakdown(week,day,monthIdx).total;
  }

  function getSphereEnergy(weekFrom=1,weekTo=4,monthIdx=getCurrentMonthIndex()) {
    const rows = new Map([...SPHERES,{id:null,name:'Без категории',emoji:''}].map(s=>[s.id,{...s,positive:0,negative:0,total:0,count:0,items:[]}]));
    function add(entry,kind) {
      const row=rows.get(normalizeSphere(entry.sphereId));
      const score=Number(entry.score)||0;
      row.positive+=Math.max(0,score); row.negative+=Math.max(0,-score);
      row.total+=score; row.count++;
      const name=entry.name||'Без названия';
      let item=row.items.find(i=>i.name===name && i.kind===kind);
      if(!item){item={name,kind,score:0,count:0};row.items.push(item);}
      item.score+=score;item.count++;
    }
    const habits=getHabits();
    for(let w=weekFrom;w<=weekTo;w++) for(let d=1;d<=7;d++){
      getTasks(w,d,monthIdx).forEach(t=>add(t,'task'));
      const date=dateForDay(w,d,monthIdx);
      if(date){const comp=getCompletionsForDate(date);habits.filter(h=>comp[h.id]).forEach(h=>add({...h,score:h.energy},'habit'));}
    }
    return [...rows.values()].filter(r=>r.count);
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
        const date = dateForDay(w,d,mi);
        const completed = date ? getCompletionsForDate(date) : {};
        const entries = getTasks(w,d,mi).concat(getHabits().filter(h=>completed[h.id]).map(h=>({name:h.name,score:Number(h.energy)||0})));
        entries.forEach(t => {
          if (t.name && t.name.trim() && typeof t.score === 'number' && t.score !== 0) {
            all.push({ name: t.name.trim(), score: t.score });
          }
        });
      }
    }

    const map = Object.create(null);
    all.forEach(({ name, score }) => {
      if (map[name] === undefined) { map[name] = score; return; }
      map[name] = mode === 'min' ? Math.min(map[name], score) : Math.max(map[name], score);
    });

    const entries = Object.entries(map)
      .map(([name, score]) => ({ name, score }))
      .filter(e => mode === 'min' ? e.score <= -3 : e.score > 0);

    entries.sort((a, b) => mode === 'min' ? a.score - b.score : b.score - a.score);
    return entries.slice(0, limit);
  }

  // ── Позиция сегодня ───────────────────────────────────────────

  function getTodayPosition() {
    const meta = getMeta();
    if (!meta.startDate) return { week: 1, day: 1, isFinished: false };

    const start = parseDate(meta.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = (Date.parse(localDate(today)) - Date.parse(localDate(start))) / 86400000;

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
    habits.push({ id: Date.now(), name, sphereId, energy: energy ?? 3, createdAt: new Date().toISOString(), createdOn: localDate() });
    saveHabits(habits);
    return habits;
  }

  function deleteHabit(id) {
    saveHabits(getHabits().filter(h => h.id !== id));
  }

  function archiveHabit(id) {
    const habits = getHabits();
    const idx = habits.findIndex(h => h.id === id);
    if (idx !== -1) { habits[idx].archived = true; habits[idx].archivedOn = localDate(); }
    saveHabits(habits);
  }

  // v2 uses local Monday keys. Legacy UTC keys are read without deleting them.
  function monday(dateStr) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() - ((d.getDay()+6)%7));
    return d;
  }
  function weekDate(offset) {
    const d = monday(localDate());
    d.setDate(d.getDate()+offset*7);
    return localDate(d);
  }
  function readWeek(dateStr) {
    const mon = monday(dateStr);
    const canonical = key('comp_v2',localDate(mon));
    const saved = localStorage.getItem(canonical);
    if (saved !== null) return JSON.parse(saved);
    // Old keys are either Monday or the preceding Sunday, depending on timezone.
    const sun = new Date(mon); sun.setDate(sun.getDate()-1);
    const result = {};
    for (const date of [localDate(sun),localDate(mon)]) {
      const old = JSON.parse(localStorage.getItem(key('comp',date)) || '{}');
      for (const [id,days] of Object.entries(old)) {
        result[id] = Array.from({length:7},(_,i)=>Boolean(result[id]?.[i] || days[i]));
      }
    }
    return result;
  }
  function writeToggle(id,dateStr) {
    const mon = monday(dateStr);
    const i = (parseDate(dateStr).getDay()+6)%7;
    const comp = readWeek(dateStr);
    const habit = getHabits().find(h=>String(h.id)===String(id));
    if (!habit || !isHabitEligible(habit,dateStr) || dateStr > localDate()) return Boolean(comp[id]?.[i]);
    if (!comp[id]) comp[id] = Array(7).fill(false);
    comp[id][i] = !comp[id][i];
    localStorage.setItem(key('comp_v2',localDate(mon)),JSON.stringify(comp));
    return comp[id][i];
  }
  function getCompletionsForWeek(offset) { return readWeek(weekDate(offset)); }
  function toggleCompletion(id,offset,i) {
    const d = parseDate(weekDate(offset)); d.setDate(d.getDate()+i);
    return writeToggle(id,localDate(d));
  }
  function getCompletionsForDate(dateStr) {
    const i = (parseDate(dateStr).getDay()+6)%7;
    return Object.fromEntries(Object.entries(readWeek(dateStr)).map(([id,days])=>[id,Boolean(days[i])]));
  }
  function toggleCompletionByDate(id,dateStr) { return writeToggle(id,dateStr); }
  function isHabitEligible(h,dateStr) {
    const created = h.createdOn || (h.createdAt ? localDate(new Date(h.createdAt)) : '2000-01-01');
    return dateStr >= created && (!h.archived || (h.archivedOn && dateStr <= h.archivedOn));
  }
  function getHabitsEnergyForDate(dateStr) {
    const comp = getCompletionsForDate(dateStr);
    return getHabits().reduce((sum,h)=>sum+(comp[h.id] ? Number(h.energy)||0 : 0),0);
  }
  function getSpherePresence(monthIdx = getCurrentMonthIndex()) {
    const stats=Object.fromEntries(SPHERES.map(s=>[s.id,{all:0,tasks:0,habits:0}]));
    const today=localDate();
    const meta=monthIdx===getCurrentMonthIndex()?{}:getMonthMeta(monthIdx);
    const end=meta.archivedAt?localDate(new Date(meta.archivedAt)):today;
    let days=0;
    const habits=getHabits();
    for(let w=1;w<=4;w++) for(let d=1;d<=7;d++){
      const date=dateForDay(w,d,monthIdx);
      if(!date||date>today||date>end) continue;
      days++;
      const tasks=new Set(getTasks(w,d,monthIdx).filter(t=>String(t.name||'').trim()).map(t=>normalizeSphere(t.sphereId)));
      const comp=getCompletionsForDate(date);
      const done=new Set(habits.filter(h=>comp[h.id]).map(h=>normalizeSphere(h.sphereId)));
      for(const s of SPHERES){const st=stats[s.id];if(tasks.has(s.id))st.tasks++;if(done.has(s.id))st.habits++;if(tasks.has(s.id)||done.has(s.id))st.all++;}
    }
    return {days,stats};
  }

  function getHabitsSphereStats(monthIdx = getCurrentMonthIndex()) {
    const stats = {};
    const today = localDate();
    const meta = monthIdx === getCurrentMonthIndex() ? {} : getMonthMeta(monthIdx);
    const end = meta.archivedAt ? localDate(new Date(meta.archivedAt)) : today;
    for (let w=1;w<=4;w++) for(let d=1;d<=7;d++) {
      const date = dateForDay(w,d,monthIdx);
      if (!date || date>today || date>end) continue;
      const comp = getCompletionsForDate(date);
      for (const h of getHabits()) {
        if (!comp[h.id] && !isHabitEligible(h,date)) continue;
        const st = stats[h.sphereId] ||= {done:0,total:0,pct:0};
        st.total++;
        if(comp[h.id]) st.done++;
      }
    }
    for(const st of Object.values(stats)) st.pct = Math.round(100*st.done/st.total);
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
    SPHERES, normalizeSphere, init, getToken, localDate, parseDate, dateForDay, getDayBreakdown, isHabitEligible,
    getTasks, saveTasks, addTask, updateTask, deleteTask,
    getHabits, saveHabits, addHabit, deleteHabit, archiveHabit,
    getCompletionsForWeek, toggleCompletion,
    getCompletionsForDate, toggleCompletionByDate, getHabitsEnergyForDate,
    getHabitsSphereStats,
    getReflection, saveReflection,
    getDayScore, getWeekScore, getSphereEnergy, getSpherePresence,
    getWeekVampires, getWeekDonors,
    getMonthVampires, getMonthDonors,
    getTodayPosition,
    getCurrentMonthIndex,
    getArchiveList, getMonthMeta, setMonthMeta, startNewMonth,
    getMeta, setMeta, deleteArchivedMonth,
    checkAutoExport, markExported, exportAllData, importAllData,
  };

})();
