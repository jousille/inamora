// ── app.js — главный оркестратор ─────────────────────────────

const App = (() => {

  const SCREENS = ['day', 'week', 'month', 'profile'];
  let currentScreen = 'day';

  async function init() {
    if (Auth.isLoggedIn()) {
      await startApp(Auth.currentToken());
    } else {
      showAuth();
    }
  }

  function showAuth() {
    document.getElementById('screen-auth').classList.add('active');
    document.getElementById('app').classList.remove('active');
    bindAuthEvents();
  }

  async function startApp(token) {
    DB.init(token);

    showLoader(true);
    try {
      await DB.loadMeta();
    } catch(err) {
      document.querySelector('.loader-text').textContent = 'Ошибка: ' + err.message;
      console.error('loadMeta failed:', err);
      return;
    }

    const meta = DB.getMeta();
    if (!meta.startDate) {
      const today = new Date().toISOString().split('T')[0];
      await DB.setMeta({ startDate: today });
    }

    showLoader(false);

    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('app').classList.add('active');

    bindNavEvents();
    DayScreen.initToday();
    await navigateTo('day');

    // Проверяем нужен ли автоэкспорт (раз в 7 дней)
    setTimeout(async () => {
      if (await DB.checkAutoExport()) {
        showExportPrompt();
      }
    }, 2000);
  }

  function showLoader(show) {
    let el = document.getElementById('app-loader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-loader';
      el.innerHTML = `<div class="loader-inner"><div class="loader-logo">inamora</div><div class="loader-text">Загружаем планер...</div></div>`;
      el.style.cssText = 'position:fixed;inset:0;background:var(--dark);display:flex;align-items:center;justify-content:center;z-index:999;flex-direction:column;';
      el.querySelector('.loader-inner').style.cssText = 'text-align:center;';
      el.querySelector('.loader-logo').style.cssText = 'font-family:"Cormorant Garamond",serif;font-size:32px;color:var(--lighter);margin-bottom:12px;';
      el.querySelector('.loader-text').style.cssText = 'font-size:13px;color:var(--acc-lt);letter-spacing:.08em;';
      document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
  }

  function bindAuthEvents() {
    const input = document.getElementById('token-input');
    const btn   = document.getElementById('token-submit');
    const errEl = document.getElementById('token-error');

    async function tryLogin() {
      const val = input.value.trim();
      if (!val) return;
      btn.disabled = true;
      btn.textContent = 'Проверяем...';
      const token = Auth.login(val);
      if (token) {
        errEl.textContent = '';
        await startApp(token);
      } else {
        errEl.textContent = 'Неверный код доступа';
        input.style.borderColor = 'var(--neg-10-tx)';
        setTimeout(() => { input.style.borderColor = ''; }, 1500);
        btn.disabled = false;
        btn.textContent = 'Войти';
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

  async function navigateTo(screen) {
    if (!SCREENS.includes(screen)) return;
    currentScreen = screen;

    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screen}`).classList.add('active');
    document.querySelectorAll('#bottom-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === screen);
    });

    showLoader(true);
    switch (screen) {
      case 'day':     await DayScreen.render();     break;
      case 'week':    await WeekScreen.render();    break;
      case 'month':   await MonthScreen.render();   break;
      case 'profile': await ProfileScreen.render(); break;
    }
    showLoader(false);

    document.getElementById(`screen-${screen}`).scrollTop = 0;
  }

  function showExportPrompt() {
    const banner = document.createElement('div');
    banner.id = 'export-banner';
    banner.style.cssText = 'position:fixed;bottom:72px;left:0;right:0;margin:0 16px;z-index:200;background:var(--dark);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.3)';
    banner.innerHTML = `
      <div style="flex:1">
        <div style="font-size:13px;color:var(--lighter);font-weight:500;margin-bottom:2px;">Сохраните резервную копию</div>
        <div style="font-size:11px;color:var(--acc-lt);">Прошло 7 дней с последнего сохранения</div>
      </div>
      <button id="export-yes" style="background:var(--accent);color:var(--dark);border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap">Сохранить</button>
      <button id="export-no" style="background:transparent;color:var(--acc-lt);border:none;padding:8px;cursor:pointer;font-size:18px;line-height:1">×</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('export-yes').addEventListener('click', async () => {
      const json = await DB.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      const a    = document.createElement('a');
      a.href = url; a.download = `planer-backup-${date}.json`; a.click();
      URL.revokeObjectURL(url);
      await DB.markExported();
      banner.remove();
    });

    document.getElementById('export-no').addEventListener('click', () => banner.remove());

    // Автоскрытие через 15 секунд
    setTimeout(() => banner.remove(), 15000);
  }

  return { init, showAuth, navigateTo };

})();

document.addEventListener('DOMContentLoaded', () => App.init());
