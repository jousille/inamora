// ── week.js — экран итогов недели ────────────────────────────

const WeekScreen = (() => {

  const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const DAYS_FULL  = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

  const WEEK_QUESTIONS = [
    { key: 'patterns',  q: 'Какие закономерности я заметила на этой неделе?' },
    { key: 'bestTime',  q: 'В какое время дня было больше всего энергии?' },
    { key: 'worstTime', q: 'Когда чаще всего ощущался спад?' },
    { key: 'change',    q: 'Что хочу изменить на следующей неделе?' },
  ];

  let state = { week: 1, highlightDay: null };

  function render() {
    const el = document.getElementById('screen-week');

    const p=MonthScreen.period(state.week,state.week);
    const weekScore = DB.getWeekScore(state.week);
    const dayScores = Array.from({ length: 7 }, (_, i) => DB.getDayScore(state.week, i + 1));
    const maxAbs = Math.max(1, ...dayScores.map(Math.abs));

    const bestDayIdx  = dayScores.indexOf(Math.max(...dayScores));
    const worstDayIdx = dayScores.indexOf(Math.min(...dayScores));

    const vampires = DB.getActiveSources(state.week,state.week,'min');
    const donors   = DB.getActiveSources(state.week,state.week,'max');
    const refl     = DB.getReflection('week', state.week);

    const scoreDisp = weekScore > 0 ? `+${weekScore}` : `${weekScore}`;

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Итоги</div>
        <div class="title">Неделя ${state.week}</div>
        <div class="subtitle">${weekDateRange(state.week)}</div>
      </div>

      <div class="strip" id="week-strip">
        ${[1,2,3,4].map(w => {
          const s = DB.getWeekScore(w);
          const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : '';
          const lbl = s > 0 ? `+${s}` : s === 0 ? '·' : `${s}`;
          return `<button class="strip-pill ${w === state.week ? 'active' : ''}" data-week="${w}">
            <span class="p-name">Нед ${w}</span>
            <span class="p-score ${cls}">${lbl}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="page-content">

        <div ${DB.settings().energy?'':'hidden'}>
        <div class="section-label">Энергия недели</div>
        ${MonthScreen.balance(p)}
        <div class="section-label">Как прошла неделя</div>
        ${MonthScreen.chart(Array.from({length:7},(_,i)=>DB.dateForDay(state.week,i+1)>DB.localDate()?undefined:(p.days.find(d=>d.d===i+1)?.total??null)),Array.from({length:7},(_,i)=>DB.parseDate(DB.dateForDay(state.week,i+1)).toLocaleDateString('ru-RU',{weekday:'short'})))}
        ${vampires.length?'<div class="section-label">Что истощало</div>'+renderVD(vampires,'neg','Забирали энергию'):''}
        ${donors.length?'<div class="section-label">Что наполняло</div>'+renderVD(donors,'pos','Давали энергию'):''}

        </div>
        <div ${DB.settings().habits?'':'hidden'}>
        <div class="section-label">Мои привычки</div>
        ${MonthScreen.habitsReview(p)}
        </div>
        <div ${DB.settings().energy&&DB.settings().spheres&&DB.settings().tasks&&DB.settings().habits?'':'hidden'}>
        <details class="review-card"><summary>Подробнее по сферам жизни</summary>${MonthScreen.renderSphereEnergy(DB.getSphereEnergy(state.week,state.week),true)}</details>
        </div>
        <div ${DB.settings().energy?'':'hidden'}>
        <div class="section-label">Наблюдения недели</div>
        <div class="review-card">${observations(p,donors,vampires)}</div>
        </div>
        <div ${DB.settings().reflection?'':'hidden'}>
        <div class="section-label">Заметка недели · необязательно</div>
        <div class="reflection-card"><textarea class="ref-input" data-key="note" placeholder="Что хочется запомнить об этой неделе?">${escHtml(refl.note||'')}</textarea></div>
        ${WEEK_QUESTIONS.some(q=>refl[q.key])?'<details class="review-card"><summary>Предыдущие ответы</summary>'+WEEK_QUESTIONS.filter(q=>refl[q.key]).map(q=>'<div class="ref-q">'+q.q+'</div><textarea class="ref-input" data-key="'+q.key+'">'+escHtml(refl[q.key])+'</textarea>').join('')+'</details>':''}
        </div>

      </div>
    `;

    bindWeekEvents();
  }

  function observations(p,donors,vampires){
    const lines=[];
    if(state.week>1){const prev=MonthScreen.period(state.week-1,state.week-1);if(p.days.length>=3&&prev.days.length===p.days.length&&p.dates.length===prev.dates.length){const delta=p.total-prev.total;lines.push('Баланс энергии относительно предыдущей недели: '+MonthScreen.fmt(delta)+' баллов.');}}
    if(p.days.length>=2&&donors.length)lines.push('Главный источник положительной энергии: '+escHtml(donors[0].name)+' ('+MonthScreen.fmt(donors[0].score)+').');
    if(p.days.length>=2&&vampires.length)lines.push('Наибольшая потеря энергии: '+escHtml(vampires[0].name)+' ('+MonthScreen.fmt(vampires[0].score)+').');
    return lines.length?lines.map(x=>'<p>'+x+'</p>').join(''):'<p>Наблюдения появятся, когда будет больше оценок энергии.</p>';
  }
  function renderVD(items, type, title) {
    const icon = type === 'neg'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/><line x1="3" y1="3" x2="21" y2="21" style="display:${type==='neg'?'block':'none'}"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

    if (!items.length) {
      return `<div class="empty-state" style="padding:16px">Данных пока нет − заполните дни недели</div>`;
    }

    return `
      <div class="vd-card">
        <div class="vd-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${type === 'neg' ? 'var(--accent)' : 'var(--pos-5-tx)'}" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span>${title}</span>
        </div>
        ${items.map((item, i) => `
          <div class="vd-row">
            <span class="vd-num">${i + 1}</span>
            <span class="vd-name">${escHtml(item.name)}</span>
            <span class="vd-chip ${item.score === 10 ? 'pos10' : type}">${item.score > 0 ? '+' : ''}${item.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindWeekEvents() {
    // Переключение недели
    document.querySelectorAll('#week-strip .strip-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.week = parseInt(btn.dataset.week);
        render();
      });
    });

    // Автосохранение рефлексии
    document.querySelectorAll('.ref-input[data-key]').forEach(ta => {
      ta.addEventListener('input', () => {
        const refl = DB.getReflection('week', state.week);
        refl[ta.dataset.key] = ta.value;
        DB.saveReflection(refl, 'week', state.week);
      });
    });
  }

  function weekDateRange(week) {
    const meta = DB.getMeta();
    const start = meta.startDate ? DB.parseDate(meta.startDate) : new Date();
    const from = new Date(start);
    from.setDate(start.getDate() + (week - 1) * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    const fmt = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return `${fmt(from)} − ${fmt(to)}`;
  }

  function countTasks(week) {
    let n = 0;
    for (let d = 1; d <= 7; d++) n += DB.getTasks(week, d).length;
    return n;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, getState: () => state };

})();
