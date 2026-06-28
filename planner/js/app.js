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

    const meta = DB.getMeta();
    if (!meta.startDate) {
      DB.setMeta({ startDate: new Date().toISOString().split('T')[0] });
    }

    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('app').classList.add('active');

    bindNavEvents();
    DayScreen.initToday();
    navigateTo('day');
  }

  function bindAuthEvents() {
    const input = document.getElementById('token-input');
    const btn   = document.getElementById('token-submit');
    const errEl = document.getElementById('token-error');

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

    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screen}`).classList.add('active');
    document.querySelectorAll('#bottom-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    switch (screen) {
      case 'day':     DayScreen.render();     break;
      case 'week':    WeekScreen.render();    break;
      case 'month':   MonthScreen.render();   break;
      case 'profile': ProfileScreen.render(); break;
    }

    document.getElementById(`screen-${screen}`).scrollTop = 0;
  }

  return { init, showAuth, navigateTo };

})();

document.addEventListener('DOMContentLoaded', () => App.init());
