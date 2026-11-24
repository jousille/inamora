// ── month.js — экран итогов месяца ───────────────────────────

const MonthScreen = (() => {

  const MONTH_QUESTIONS = [
    { key: 'discovery',  q: 'Главное открытие месяца об энергии' },
    { key: 'bestTime',   q: 'В какое время дня было больше всего энергии?' },
    { key: 'recovery',   q: 'Что лучше всего восстанавливает тебя?' },
    { key: 'change',     q: 'Что изменю в следующем месяце?' },
    { key: 'gratitude',  q: 'За что я благодарна себе в этом месяце?' },
  ];

  const SPHERES = [
    { id: 'energy', emoji: '🔥', name: 'Энергия и тело' },
    { id: 'self',   emoji: '💛', name: 'Я и только я' },
    { id: 'work',   emoji: '💼', name: 'Дело и деньги' },
    { id: 'love',   emoji: '💞', name: 'Отношения' },
    { id: 'home',   emoji: '🏡', name: 'Пространство' },
    { id: 'growth', emoji: '🌱', name: 'Саморазвитие' },
    { id: 'values', emoji: '✨', name: 'Ценности' },
  ];

  // Цвета секторов — тёплая палитра в тоне приложения
  const SPHERE_COLORS = [
    '#C97B7B', '#D4A56A', '#B8C46A', '#6AB8A5',
    '#6A8BB8', '#9B6AB8', '#B86A9B',
  ];

  function renderWheel(stats) {
    const N = SPHERES.length;
    const cx = 110, cy = 110, R = 90, r = 36; // внешний и внутренний радиус
    const angleStep = (2 * Math.PI) / N;
    const startAngle = -Math.PI / 2; // начинаем сверху

    let sectors = '';
    let labels  = '';

    SPHERES.forEach((sphere, i) => {
      const pct   = (stats[sphere.id]?.pct ?? 0) / 100;
      const rFill = r + (R - r) * Math.max(0.04, pct); // минимум чуть виден

      const a1 = startAngle + i * angleStep;
      const a2 = startAngle + (i + 1) * angleStep - 0.04; // небольшой gap
      const color = SPHERE_COLORS[i];

      // Сектор кольца: внешняя дуга + внутренняя дуга (donut)
      const x1o = cx + R    * Math.cos(a1), y1o = cy + R    * Math.sin(a1);
      const x2o = cx + R    * Math.cos(a2), y2o = cy + R    * Math.sin(a2);
      const x1i = cx + r    * Math.cos(a2), y1i = cy + r    * Math.sin(a2);
      const x2i = cx + r    * Math.cos(a1), y2i = cy + r    * Math.sin(a1);

      // Заполненная часть
      const x1f = cx + rFill * Math.cos(a1), y1f = cy + rFill * Math.sin(a1);
      const x2f = cx + rFill * Math.cos(a2), y2f = cy + rFill * Math.sin(a2);

      const large = (a2 - a1) > Math.PI ? 1 : 0;

      // Фоновый сектор (пустой)
      sectors += `<path d="M${x1o},${y1o} A${R},${R} 0 ${large},1 ${x2o},${y2o} L${x1i},${y1i} A${r},${r} 0 ${large},0 ${x2i},${y2i} Z"
        fill="${color}" opacity="0.15"/>`;

      // Заполненный сектор
      sectors += `<path d="M${x1f},${y1f} A${rFill},${rFill} 0 ${large},1 ${x2f},${y2f} L${x1i},${y1i} A${r},${r} 0 ${large},0 ${x2i},${y2i} Z"
        fill="${color}" opacity="0.9"/>`;

      // Эмодзи по центру сектора
      const aMid = (a1 + a2) / 2;
      const rLbl = r + (R - r) * 0.5 + (R - r) * 0.35;
      const ex = cx + rLbl * Math.cos(aMid);
      const ey = cy + rLbl * Math.sin(aMid);
      labels += `<text x="${ex.toFixed(1)}" y="${(ey + 5).toFixed(1)}" text-anchor="middle" font-size="14">${sphere.emoji}</text>`;
    });

    return `
      <div class="wheel-wrap">
        <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" class="balance-wheel">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--lighter)" opacity="0.08"/>
          ${sectors}
          ${labels}
          <circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="var(--dark)"/>
        </svg>
      </div>
    `;
  }

  function renderSphereList(stats) {
    return SPHERES.map((s, i) => {
      const st  = stats[s.id] || { done: 0, total: 0, pct: 0 };
      const color = SPHERE_COLORS[i];
      return `
        <div class="sphere-stat-row">
          <span class="ssr-emoji">${s.emoji}</span>
          <div class="ssr-body">
            <div class="ssr-top">
              <span class="ssr-name">${s.name}</span>
              <span class="ssr-pct">${st.pct}%</span>
            </div>
            <div class="ssr-track">
              <div class="ssr-fill" style="width:${st.pct}%; background:${color}"></div>
            </div>
            <div class="ssr-sub">${st.done} из ${st.total} отметок</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function render() {
    const el = document.getElementById('screen-month');

    const weekScores = [1,2,3,4].map(w => DB.getWeekScore(w));
    const monthScore = weekScores.reduce((s, v) => s + v, 0);
    const totalTasks = (() => { let n = 0; for (let w=1;w<=4;w++) for (let d=1;d<=7;d++) n+=DB.getTasks(w,d).length; return n; })();

    const bestWeekIdx  = weekScores.indexOf(Math.max(...weekScores));
    const worstWeekIdx = weekScores.indexOf(Math.min(...weekScores));
    const maxAbs = Math.max(1, ...weekScores.map(Math.abs));

    const vampires   = DB.getMonthVampires(5);
    const donors     = DB.getMonthDonors(5);
    const refl       = DB.getReflection('month');
    const meta       = DB.getMeta();
    const sphereStats = DB.getHabitsSphereStats();

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

        <div class="section-label">Колесо привычек</div>

        ${renderWheel(sphereStats)}
        ${renderSphereList(sphereStats)}

        <div class="section-label" style="margin-top:24px">Баланс месяца</div>

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
      ta.addEventListener('input', () => {
        const r = DB.getReflection('month');
        r[ta.dataset.key] = ta.value;
        DB.saveReflection(r, 'month');
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
            <span class="vd-chip ${item.score === 10 ? 'pos10' : type}">${item.score > 0 ? '+' : ''}${item.score}</span>
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
