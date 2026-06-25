// ── profile.js — экран профиля ───────────────────────────────

const ProfileScreen = (() => {

  function render() {
    const el = document.getElementById('screen-profile');
    const meta = DB.getMeta();
    const token = DB.getToken();

    const startDate = meta.startDate
      ? new Date(meta.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'не задана';

    const totalTasks = (() => {
      let n = 0;
      for (let w = 1; w <= 4; w++)
        for (let d = 1; d <= 7; d++)
          n += DB.getTasks(w, d).length;
      return n;
    })();

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">inamora.ru</div>
        <div class="title">Профиль</div>
      </div>

      <div class="profile-section">

        <div class="section-label">Мой планер</div>

        <div class="profile-row">
          <span class="pr-label">Код доступа</span>
          <span class="pr-value">${token || '—'}</span>
        </div>
        <div class="profile-row">
          <span class="pr-label">Начало планера</span>
          <span class="pr-value">${startDate}</span>
        </div>
        <div class="profile-row">
          <span class="pr-label">Дел записано</span>
          <span class="pr-value">${totalTasks}</span>
        </div>

        <div class="section-label" style="margin-top:20px">Дата начала месяца</div>
        <div class="reflection-card">
          <div class="ref-q">С какой даты начинается ваш месяц?</div>
          <input type="date" class="ref-input" id="start-date-input"
            value="${meta.startDate || ''}"
            style="min-height:auto; padding:10px;">
        </div>

        <div class="section-label" style="margin-top:20px">О приложении</div>
        <div class="profile-row">
          <span class="pr-label">Планер энергетического баланса</span>
          <span class="pr-value">v1.0</span>
        </div>
        <div class="profile-row">
          <span class="pr-label">Автор</span>
          <span class="pr-value">Юля Инамора</span>
        </div>

        <a href="https://inamora.ru" style="display:block; text-align:center; margin-top:12px; font-size:12px; color:var(--accent); text-decoration:none; opacity:.7;">inamora.ru</a>

        <button class="logout-btn" id="logout-btn" style="margin-top:24px">Выйти из планера</button>

      </div>
    `;

    document.getElementById('start-date-input').addEventListener('change', e => {
      DB.setMeta({ startDate: e.target.value });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      if (confirm('Выйти из планера? Все данные сохранятся на этом устройстве.')) {
        Auth.logout();
        App.showAuth();
      }
    });
  }

  return { render };
})();
