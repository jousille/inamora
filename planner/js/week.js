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

  async function render() {
    const el = document.getElementById('screen-week');

    const weekScore = await DB.getWeekScore(state.week);
    const dayScores = Array.from({ length: 7 }, (_, i) => await DB.getDayScore(state.week, i + 1));
    const maxAbs = Math.max(1, ...dayScores.map(Math.abs));

    const bestDayIdx  = dayScores.indexOf(Math.max(...dayScores));
    const worstDayIdx = dayScores.indexOf(Math.min(...dayScores));

    const vampires = await DB.getWeekVampires(state.week, 5);
    const donors   = await DB.getWeekDonors(state.week, 5);
    const refl     = await DB.getReflection('week', state.week);

    const scoreDisp = weekScore > 0 ? `+${weekScore}` : `${weekScore}`;

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Итоги</div>
        <div class="title">Неделя ${state.week}</div>
        <div class="subtitle">${weekDateRange(state.week)}</div>
      </div>

      <div class="strip" id="week-strip">
        ${[1,2,3,4].map(w => {
          const s = await DB.getWeekScore(w);
          const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : '';
          const lbl = s > 0 ? `+${s}` : s === 0 ? '·' : `${s}`;
          return `<button class="strip-pill ${w === state.week ? 'active' : ''}" data-week="${w}">
            <span class="p-name">Нед ${w}</span>
            <span class="p-score ${cls}">${lbl}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="page-content">

        <div class="section-label">Общая картина</div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="sc-label">Баланс недели</div>
            <div class="sc-value ${weekScore >= 0 ? 'pos' : 'neg'}">${scoreDisp}</div>
            <div class="sc-sub">${countTasks(state.week)} дел записано</div>
          </div>
          <div class="stat-card">
            <div class="sc-label">Лучший день</div>
            <div class="sc-value" style="font-size:18px; padding-top:4px">${DAYS_SHORT[bestDayIdx]}</div>
            <div class="sc-sub">${dayScores[bestDayIdx] > 0 ? '+' : ''}${dayScores[bestDayIdx]} энергии</div>
          </div>
        </div>

        <div class="bar-chart">
          <div class="bc-label">Энергия по дням</div>
          <div class="bc-bars">
            ${dayScores.map((s, i) => {
              const pct = maxAbs > 0 ? Math.round((Math.abs(s) / maxAbs) * 100) : 0;
              const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : 'zero';
              const hi  = state.highlightDay === i + 1 ? 'hi' : '';
              return `<div class="bc-col">
                <div class="bc-outer"><div class="bc-bar ${cls} ${hi}" style="height:${pct}%"></div></div>
                <span class="bc-day">${DAYS_SHORT[i]}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="section-label">Вампиры недели</div>
        ${renderVD(vampires, 'neg', 'Забирали энергию')}

        <div class="section-label">Доноры недели</div>
        ${renderVD(donors, 'pos', 'Давали энергию')}

        <div class="section-label">Рефлексия</div>
        ${WEEK_QUESTIONS.map(({ key, q }) => `
          <div class="reflection-card">
            <div class="ref-q">${q}</div>
            <textarea class="ref-input" data-key="${key}" placeholder="Напишите своё наблюдение...">${refl[key] || ''}</textarea>
          </div>
        `).join('')}

      </div>
    `;

    bindWeekEvents();
  }

  function renderVD(items, type, title) {
    const icon = type === 'neg'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/><line x1="3" y1="3" x2="21" y2="21" style="display:${type==='neg'?'block':'none'}"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

    if (!items.length) {
      return `<div class="empty-state" style="padding:16px">Данных пока нет — заполните дни недели</div>`;
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
            <span class="vd-chip ${item.score === 10 ? 'pos10' : item.score === -10 ? 'neg' : type}">${item.score > 0 ? '+' : ''}${item.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindWeekEvents() {
    // Переключение недели
    document.querySelectorAll('#week-strip .strip-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        state.week = parseInt(btn.dataset.week);
        render();
      });
    });

    // Автосохранение рефлексии
    document.querySelectorAll('.ref-input[data-key]').forEach(ta => {
      ta.addEventListener('input', async () => {
        const refl = await DB.getReflection('week', state.week);
        refl[ta.dataset.key] = ta.value;
        await DB.saveReflection(refl, 'week', state.week);
      });
    });
  }

  function weekDateRange(week) {
    const meta = DB.getMeta();
    const start = meta.startDate ? new Date(meta.startDate) : new Date();
    const from = new Date(start);
    from.setDate(start.getDate() + (week - 1) * 7);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    const fmt = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return `${fmt(from)} — ${fmt(to)}`;
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
