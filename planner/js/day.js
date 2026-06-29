// ── day.js — экран дневного листа ────────────────────────────

const DayScreen = (() => {

  const SCORES = [-10, -5, -3, 0, 3, 5, 10];
  const SCORE_LABELS  = { '-10':'−10', '-5':'−5', '-3':'−3', '0':'0', '3':'+3', '5':'+5', '10':'+10' };
  const SCORE_CLASSES = { '-10':'chip-n10', '-5':'chip-n5', '-3':'chip-n3', '0':'chip-0', '3':'chip-p3', '5':'chip-p5', '10':'chip-p10' };
  const DAYS_RU    = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
  const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  let state = { week: 1, day: 1, selectedTaskId: null };

  // Инициализируем позицию по сегодняшней дате
  function initToday() {
    const pos = DB.getTodayPosition();
    state.week = pos.week;
    state.day  = pos.day;
    state.selectedTaskId = null;
  }

  function render() {
    const el = document.getElementById('screen-day');
    const meta = DB.getMeta();
    const startDate = meta.startDate ? new Date(meta.startDate) : new Date();
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + (state.week - 1) * 7 + (state.day - 1));

    const dateStr = dayDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const DAYS_REAL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    const DAYS_SHORT_REAL = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const realDayName = DAYS_REAL[dayDate.getDay()];
    const tasks = DB.getTasks(state.week, state.day);
    const dayScore = DB.getDayScore(state.week, state.day);

    const maxAbs = 50;
    const fillPct = Math.min(100, Math.max(0, ((dayScore + maxAbs) / (maxAbs * 2)) * 100));
    const scoreDisplay = dayScore > 0 ? `+${dayScore}` : `${dayScore}`;

    el.innerHTML = `
      <div class="page-header">
        <div class="week-nav">
          <button class="week-arrow" id="week-prev" ${state.week === 1 ? 'disabled' : ''}>‹</button>
          <span class="week-nav-label">Неделя ${state.week}</span>
          <button class="week-arrow" id="week-next" ${state.week === 4 ? 'disabled' : ''}>›</button>
        </div>
        <div class="title">${realDayName}</div>
        <div class="subtitle">${dateStr}</div>
      </div>

      <div class="strip" id="day-strip">
        ${Array.from({length: 7}, (_, i) => {
          const pillDate = new Date(startDate);
          pillDate.setDate(startDate.getDate() + (state.week - 1) * 7 + i);
          const pillDay = DAYS_SHORT_REAL[pillDate.getDay()];
          const s = DB.getDayScore(state.week, i + 1);
          const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : '';
          const lbl = s > 0 ? `+${s}` : s === 0 ? '·' : `${s}`;
          return `<button class="strip-pill ${i + 1 === state.day ? 'active' : ''}" data-day="${i + 1}">
            <span class="p-name">${pillDay}</span>
            <span class="p-score ${cls}">${lbl}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="energy-strip">
        <span class="es-label">Энергия дня</span>
        <div class="energy-track">
          <div class="energy-fill" style="width:${fillPct}%"></div>
        </div>
        <span class="energy-score">${scoreDisplay}</span>
      </div>

      <div class="page-content">
        <div class="section-label">Дела дня</div>
        <div class="task-list" id="task-list">
          ${renderTasks(tasks)}
        </div>
        ${tasks.length < 14 ? `
        <button class="add-task-btn" id="add-task-btn">
          <div class="add-task-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span class="add-task-text">Добавить дело</span>
        </button>` : ''}
      </div>
    `;

    bindDayEvents();
  }

  function renderTasks(tasks) {
    if (tasks.length === 0) {
      return `<div class="empty-state">Нет записей.<br>Добавьте первое дело дня.</div>`;
    }
    return tasks.map(t => renderTaskRow(t)).join('');
  }

  function renderTaskRow(task) {
    const isSelected = state.selectedTaskId === task.id;
    const chipClass = task.score !== null && task.score !== undefined
      ? (SCORE_CLASSES[task.score] || 'chip-empty') : 'chip-empty';
    const chipLabel = task.score !== null && task.score !== undefined
      ? (SCORE_LABELS[task.score] || '?') : '?';

    return `
      <div class="task-row ${isSelected ? 'selected' : ''}" data-id="${task.id}">
        <div class="task-name" contenteditable="true" data-placeholder="Название дела" data-id="${task.id}">${escHtml(task.name)}</div>
        <div class="score-chip ${chipClass}" data-id="${task.id}">${chipLabel}</div>
      </div>
      ${isSelected ? renderPicker(task.id) : ''}
      ${isSelected ? `
      <div class="task-delete-row">
        <button class="task-delete-btn" data-delete="${task.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Удалить дело
        </button>
      </div>` : ''}
    `;
  }

  function renderPicker(taskId) {
    return `
      <div class="score-picker" data-picker="${taskId}">
        <div class="picker-label">Оценка энергии</div>
        <div class="picker-opts">
          ${SCORES.map(s => `
            <button class="picker-opt v${s < 0 ? s : s > 0 ? s : '0'}" data-score="${s}" data-task="${taskId}">
              ${SCORE_LABELS[s]}
            </button>`).join('')}
        </div>
      </div>
    `;
  }

  function bindDayEvents() {
    // Переключение недели стрелками
    const prevBtn = document.getElementById('week-prev');
    const nextBtn = document.getElementById('week-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      state.week = Math.max(1, state.week - 1);
      state.selectedTaskId = null;
      render();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      state.week = Math.min(4, state.week + 1);
      state.selectedTaskId = null;
      render();
    });

    // Переключение дней
    document.querySelectorAll('#day-strip .strip-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.day = parseInt(btn.dataset.day);
        state.selectedTaskId = null;
        render();
      });
    });

    // Выбор задачи → открыть пикер
    document.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.classList.contains('task-name')) return;
        const id = parseInt(row.dataset.id);
        state.selectedTaskId = state.selectedTaskId === id ? null : id;
        render();
      });
    });

    // Редактирование названия
    document.querySelectorAll('.task-name[contenteditable]').forEach(el => {
      el.addEventListener('blur', () => {
        const id = parseInt(el.dataset.id);
        DB.updateTask(state.week, state.day, id, { name: el.textContent.trim() });
        render();
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      });
    });

    // Оценка энергии
    document.querySelectorAll('.picker-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const score = parseInt(btn.dataset.score);
        const taskId = parseInt(btn.dataset.task);
        DB.updateTask(state.week, state.day, taskId, { score });
        state.selectedTaskId = null;
        render();
      });
    });

    // Удалить задачу
    document.querySelectorAll('.task-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.delete);
        DB.deleteTask(state.week, state.day, id);
        state.selectedTaskId = null;
        render();
      });
    });

    // Добавить задачу
    const addBtn = document.getElementById('add-task-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        DB.addTask(state.week, state.day, '', null);
        const tasks = DB.getTasks(state.week, state.day);
        state.selectedTaskId = tasks[tasks.length - 1].id;
        render();
        setTimeout(() => {
          const els = document.querySelectorAll('.task-name[contenteditable]');
          const last = els[els.length - 1];
          if (last) { last.focus(); moveCursorToEnd(last); }
        }, 50);
      });
    }
  }

  function moveCursorToEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, initToday, getState: () => state };

})();
