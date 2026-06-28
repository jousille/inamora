// ── month.js — экран итогов месяца ───────────────────────────

const MonthScreen = (() => {

  const MONTH_QUESTIONS = [
    { key: 'discovery',  q: 'Главное открытие месяца об энергии' },
    { key: 'bestTime',   q: 'В какое время дня было больше всего энергии?' },
    { key: 'recovery',   q: 'Что лучше всего восстанавливает тебя?' },
    { key: 'change',     q: 'Что изменю в следующем месяце?' },
    { key: 'gratitude',  q: 'За что я благодарна себе в этом месяце?' },
  ];

  async function render() {
    const el = document.getElementById('screen-month');

    const weekScores = [1,2,3,4].map(w => await DB.getWeekScore(w));
    const monthScore = weekScores.reduce((s, v) => s + v, 0);
    const totalTasks = (() => { let n = 0; for (let w=1;w<=4;w++) for (let d=1;d<=7;d++) n+=DB.getTasks(w,d).length; return n; })();

    const bestWeekIdx  = weekScores.indexOf(Math.max(...weekScores));
    const worstWeekIdx = weekScores.indexOf(Math.min(...weekScores));
    const maxAbs = Math.max(1, ...weekScores.map(Math.abs));

    const vampires = await DB.getMonthVampires(5);
    const donors   = await DB.getMonthDonors(5);
    const refl     = await DB.getReflection('month');
    const meta     = DB.getMeta();

    const scoreDisp = monthScore > 0 ? `+${monthScore}` : `${monthScore}`;

    const monthName = (() => {
      const d = meta.startDate ? new Date(meta.startDate) : new Date();
      return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    })();

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Итоги</div>
        <div class="title">${capitalize(monthName)}</div>
        <div class="subtitle">${totalTasks} дел · 4 недели</div>
      </div>

      <div class="strip">
        ${[1,2,3,4].map(w => {
          const s = weekScores[w-1];
          const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : '';
          const lbl = s > 0 ? `+${s}` : s === 0 ? '·' : `${s}`;
          return `<div class="strip-pill">
            <span class="p-name">Нед ${w}</span>
            <span class="p-score ${cls}">${lbl}</span>
          </div>`;
        }).join('')}
      </div>

      <div class="page-content">

        <div class="section-label">Баланс месяца</div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="sc-label">Итог месяца</div>
            <div class="sc-value ${monthScore >= 0 ? 'pos' : 'neg'}">${scoreDisp}</div>
            <div class="sc-sub">${totalTasks} дел записано</div>
          </div>
          <div class="stat-card">
            <div class="sc-label">Дел в среднем</div>
            <div class="sc-value">${totalTasks > 0 ? Math.round(totalTasks / 28) : 0}</div>
            <div class="sc-sub">в день</div>
          </div>
        </div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="sc-label">Лучшая неделя</div>
            <div class="sc-value" style="font-size:18px; padding-top:4px">Нед ${bestWeekIdx + 1}</div>
            <div class="sc-sub">${weekScores[bestWeekIdx] > 0 ? '+' : ''}${weekScores[bestWeekIdx]} энергии</div>
          </div>
          <div class="stat-card">
            <div class="sc-label">Тяжёлая неделя</div>
            <div class="sc-value" style="font-size:18px; padding-top:4px">Нед ${worstWeekIdx + 1}</div>
            <div class="sc-sub">${weekScores[worstWeekIdx] > 0 ? '+' : ''}${weekScores[worstWeekIdx]} энергии</div>
          </div>
        </div>

        <div class="bar-chart">
          <div class="bc-label">Энергия по неделям</div>
          <div class="bc-bars">
            ${weekScores.map((s, i) => {
              const pct = maxAbs > 0 ? Math.round((Math.abs(s) / maxAbs) * 100) : 0;
              const cls = s > 0 ? 'pos' : s < 0 ? 'neg' : 'zero';
              return `<div class="bc-col">
                <div class="bc-outer"><div class="bc-bar ${cls}" style="height:${Math.max(3, pct)}%"></div></div>
                <span class="bc-day">Нед ${i + 1}</span>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="section-label">Главные вампиры месяца</div>
        ${renderVD(vampires, 'neg', 'Забирали энергию чаще всего')}

        <div class="section-label">Главные доноры месяца</div>
        ${renderVD(donors, 'pos', 'Давали энергию чаще всего')}

        <div class="section-label">Выводы о себе</div>
        ${MONTH_QUESTIONS.map(({ key, q }) => `
          <div class="reflection-card">
            <div class="ref-q">${q}</div>
            <textarea class="ref-input" data-key="${key}" placeholder="Ваш вывод...">${refl[key] || ''}</textarea>
          </div>
        `).join('')}

      </div>
    `;

    // Автосохранение рефлексии
    document.querySelectorAll('#screen-month .ref-input[data-key]').forEach(ta => {
      ta.addEventListener('input', async () => {
        const r = await DB.getReflection('month');
        r[ta.dataset.key] = ta.value;
        await DB.saveReflection(r, 'month');
      });
    });
  }

  function renderVD(items, type, title) {
    if (!items.length) {
      return `<div class="empty-state" style="padding:16px">Заполните дни — данные появятся автоматически</div>`;
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

  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render };

})();
