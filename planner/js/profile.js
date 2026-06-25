// ── profile.js — профиль + инструкция + архив + новый месяц ──

const ProfileScreen = (() => {

  let _tab = 'profile'; // 'profile' | 'guide' | 'archive'

  function render() {
    const el = document.getElementById('screen-profile');
    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">inamora.ru</div>
        <div class="title">${_tab === 'guide' ? 'Инструкция' : _tab === 'archive' ? 'Архив' : 'Профиль'}</div>
      </div>
      <div class="profile-tabs">
        <button class="ptab ${_tab === 'profile' ? 'active' : ''}" data-tab="profile">Профиль</button>
        <button class="ptab ${_tab === 'guide'   ? 'active' : ''}" data-tab="guide">Инструкция</button>
        <button class="ptab ${_tab === 'archive' ? 'active' : ''}" data-tab="archive">Архив</button>
      </div>
      <div id="profile-tab-content"></div>
    `;

    el.querySelectorAll('.ptab').forEach(btn => {
      btn.addEventListener('click', () => {
        _tab = btn.dataset.tab;
        render();
      });
    });

    switch (_tab) {
      case 'profile': renderProfile(); break;
      case 'guide':   renderGuide();   break;
      case 'archive': renderArchive(); break;
    }
  }

  // ── Вкладка: Профиль ─────────────────────────────────────────

  function renderProfile() {
    const meta   = DB.getMeta();
    const token  = DB.getToken();
    const pos    = DB.getTodayPosition();
    const monthN = (meta.currentMonth || 0) + 1;

    const startDate = meta.startDate
      ? new Date(meta.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'не задана';

    let totalTasks = 0;
    for (let w = 1; w <= 4; w++)
      for (let d = 1; d <= 7; d++)
        totalTasks += DB.getTasks(w, d).length;

    const content = document.getElementById('profile-tab-content');
    content.innerHTML = `
      <div class="profile-section">

        <div class="section-label">Текущий месяц</div>
        <div class="profile-row">
          <span class="pr-label">Месяц</span>
          <span class="pr-value">${monthN}</span>
        </div>
        <div class="profile-row">
          <span class="pr-label">Начало</span>
          <span class="pr-value">${startDate}</span>
        </div>
        <div class="profile-row">
          <span class="pr-label">Дел записано</span>
          <span class="pr-value">${totalTasks}</span>
        </div>
        <div class="profile-row">
          <span class="pr-label">Сейчас</span>
          <span class="pr-value">Нед ${pos.week}, День ${pos.day}</span>
        </div>

        <div class="section-label" style="margin-top:20px">Дата начала месяца</div>
        <div class="reflection-card">
          <div class="ref-q">С какой даты начинается ваш месяц?</div>
          <input type="date" class="ref-input" id="start-date-input"
            value="${meta.startDate || ''}"
            style="min-height:auto; padding:10px;">
        </div>

        ${pos.isFinished ? `
        <div class="new-month-banner">
          <div class="nmb-title">🎉 Месяц завершён!</div>
          <div class="nmb-desc">Результаты сохранены в архиве. Готовы начать новый месяц?</div>
          <input type="date" class="ref-input" id="new-month-date"
            value="${new Date().toISOString().split('T')[0]}"
            style="min-height:auto; padding:10px; margin:10px 0;">
          <button class="new-month-btn" id="start-new-month-btn">Начать новый месяц →</button>
        </div>
        ` : ''}

        <div class="section-label" style="margin-top:20px">Данные</div>
        <div class="data-actions">
          <button class="data-btn export" id="export-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Сохранить резервную копию
          </button>
          <button class="data-btn import" id="import-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Восстановить из копии
          </button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none">
        <div id="import-status" style="font-size:12px; color:var(--mid-dk); text-align:center; min-height:16px; margin-top:4px;"></div>

        <div class="section-label" style="margin-top:20px">Аккаунт</div>
        <div class="profile-row">
          <span class="pr-label">Код доступа</span>
          <span class="pr-value">${token || '—'}</span>
        </div>

        <a href="https://inamora.ru" style="display:block; text-align:center; margin-top:16px; font-size:12px; color:var(--accent); text-decoration:none; opacity:.7;">© Юля Инамора | inamora.ru</a>

        <button class="logout-btn" id="logout-btn">Выйти из планера</button>

      </div>
    `;

    document.getElementById('start-date-input').addEventListener('change', e => {
      DB.setMeta({ startDate: e.target.value });
      DayScreen.initToday();
    });

    const newMonthBtn = document.getElementById('start-new-month-btn');
    if (newMonthBtn) {
      newMonthBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('new-month-date');
        const newDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        if (confirm(`Начать новый месяц с ${new Date(newDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}?\n\nТекущий месяц сохранится в архиве.`)) {
          DB.startNewMonth(newDate);
          DayScreen.initToday();
          App.navigateTo('day');
        }
      });
    }

    document.getElementById('export-btn').addEventListener('click', () => {
      exportData();
    });

    document.getElementById('import-btn').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          importData(ev.target.result);
          document.getElementById('import-status').textContent = '✓ Данные восстановлены';
          document.getElementById('import-status').style.color = 'var(--pos-5-tx)';
          setTimeout(() => render(), 1200);
        } catch (err) {
          document.getElementById('import-status').textContent = '✗ Ошибка файла — проверьте формат';
          document.getElementById('import-status').style.color = 'var(--neg-10-tx)';
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      if (confirm('Выйти? Все данные сохранятся на этом устройстве.')) {
        Auth.logout();
        App.showAuth();
      }
    });
  }

  // ── Вкладка: Инструкция ──────────────────────────────────────

  function renderGuide() {
    const content = document.getElementById('profile-tab-content');
    content.innerHTML = `
      <div class="profile-section">

        <div class="guide-hero">
          <div class="guide-hero-title">Планер<br>энергетического<br>баланса</div>
          <div class="guide-hero-sub">Юля Инамора · inamora.ru</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">01</div>
          <div class="guide-step-title">Что это такое?</div>
          <div class="guide-step-text">Планер помогает отслеживать, какие дела забирают вашу энергию, а какие восполняют. За месяц вы увидите закономерности и сможете осознанно управлять своим ресурсом.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">02</div>
          <div class="guide-step-title">Шкала энергии</div>
          <div class="guide-step-text">После каждого дела оцените как оно повлияло на вашу энергию:</div>
          <div class="guide-scores">
            <div class="gs-row"><span class="gs-chip chip-n10">−10</span><span class="gs-label">Полностью опустошило</span></div>
            <div class="gs-row"><span class="gs-chip chip-n5">−5</span><span class="gs-label">Заметно истощило</span></div>
            <div class="gs-row"><span class="gs-chip chip-n3">−3</span><span class="gs-label">Немного забрало</span></div>
            <div class="gs-row"><span class="gs-chip chip-0">0</span><span class="gs-label">Нейтрально</span></div>
            <div class="gs-row"><span class="gs-chip chip-p3">+3</span><span class="gs-label">Немного восполнило</span></div>
            <div class="gs-row"><span class="gs-chip chip-p5">+5</span><span class="gs-label">Хорошо зарядило</span></div>
          </div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">03</div>
          <div class="guide-step-title">Как заполнять</div>
          <div class="guide-step-text">Каждый день записывайте дела которые занимали ваше время и внимание — встречи, задачи, активности, бытовые дела. Не обязательно всё, только значимое. Оценивайте честно — не как «должно быть», а как было на самом деле.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">04</div>
          <div class="guide-step-title">Итоги недели</div>
          <div class="guide-step-text">Раздел «Неделя» автоматически показывает топ вампиров и доноров за 7 дней. Ответьте на вопросы рефлексии — это помогает увидеть паттерны.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">05</div>
          <div class="guide-step-title">Итоги месяца</div>
          <div class="guide-step-text">После 4 недель раздел «Месяц» покажет главных вампиров и доноров за весь месяц. Это основа для изменений — что убрать, что добавить, как выстроить день под свою энергию.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">06</div>
          <div class="guide-step-title">Новый месяц</div>
          <div class="guide-step-text">Когда месяц закончится, перейдите в Профиль и нажмите «Начать новый месяц». Старые данные сохранятся в Архиве — вы всегда сможете вернуться к ним.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">07</div>
          <div class="guide-step-title">Резервная копия</div>
          <div class="guide-step-text">Данные хранятся на вашем телефоне. При очистке кэша браузера или смене устройства они удалятся. Чтобы не потерять записи — регулярно сохраняйте резервную копию: Профиль → «Сохранить резервную копию». Файл сохранится на телефон — загрузите его в iCloud или Google Drive. Для восстановления нажмите «Восстановить из копии» и выберите файл.</div>
        </div>

      </div>
    `;
  }

  // ── Вкладка: Архив ───────────────────────────────────────────

  function renderArchive() {
    const archive = DB.getArchiveList();
    const content = document.getElementById('profile-tab-content');

    if (!archive.length) {
      content.innerHTML = `
        <div class="profile-section">
          <div class="empty-state" style="padding:40px 16px">
            Архив пока пуст.<br>Завершите первый месяц —<br>он появится здесь.
          </div>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="profile-section">
        <div class="section-label">Прошлые месяцы</div>
        ${archive.map(m => {
          const startStr = m.startDate
            ? new Date(m.startDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
            : `Месяц ${m.index + 1}`;
          const monthScore = [1,2,3,4].reduce((s, w) => s + DB.getWeekScore(w, m.index), 0);
          const scoreDisp = monthScore > 0 ? `+${monthScore}` : `${monthScore}`;
          const scoreCls  = monthScore >= 0 ? 'pos' : 'neg';
          return `
            <div class="archive-card" data-month="${m.index}">
              <div class="ac-left">
                <div class="ac-title">${capitalize(startStr)}</div>
                <div class="ac-sub">Месяц ${m.index + 1}</div>
              </div>
              <div class="ac-score ${scoreCls}">${scoreDisp}</div>
              <svg class="ac-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          `;
        }).join('')}
      </div>
    `;

    content.querySelectorAll('.archive-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.month);
        showArchiveMonth(idx);
      });
    });
  }

  function showArchiveMonth(monthIdx) {
    const m = DB.getMonthMeta(monthIdx);
    const startStr = m.startDate
      ? new Date(m.startDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
      : `Месяц ${monthIdx + 1}`;

    const weekScores = [1,2,3,4].map(w => DB.getWeekScore(w, monthIdx));
    const monthScore = weekScores.reduce((s, v) => s + v, 0);
    const scoreDisp  = monthScore > 0 ? `+${monthScore}` : `${monthScore}`;
    const vampires   = DB.getMonthVampires(5, monthIdx);
    const donors     = DB.getMonthDonors(5, monthIdx);

    const content = document.getElementById('profile-tab-content');
    content.innerHTML = `
      <div class="profile-section">
        <button class="back-btn" id="archive-back">← Назад к архиву</button>

        <div class="section-label">${capitalize(startStr)}</div>

        <div class="stat-grid">
          <div class="stat-card">
            <div class="sc-label">Итог месяца</div>
            <div class="sc-value ${monthScore >= 0 ? 'pos' : 'neg'}">${scoreDisp}</div>
          </div>
          ${weekScores.map((s, i) => `
            <div class="stat-card">
              <div class="sc-label">Неделя ${i + 1}</div>
              <div class="sc-value ${s >= 0 ? 'pos' : 'neg'}" style="font-size:20px">${s > 0 ? '+' : ''}${s}</div>
            </div>
          `).join('')}
        </div>

        <div class="section-label">Вампиры</div>
        ${renderArchiveVD(vampires, 'neg')}

        <div class="section-label">Доноры</div>
        ${renderArchiveVD(donors, 'pos')}
      </div>
    `;

    document.getElementById('archive-back').addEventListener('click', () => {
      renderArchive();
    });
  }

  function renderArchiveVD(items, type) {
    if (!items.length) return `<div class="empty-state" style="padding:12px">Нет данных</div>`;
    return `
      <div class="vd-card">
        ${items.map((item, i) => `
          <div class="vd-row">
            <span class="vd-num">${i + 1}</span>
            <span class="vd-name">${escHtml(item.name)}</span>
            <span class="vd-chip ${type}">${item.score > 0 ? '+' : ''}${item.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Экспорт / Импорт ─────────────────────────────────────────

  function exportData() {
    const token = DB.getToken();
    const prefix = `planer_${token}_`;
    const backup = { version: 1, token, exportedAt: new Date().toISOString(), data: {} };

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        backup.data[k] = localStorage.getItem(k);
      }
    }

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `planer-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(jsonStr) {
    const backup = JSON.parse(jsonStr);
    if (!backup.data || backup.version !== 1) throw new Error('Invalid format');
    Object.entries(backup.data).forEach(([k, v]) => localStorage.setItem(k, v));
    DayScreen.initToday();
  }

  function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
  function escHtml(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render };

})();
