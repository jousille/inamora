// ── habits.js — экран привычек ────────────────────────────────

const HabitsScreen = (() => {

  const SPHERES = [
    { id: 'energy',  emoji: '🔥', name: 'Энергия и тело' },
    { id: 'self',    emoji: '💛', name: 'Я и только я' },
    { id: 'work',    emoji: '💼', name: 'Дело и деньги' },
    { id: 'love',    emoji: '💞', name: 'Отношения' },
    { id: 'home',    emoji: '🏡', name: 'Пространство' },
    { id: 'growth',  emoji: '🌱', name: 'Саморазвитие' },
    { id: 'values',  emoji: '✨', name: 'Ценности' },
  ];

  const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  let weekOffset = 0; // 0 = текущая неделя

  // ── Инициализация ─────────────────────────────────────────────

  function init() {
    render();
  }

  // ── Render ────────────────────────────────────────────────────

  function render() {
    const el = document.getElementById('screen-habits');
    if (!el) return;

    const mon = getWeekStart(weekOffset);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const range = `${mon.getDate()} ${MONTHS_SHORT[mon.getMonth()]} — ${sun.getDate()} ${MONTHS_SHORT[sun.getMonth()]}`;
    const isPast = weekOffset < 0;
    const todayDow = (new Date().getDay() || 7) - 1; // 0=пн..6=вс

    const habits = DB.getHabits();
    const completions = DB.getCompletionsForWeek(weekOffset);

    // Группируем по сферам
    const bySphere = {};
    habits.forEach(h => {
      if (!bySphere[h.sphereId]) bySphere[h.sphereId] = [];
      bySphere[h.sphereId].push(h);
    });

    // Итог недели по сферам
    const summaryRows = SPHERES
      .filter(s => bySphere[s.id] && bySphere[s.id].length > 0)
      .map(s => {
        const sHabits = bySphere[s.id];
        let total = 0, done = 0;
        sHabits.forEach(h => {
          for (let i = 0; i < 7; i++) {
            const isFuture = weekOffset === 0 && i > todayDow;
            if (!isFuture) total++;
            if (completions[h.id] && completions[h.id][i]) done++;
          }
        });
        const pct = total ? Math.round(done / total * 100) : 0;
        return `
          <div class="sphere-row">
            <span class="sphere-emoji">${s.emoji}</span>
            <span class="sphere-name">${s.name}</span>
            <div class="sphere-track"><div class="sphere-fill" style="width:${pct}%"></div></div>
            <span class="sphere-pct">${pct}%</span>
          </div>`;
      }).join('');

    // Карточки привычек по сферам
    const habitSections = SPHERES
      .filter(s => bySphere[s.id] && bySphere[s.id].length > 0)
      .map(s => {
        const cards = bySphere[s.id].map(h => renderHabitCard(h, completions, todayDow, isPast)).join('');
        return `
          <div class="sphere-section">
            <div class="sphere-title">
              <span>${s.emoji} ${s.name}</span>
              <div class="sphere-line"></div>
            </div>
            ${cards}
          </div>`;
      }).join('');

    const emptyState = habits.length === 0
      ? `<div class="habits-empty">Пока нет привычек.<br>Добавьте первую.</div>`
      : '';

    el.innerHTML = `
      <div class="hab-header">
        <div class="hab-nav">
          <button class="hab-arrow" onclick="HabitsScreen.shiftWeek(-1)">‹</button>
          <span class="hab-range">${range}</span>
          <button class="hab-arrow" onclick="HabitsScreen.shiftWeek(1)" ${weekOffset >= 0 ? 'disabled' : ''}>›</button>
        </div>
        <h2 class="hab-title">Привычки</h2>
      </div>

      <div class="page-content hab-content">

        ${isPast ? `<div class="past-banner">📅 Архив · только просмотр</div>` : ''}

        ${summaryRows.length ? `
        <div class="week-summary">
          <div class="week-sum-title">Итог недели</div>
          ${summaryRows}
        </div>` : ''}

        ${emptyState}
        ${habitSections}

        ${!isPast ? `<button class="add-habit-btn" onclick="HabitsScreen.openModal()">+ добавить привычку</button>` : ''}

      </div>
    `;
  }

  function renderHabitCard(habit, completions, todayDow, isPast) {
    const done = completions[habit.id] || Array(7).fill(false);
    const totalDays = isPast ? 7 : todayDow + 1;
    const doneDays = done.filter(Boolean).length;
    const pct = totalDays ? Math.round(doneDays / totalDays * 100) : 0;

    // Серия подряд
    const streak = calcStreak(habit.id);

    const dots = DAYS_SHORT.map((d, i) => {
      const isFuture = !isPast && i > todayDow;
      const isDone = done[i];
      const isToday = !isPast && i === todayDow;
      return `<div class="dot ${isDone ? 'done' : ''} ${isToday ? 'today-dot' : ''} ${isFuture ? 'future-dot' : ''}"
        ${!isFuture && !isPast ? `onclick="HabitsScreen.toggleDot('${habit.id}', ${i})"` : ''}
        title="${d}">${d[0]}</div>`;
    }).join('');

    return `
      <div class="habit-card">
        <div class="habit-top">
          <span class="habit-name">${escHtml(habit.name)}</span>
          <div class="habit-top-right">
            ${streak > 1 ? `<span class="habit-streak">🔥 ${streak} дн.</span>` : ''}
            ${!isPast ? `<button class="habit-del" onclick="HabitsScreen.confirmDelete(${habit.id})" title="Удалить привычку">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>` : ''}
          </div>
        </div>
        <div class="dots-row">${dots}</div>
        <div class="habit-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-label"><span>${doneDays} из ${totalDays} дней</span><span>${pct}%</span></div>
        </div>
      </div>`;
  }

  // ── Навигация по неделям ──────────────────────────────────────

  function shiftWeek(dir) {
    if (weekOffset + dir > 0) return;
    weekOffset += dir;
    render();
  }

  function getWeekStart(offset) {
    const now = new Date();
    const dow = now.getDay() || 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - (dow - 1) + offset * 7);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  // ── Серия ─────────────────────────────────────────────────────

  function calcStreak(habitId) {
    // Смотрим назад от сегодня
    let streak = 0;
    for (let w = 0; w >= -12; w--) {
      const comp = DB.getCompletionsForWeek(w);
      const done = comp[habitId] || Array(7).fill(false);
      const todayDow = w === 0 ? (new Date().getDay() || 7) - 1 : 6;
      for (let i = todayDow; i >= 0; i--) {
        if (done[i]) streak++;
        else return streak;
      }
    }
    return streak;
  }

  // ── Toggle dot ────────────────────────────────────────────────

  function toggleDot(habitId, dayIndex) {
    DB.toggleCompletion(habitId, weekOffset, dayIndex);
    render();
    // Обновляем шкалу энергии в дневнике если открыт
    if (typeof DayScreen !== 'undefined') DayScreen.refreshHabits();
  }

  // ── Модалка добавления ────────────────────────────────────────

  function openModal() {
    const modal = document.getElementById('hab-modal');
    if (modal) { modal.classList.add('open'); return; }

    const sphereChips = SPHERES.map((s, i) =>
      `<div class="sphere-chip ${i === 0 ? 'selected' : ''}" data-sphere="${s.id}" onclick="HabitsScreen.selectSphere(this)">${s.emoji} ${s.name}</div>`
    ).join('');

    const energyChips = [
      { val: 1, label: '+1', hint: 'чуть-чуть' },
      { val: 3, label: '+3', hint: 'хорошо' },
      { val: 5, label: '+5', hint: 'мощно' },
    ].map((e, i) =>
      `<div class="energy-chip ${i === 1 ? 'selected' : ''}" data-val="${e.val}" onclick="HabitsScreen.selectEnergy(this)">${e.label} <span>${e.hint}</span></div>`
    ).join('');

    const wrap = document.createElement('div');
    wrap.id = 'hab-modal';
    wrap.className = 'modal-bg open';
    wrap.innerHTML = `
      <div class="modal">
        <h3>Новая привычка</h3>
        <label>Название</label>
        <input type="text" id="hab-name-input" placeholder="например: вечерняя прогулка" autocomplete="off">
        <label>Сфера жизни</label>
        <div class="sphere-chips" id="hab-sphere-chips">${sphereChips}</div>
        <label>Энергия за выполнение</label>
        <div class="energy-chips" id="hab-energy-chips">${energyChips}</div>
        <button class="modal-btn" onclick="HabitsScreen.saveHabit()">Добавить</button>
      </div>`;
    wrap.addEventListener('click', e => { if (e.target === wrap) closeModal(); });
    document.body.appendChild(wrap);
    setTimeout(() => document.getElementById('hab-name-input').focus(), 100);
  }

  function closeModal() {
    const modal = document.getElementById('hab-modal');
    if (modal) modal.remove();
  }

  function selectSphere(el) {
    document.querySelectorAll('#hab-sphere-chips .sphere-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  function selectEnergy(el) {
    document.querySelectorAll('#hab-energy-chips .energy-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  function saveHabit() {
    const name = document.getElementById('hab-name-input').value.trim();
    if (!name) { document.getElementById('hab-name-input').focus(); return; }
    const sphereEl = document.querySelector('#hab-sphere-chips .sphere-chip.selected');
    const energyEl = document.querySelector('#hab-energy-chips .energy-chip.selected');
    const sphereId = sphereEl ? sphereEl.dataset.sphere : SPHERES[0].id;
    const energy   = energyEl ? parseInt(energyEl.dataset.val) : 3;
    DB.addHabit({ name, sphereId, energy });
    closeModal();
    render();
  }

  // ── Удаление привычки ─────────────────────────────────────────

  function confirmDelete(habitId) {
    const habit = DB.getHabits().find(h => h.id === habitId);
    if (!habit) return;
    if (!confirm(`Удалить привычку «${habit.name}»?\nВся история отметок сохранится.`)) return;
    DB.deleteHabit(habitId);
    render();
    if (typeof DayScreen !== 'undefined') DayScreen.refreshHabits();
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, render, shiftWeek, toggleDot, openModal, closeModal, selectSphere, selectEnergy, saveHabit, confirmDelete };

})();
