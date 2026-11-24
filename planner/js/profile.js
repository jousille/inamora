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
    const settings=DB.settings();
    const token  = DB.getToken();
    const pos    = DB.getTodayPosition();
    const monthN = (meta.currentMonth || 0) + 1;

    const startDate = meta.startDate
      ? DB.parseDate(meta.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'не задана';

    let totalTasks = 0;
    for (let w = 1; w <= 4; w++)
      for (let d = 1; d <= 7; d++)
        totalTasks += DB.getTasks(w, d).length;

    const content = document.getElementById('profile-tab-content');
    content.innerHTML = `
      <div class="profile-section">

        <div class="section-label">Настройка дневника</div>
        <div class="review-card"><div class="settings-intro"><strong>Выберите, что хотите вести.</strong><span>Отключение не удаляет записи.</span></div>
        ${[['tasks','Дела и события'],['habits','Трекер привычек'],['energy','Учёт энергии'],['spheres','Сферы жизни'],['reflection','Заметки и рефлексия']].map(([k,v])=>'<label class="setting-row"><span>'+v+'</span><input type="checkbox" data-setting="'+k+'" '+(settings[k]?'checked':'')+'></label>').join('')}
        <label class="setting-row"><span>Стартовый экран</span><select id="settings-start">${[['day','Дневник'],['habits','Привычки'],['week','Неделя'],['month','Месяц']].filter(([k])=>k!=='day'||settings.tasks).filter(([k])=>k!=='habits'||settings.habits).map(([k,v])=>'<option value="'+k+'" '+(settings.start===k?'selected':'')+'>'+v+'</option>').join('')}</select></label></div>
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
          <span class="pr-label">Записей за период</span>
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
            value="${DB.localDate()}"
            style="min-height:auto; padding:10px; margin:10px 0;">
          <button class="new-month-btn" id="start-new-month-btn">Начать новый месяц →</button>
        </div>
        ` : ''}

        <div class="section-label" style="margin-top:20px">Данные</div>
        <div class="data-actions">
          <button class="data-btn export" id="export-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Сохранить резервную копию
          </button>
          <button class="data-btn import" id="import-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Восстановить из копии
          </button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none">
        <div id="import-status" style="font-size:12px;color:var(--mid-dk);text-align:center;min-height:16px;margin-top:4px;"></div>

        <div class="section-label" style="margin-top:20px">Аккаунт</div>
        <div class="profile-row">
          <span class="pr-label">Код доступа</span>
          <span class="pr-value">${token || '−'}</span>
        </div>

        <button class="unlink-btn" id="unlink-btn">Отвязать это устройство</button>
        <p class="unlink-hint">Используйте при смене телефона − освободит код для нового устройства</p>

        <a href="https://inamora.ru" style="display:block; text-align:center; margin-top:16px; font-size:12px; color:var(--accent); text-decoration:none; opacity:.7;">© Юля Инамора | inamora.ru</a>

        <button class="logout-btn" id="logout-btn">Выйти из планера</button>

      </div>
    `;

    content.querySelectorAll('[data-setting]').forEach(input=>input.onchange=()=>{const s=DB.settings();s[input.dataset.setting]=input.checked;if(!s.tasks&&!s.habits){input.checked=true;alert('Оставьте хотя бы один раздел для записей.');return;}if(s.start==='day'&&!s.tasks)s.start='habits';if(s.start==='habits'&&!s.habits)s.start='day';DB.setMeta({settings:s});App.refreshNav();renderProfile();});
    content.querySelector('#settings-start').onchange=e=>DB.setMeta({settings:{...DB.settings(),start:e.target.value}});
    document.getElementById('start-date-input').addEventListener('change', e => {
      DB.setMeta({ startDate: e.target.value });
      DayScreen.initToday();
    });

    const newMonthBtn = document.getElementById('start-new-month-btn');
    if (newMonthBtn) {
      newMonthBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('new-month-date');
        const newDate = dateInput ? dateInput.value : DB.localDate();
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
          document.getElementById('import-status').textContent = '✗ Ошибка файла − проверьте формат';
          document.getElementById('import-status').style.color = 'var(--neg-10-tx)';
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('unlink-btn').addEventListener('click', async () => {
      if (!confirm('Отвязать это устройство?\n\nКод доступа освободится − сможете использовать его на новом устройстве. Повторная отвязка возможна не раньше чем через 14 дней.')) return;

      const btn = document.getElementById('unlink-btn');
      btn.disabled = true;
      btn.textContent = 'Отвязываем...';

      const result = await Auth.unlinkDevice();

      if (result.ok) {
        alert('Готово! Устройство отвязано. Теперь можете войти с этим кодом на другом устройстве.');
        Auth.logout();
        App.showAuth();
      } else if (result.reason === 'limit') {
        alert(`Слишком часто. Повторная отвязка возможна через ${result.daysLeft} дн.`);
        btn.disabled = false;
        btn.textContent = 'Отвязать это устройство';
      } else {
        alert('Не удалось отвязать устройство − проверьте интернет.');
        btn.disabled = false;
        btn.textContent = 'Отвязать это устройство';
      }
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
          <div class="guide-hero-title">Дневник энергии<br>и привычек</div>
          <div class="guide-hero-sub">Юля Инамора · inamora.ru</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">01</div>
          <div class="guide-step-title">Что это такое?</div>
          <div class="guide-step-text">Планер помогает отслеживать, какие дела и события забирают вашу энергию, а какие восполняют. За месяц вы увидите закономерности и сможете осознанно управлять своим ресурсом.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">02</div>
          <div class="guide-step-title">Шкала энергии</div>
          <div class="guide-step-text">После каждого дела или события оцените, как оно повлияло на вашу энергию:</div>
          <div class="guide-scores">
            <div class="gs-row"><span class="gs-chip chip-n10">−10</span><span class="gs-label">Полностью опустошило</span></div>
            <div class="gs-row"><span class="gs-chip chip-n5">−5</span><span class="gs-label">Заметно истощило</span></div>
            <div class="gs-row"><span class="gs-chip chip-n3">−3</span><span class="gs-label">Немного забрало</span></div>
            <div class="gs-row"><span class="gs-chip chip-0">0</span><span class="gs-label">Нейтрально</span></div>
            <div class="gs-row"><span class="gs-chip chip-p3">+3</span><span class="gs-label">Немного восполнило</span></div>
            <div class="gs-row"><span class="gs-chip chip-p5">+5</span><span class="gs-label">Хорошо зарядило</span></div>
            <div class="gs-row"><span class="gs-chip chip-p10">+10</span><span class="gs-label">Мощный заряд энергии</span></div>
          </div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">03</div>
          <div class="guide-step-title">Как заполнять</div>
          <div class="guide-step-text">Каждый день записывайте дела и события, которые занимали ваше время и внимание − встречи, задачи, активности, бытовые дела. Не обязательно всё, только значимое. Оценивайте честно − не как «должно быть», а как было на самом деле. Энергия дня складывается из энергии дел и выполненных привычек; обе составляющие показаны отдельно.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">04</div>
          <div class="guide-step-title">Как добавить привычку</div>
          <div class="guide-step-text">Перейдите в раздел «Привычки», нажмите «+ Добавить привычку», укажите название, сферу жизни и энергию за выполнение. Выбирайте небольшие действия, которые хотите выполнять регулярно.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">05</div>
          <div class="guide-step-title">Энергия привычек</div>
          <div class="guide-step-text">При создании привычки выберите 0 − нейтрально, +1 − чуть-чуть, +3 − хорошо или +5 − мощно. Нейтральная привычка учитывается в статистике выполнения, но не влияет на баланс энергии и не попадает в топ доноров.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">06</div>
          <div class="guide-step-title">Как отмечать выполнение</div>
          <div class="guide-step-text">Отмечайте привычки в разделе «Привычки» или в «Дневнике» за соответствующий день. Повторное нажатие снимает отметку. Выполнение учитывается один раз, независимо от того, в каком разделе вы его отметили. Будущие дни недоступны для отметок.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">07</div>
          <div class="guide-step-title">Колесо привычек</div>
          <div class="guide-step-text">В разделе «Месяц» колесо показывает процент выполнения привычек по сферам жизни за текущий четырёхнедельный цикл. Учитываются прошедшие дни и сегодняшний день, начиная с даты создания привычки. Если в сфере нет данных, процент не рассчитывается. Общий процент − отношение всех выполненных отметок ко всем доступным отметкам.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">08</div>
          <div class="guide-step-title">Архивирование привычек</div>
          <div class="guide-step-text">Если привычка больше не актуальна, архивируйте её. Ранее выполненные отметки и полученная энергия сохранятся. После архивации новые дни не снижают процент выполнения.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">09</div>
          <div class="guide-step-title">Итоги недели</div>
          <div class="guide-step-text">Раздел «Неделя» автоматически показывает суммарную энергию дел и выполненных привычек, а также топ вампиров и доноров за 7 дней. Ответьте на вопросы рефлексии − это помогает увидеть паттерны.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">10</div>
          <div class="guide-step-title">Итоги месяца</div>
          <div class="guide-step-text">Раздел «Месяц» показывает суммарную энергию дел и выполненных привычек за четырёхнедельный цикл, главных вампиров и доноров и колесо привычек. Это основа для изменений − что убрать, что добавить, как выстроить день под свою энергию.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">11</div>
          <div class="guide-step-title">Новый месяц</div>
          <div class="guide-step-text">Когда месяц закончится, перейдите в Профиль и нажмите «Начать новый месяц». Старые данные сохранятся в Архиве − вы всегда сможете вернуться к ним.</div>
        </div>

        <div class="guide-block">
          <div class="guide-step-num">12</div>
          <div class="guide-step-title">Резервная копия</div>
          <div class="guide-step-text">Данные хранятся локально в браузере вашего устройства. При удалении данных сайта или смене устройства записи могут быть потеряны. Чтобы не потерять записи − регулярно сохраняйте резервную копию: Профиль → «Сохранить резервную копию». Файл сохранится на телефон − загрузите его в iCloud или Google Drive. Для восстановления нажмите «Восстановить из копии» и выберите файл.</div>
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
            Архив пока пуст.<br>Завершите первый месяц −<br>он появится здесь.
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
            ? DB.parseDate(m.startDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
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
              <button class="ac-delete" data-delete="${m.index}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    content.querySelectorAll('.ac-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.delete);
        const m = DB.getMonthMeta(idx);
        const label = m.startDate
          ? DB.parseDate(m.startDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
          : `Месяц ${idx + 1}`;
        if (confirm(`Удалить ${label} из архива?

Все данные этого месяца будут удалены.`)) {
          DB.deleteArchivedMonth(idx);
          renderArchive();
        }
      });
    });

    content.querySelectorAll('.archive-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.ac-delete')) return;
        const idx = parseInt(card.dataset.month);
        showArchiveMonth(idx);
      });
    });
  }

  function showArchiveMonth(monthIdx) {
    const m = DB.getMonthMeta(monthIdx);
    const startStr = m.startDate
      ? DB.parseDate(m.startDate).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
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
        ${MonthScreen.renderSphereEnergy(DB.getSphereEnergy(1,4,monthIdx),true)}
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
    const date = DB.localDate();
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `planer-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(jsonStr) {
    DB.importAllData(jsonStr);
    DayScreen.initToday();
  }

  function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
  function escHtml(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { render };

})();
