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
    const startDate = meta.startDate ? DB.parseDate(meta.startDate) : new Date();
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + (state.week - 1) * 7 + (state.day - 1));

    const dateStr = dayDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const DAYS_REAL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    const DAYS_SHORT_REAL = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const realDayName = DAYS_REAL[dayDate.getDay()];
    const tasks = DB.getTasks(state.week, state.day);
    const breakdown = DB.getDayBreakdown(state.week, state.day); if(!DB.settings().habits){breakdown.habits=0;breakdown.total=breakdown.tasks;}
    const dayScore = breakdown.total;

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
          const b=DB.getDayBreakdown(state.week,i+1);const s=DB.settings().habits?b.total:b.tasks;
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
        <div class="section-label energy-detail">Дела и события: ${breakdown.tasks > 0 ? "+" : ""}${breakdown.tasks} ${DB.settings().habits?'· Привычки: +'+breakdown.habits:''}</div>
        <div class="section-label">Дела и события</div>
        <div class="task-list" id="task-list">
          ${renderTasks(tasks)}
        </div>
        ${tasks.length < 14 ? `
        <button class="add-task-btn" id="add-task-btn">
          <div class="add-task-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <span class="add-task-text">Добавить запись</span>
        </button>` : ''}

        ${tasks.length < 14 ? '<button type="button" class="library-open" id="task-library">Выбрать из библиотеки</button>' : ''}
        ${DB.settings().habits?renderHabitsSection(DB.localDate(dayDate)):''}
      </div>
    `;

    bindDayEvents();
  }

  function renderTasks(tasks) {
    if (tasks.length === 0) {
      return `<div class="empty-state">Нет записей.<br>Добавьте первую запись.</div>`;
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
        <div class="task-info">
          <div class="task-name" contenteditable="true" data-placeholder="Что происходило?" data-id="${task.id}">${escHtml(task.name)}</div>
          ${DB.SPHERES.some(s=>s.id===task.sphereId) ? '<div class="task-sphere">'+DB.SPHERES.find(s=>s.id===task.sphereId).name+'</div>' : ''}
        </div>
        <div class="score-chip ${chipClass}" data-id="${task.id}">${chipLabel}</div>
      </div>
      ${isSelected ? renderPicker(task) : ''}
      ${isSelected ? `
      <div class="task-delete-row">
        <button class="task-delete-btn" data-delete="${task.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Удалить запись
        </button>
      </div>` : ''}
    `;
  }

  function renderPicker(task) {
    const taskId = task.id;
    return `
      <div class="score-picker" data-picker="${taskId}">
        <label class="picker-label" for="task-sphere-${taskId}">Сфера жизни (необязательно)</label>
        <select class="task-sphere-select" id="task-sphere-${taskId}" data-task="${taskId}">
          <option value="">Без категории</option>
          ${DB.SPHERES.map(s=>`<option value="${s.id}" ${task.sphereId===s.id?'selected':''}>${s.name}</option>`).join('')}
        </select>
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
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      });
    });

    document.querySelectorAll('.task-sphere-select').forEach(el => {
      el.addEventListener('change', () => {
        DB.updateTask(state.week,state.day,Number(el.dataset.task),{sphereId:el.value||null});
        render();
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

    document.getElementById('task-library')?.addEventListener('click',openTaskLibrary);
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

  function openTaskLibrary(){
    if(document.getElementById('task-library-modal'))return;
    const wrap=document.createElement('div');wrap.id='task-library-modal';wrap.className='modal-bg open';
    wrap.innerHTML='<div class="modal"><h3>Библиотека дел и событий</h3><p class="library-hint">Идеи, а не обязательный список.</p><select aria-label="Сфера жизни">'+DB.SPHERES.map(s=>'<option value="'+s.id+'">'+s.emoji+' '+s.name+'</option>').join('')+'</select><div class="library-list"></div><button type="button" class="library-open" id="library-close">Закрыть</button></div>';
    const select=wrap.querySelector('select'),list=wrap.querySelector('.library-list');
    function show(){list.replaceChildren();for(const name of DB.LIBRARY[select.value][1]){const b=document.createElement('button');b.type='button';b.textContent=name+' +';b.onclick=()=>{if(DB.getTasks(state.week,state.day).length>=14)return;const tasks=DB.addTask(state.week,state.day,name,null,select.value);state.selectedTaskId=tasks[tasks.length-1].id;wrap.remove();render();};list.appendChild(b);}}
    select.onchange=show;wrap.querySelector('#library-close').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove();};document.body.appendChild(wrap);show();
  }

  function moveCursorToEnd(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── Привычки в дневнике ───────────────────────────────────────

  function renderHabitsSection(dateStr) {
    const habits = DB.getHabits();
    if (habits.length === 0) return '';

    const comp = DB.getCompletionsForDate(dateStr);

    const SPHERES = Object.fromEntries(DB.SPHERES.map(s=>[s.id,s.emoji]));
    const SPHERE_NAMES = Object.fromEntries(DB.SPHERES.map(s=>[s.id,s.name]));

    const rows = habits.filter(h => comp[h.id] || DB.isHabitEligible(h,dateStr)).map(h => {
      const done = comp[h.id] || false;
      const sphereEmoji = SPHERES[h.sphereId] || '·';
      const sphereName  = SPHERE_NAMES[h.sphereId] || '';
      return `
        <div class="habit-day-row ${done ? 'hab-done' : ''}" data-hab="${h.id}" data-date="${dateStr}">
          <div class="hab-check" ${DB.isHabitEligible(h,dateStr) && dateStr <= DB.localDate() ? `onclick="DayScreen.toggleHabit('${h.id}', '${dateStr}')"` : ''}>
            ${done
              ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
              : ''}
          </div>
          <div class="hab-info">
            <span class="hab-name">${escHtml(h.name)}</span>
            <span class="hab-sphere">${sphereEmoji} ${sphereName}</span>
          </div>
          <span class="hab-weight ${done ? 'hw-done' : ''}">+${h.energy}</span>
        </div>`;
    }).join('');

    return `
      <div class="section-label" style="margin-top:20px">
        Привычки
        <a class="to-habits-link" onclick="App.navigateTo('habits')">все →</a>
      </div>
      <div class="habits-day-list" id="habits-day-list">${rows}</div>`;
  }

  function toggleHabit(habitId, dateStr) {
    DB.toggleCompletionByDate(habitId, dateStr);
    render();
  }

  // Вызывается из HabitsScreen при изменении привычки
  function refreshHabits() {
    render();
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, initToday, getState: () => state, toggleHabit, refreshHabits };

})();
