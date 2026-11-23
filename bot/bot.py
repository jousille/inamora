import os, random, string, requests
from datetime import datetime, timedelta, timezone
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes
from telegram.request import HTTPXRequest

BOT_TOKEN = os.environ['BOT_TOKEN']
ADMIN_ID = int(os.environ['ADMIN_ID'])
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
PROXY = "socks5://184.178.172.5:15303"

def sb_headers():
    return {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json', 'Prefer': 'return=representation'}

def sb_create_token(token: str, days: int = 365) -> dict:
    expires_at = None
    if days > 0:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    payload = {'token': token, 'used': False, 'expires_at': expires_at}
    r = requests.post(f'{SUPABASE_URL}/rest/v1/tokens', headers=sb_headers(), json=payload)
    r.raise_for_status()
    return r.json()

def sb_get_tokens() -> list:
    r = requests.get(
        f'{SUPABASE_URL}/rest/v1/tokens?select=token,used,device_name,expires_at,created_at&order=created_at.desc',
        headers=sb_headers())
    r.raise_for_status()
    return r.json()

def sb_delete_token(token: str):
    r = requests.delete(
        f'{SUPABASE_URL}/rest/v1/tokens?token=eq.{requests.utils.quote(token)}',
        headers=sb_headers())
    r.raise_for_status()

def generate_token(length=10) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

def is_admin(update): return update.effective_user.id == ADMIN_ID

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update): return
    await update.message.reply_text("Привет! Я бот управления токенами inamora.\n/help — список команд")

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update): return
    await update.message.reply_text(
        "/addtoken [дней] — создать токен (по умолчанию 365 дней, 0 = бессрочный)\n"
        "/tokens — список всех токенов\n"
        "/revoke TOKEN — удалить токен")

async def cmd_addtoken(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update): return
    days = 365
    if ctx.args:
        try: days = int(ctx.args[0])
        except: await update.message.reply_text("Укажи число дней: /addtoken 30"); return
    token = generate_token()
    sb_create_token(token, days)
    exp = "бессрочный" if days == 0 else f"{days} дней"
    await update.message.reply_text(f"Токен создан:\n`{token}`\nСрок: {exp}", parse_mode='Markdown')

async def cmd_tokens(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update): return
    tokens = sb_get_tokens()
    if not tokens: await update.message.reply_text("Токенов нет."); return
    lines = []
    now = datetime.now(timezone.utc)
    for t in tokens:
        status = "🔴 использован" if t['used'] else "🟢 активен"
        exp = t.get('expires_at')
        if exp:
            exp_dt = datetime.fromisoformat(exp.replace('Z','+00:00'))
            if exp_dt < now: status = "🔴 истёк"
            exp_str = exp_dt.strftime('%d.%m.%Y')
        else:
            exp_str = "∞"
        device = t.get('device_name') or '—'
        lines.append(f"{status} `{t['token']}` до {exp_str} · {device}")
    await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')

async def cmd_revoke(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update): return
    if not ctx.args: await update.message.reply_text("Укажи токен: /revoke TOKEN"); return
    token = ctx.args[0]
    sb_delete_token(token)
    await update.message.reply_text(f"🗑 Токен `{token}` удалён", parse_mode='Markdown')

os.environ['PYTHONHTTPSVERIFY'] = '0'
import ssl; ssl._create_default_https_context = ssl._create_unverified_context
request = HTTPXRequest(proxy=PROXY)
app = ApplicationBuilder().token(BOT_TOKEN).request(request).build()
app.add_handler(CommandHandler("start", cmd_start))
app.add_handler(CommandHandler("help", cmd_help))
app.add_handler(CommandHandler("addtoken", cmd_addtoken))
app.add_handler(CommandHandler("tokens", cmd_tokens))
app.add_handler(CommandHandler("revoke", cmd_revoke))
app.run_polling()
