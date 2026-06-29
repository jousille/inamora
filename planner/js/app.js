// ── app.js — главный оркестратор ─────────────────────────────

const App = (() => {

  const SCREENS = ['day', 'week', 'month', 'profile'];

  let currentScreen = 'day';

  function init() {
    if (Auth.isLoggedIn()) {
      startApp(Auth.currentToken());
    } else {
      showAuth();
    }
  }

  function showAuth() {
    document.getElementById('screen-auth').classList.add('active');
    document.getElementById('app').classList.remove('active');
    bindAuthEvents();
  }

  function startApp(token) {
    DB.init(token);

    // Если дата начала не задана — ставим сегодня
    const meta = DB.getMeta();
    if (!meta.startDate) {
      const today = new Date().toISOString().split('T')[0];
      DB.setMeta({ startDate: today });
    }

    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('app').classList.add('active');

    bindNavEvents();
    DayScreen.initToday();
    navigateTo('day');

    // Автоэкспорт — раз в 7 дней
    setTimeout(() => {
      if (DB.checkAutoExport()) showExportBanner();
    }, 2000);
  }

  function bindAuthEvents() {
    const input  = document.getElementById('token-input');
    const btn    = document.getElementById('token-submit');
    const errEl  = document.getElementById('token-error');

    function tryLogin() {
      const val = input.value.trim();
      if (!val) return;
      const token = Auth.login(val);
      if (token) {
        errEl.textContent = '';
        startApp(token);
      } else {
        errEl.textContent = 'Неверный код доступа';
        input.style.borderColor = 'var(--neg-10-tx)';
        setTimeout(() => { input.style.borderColor = ''; }, 1500);
      }
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
    input.addEventListener('input', () => { errEl.textContent = ''; });
  }

  function bindNavEvents() {
    document.querySelectorAll('#bottom-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.screen));
    });
  }

  function navigateTo(screen) {
    if (!SCREENS.includes(screen)) return;
    currentScreen = screen;

    // Скрыть все экраны приложения
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));

    // Показать нужный
    document.getElementById(`screen-${screen}`).classList.add('active');

    // Обновить нав
    document.querySelectorAll('#bottom-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    // Отрендерить экран
    switch (screen) {
      case 'day':     DayScreen.render();     break;
      case 'week':    WeekScreen.render();    break;
      case 'month':   MonthScreen.render();   break;
      case 'profile': ProfileScreen.render(); break;
    }

    // Скролл наверх
    document.getElementById(`screen-${screen}`).scrollTop = 0;
  }

  function showExportBanner() {
    const banner = document.createElement('div');
    banner.id = 'export-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:72px', 'left:0', 'right:0',
      'margin:0 16px', 'z-index:200', 'background:var(--dark)',
      'border-radius:12px', 'padding:12px 16px',
      'display:flex', 'align-items:center', 'gap:12px',
      'box-shadow:0 4px 20px rgba(0,0,0,.3)'
    ].join(';');
    banner.innerHTML = `
      <div style="flex:1">
        <div style="font-size:13px;color:var(--lighter);font-weight:500;margin-bottom:2px">Сохраните резервную копию</div>
        <div style="font-size:11px;color:var(--acc-lt)">Прошло 7 дней — скачайте копию данных</div>
      </div>
      <button id="export-banner-yes" style="background:var(--accent);color:var(--dark);border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap">Сохранить</button>
      <button id="export-banner-no" style="background:transparent;color:var(--acc-lt);border:none;padding:8px;cursor:pointer;font-size:20px;line-height:1">×</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('export-banner-yes').addEventListener('click', () => {
      const json = DB.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      const a    = document.createElement('a');
      a.href = url;
      a.download = `planer-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      DB.markExported();
      banner.remove();
    });

    document.getElementById('export-banner-no').addEventListener('click', () => banner.remove());

    // Автоскрытие через 15 секунд
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 15000);
  }

  return { init, showAuth, navigateTo };

})();

// Старт
document.addEventListener('DOMContentLoaded', () => App.init());
