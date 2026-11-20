"""
Telegram-бот для управления токенами планера inamora.
Работает с Supabase: создаёт, просматривает и отзывает токены.

Команды:
  /addtoken [days]   — создать токен (по умолчанию 365 дней, 0 = бессрочный)
  /tokens            — список всех токенов
  /revoke TOKEN      — отозвать токен (удалить из базы)
  /help              — помощь
"""

import os
import random
import string
import requests
from datetime import datetime, timedelta, timezone
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# ── Настройки ────────────────────────────────────────────────────────
BOT_TOKEN     = os.environ['BOT_TOKEN']
ADMIN_ID      = int(os.environ['ADMIN_ID'])          # твой Telegram user_id
SUPABASE_URL  = os.environ['SUPABASE_URL']           # https://xxx.supabase.co
SUPABASE_KEY  = os.environ['SUPABASE_SERVICE_KEY']   # service_role ключ (не anon!)

# ── Supabase helpers ─────────────────────────────────────────────────

def sb_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }

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
        headers=sb_headers()
    )
    r.raise_for_status()
    return r.json()

def sb_delete_token(token: str):
    r = requests.delete(
        f'{SUPABASE_URL}/rest/v1/tokens?token=eq.{requests.utils.quote(token)}',
        headers=sb_headers()
    )
    r.raise_for_status()

# ── Генерация токена ─────────────────────────────────────────────────

def generate_token(length=10) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))

# ── Проверка прав ────────────────────────────────────────────────────

def is_admin(update: Update) -> bool:
    return update.effective_user.id == ADMIN_ID

# ── Команды ──────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Привет! Это бот управления токенами планера.\n\n"
        "/addtoken [days] — создать токен\n"
        "/tokens — список токенов\n"
        "/revoke TOKEN — отозвать токен\n"
        "/help — помощь"
    )

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "*Команды бота:*\n\n"
        "`/addtoken` — создать токен на 365 дней\n"
        "`/addtoken 30` — создать токен на 30 дней\n"
        "`/addtoken 0` — создать бессрочный токен\n\n"
        "`/tokens` — список всех токенов\n\n"
        "`/revoke ТОКЕН` — удалить токен из базы",
        parse_mode='Markdown'
    )

async def cmd_addtoken(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await update.message.reply_text("⛔ Нет доступа.")
        return

    # Парсим аргумент days
    days = 365
    if ctx.args:
        try:
            days = int(ctx.args[0])
            if days < 0:
                raise ValueError
        except ValueError:
            await update.message.reply_text("❌ Укажи количество дней: `/addtoken 30` или `/addtoken 0` для бессрочного.", parse_mode='Markdown')
            return

    token = generate_token()

    try:
        sb_create_token(token, days)
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка Supabase: {e}")
        return

    if days == 0:
        expires_text = "бессрочный"
    else:
        expires_date = (datetime.now(timezone.utc) + timedelta(days=days)).strftime('%d.%m.%Y')
        expires_text = f"до {expires_date} ({days} дн.)"

    await update.message.reply_text(
        f"✅ *Токен создан*\n\n"
        f"`{token}`\n\n"
        f"Срок: {expires_text}\n"
        f"Отправь этот токен пользователю.",
        parse_mode='Markdown'
    )

async def cmd_tokens(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await update.message.reply_text("⛔ Нет доступа.")
        return

    try:
        tokens = sb_get_tokens()
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка Supabase: {e}")
        return

    if not tokens:
        await update.message.reply_text("Токенов пока нет.")
        return

    now = datetime.now(timezone.utc)
    lines = []
    for t in tokens:
        status = "🟢" if not t['used'] else "🔵"

        # Проверяем срок
        if t['expires_at']:
            exp = datetime.fromisoformat(t['expires_at'])
            if exp < now:
                status = "🔴"  # просрочен
            exp_text = exp.strftime('%d.%m.%Y')
        else:
            exp_text = "∞"

        device = t.get('device_name') or '—'
        lines.append(f"{status} `{t['token']}` · {exp_text} · {device}")

    text = "*Токены:*\n\n" + "\n".join(lines) + "\n\n🟢 свободен  🔵 используется  🔴 просрочен"
    await update.message.reply_text(text, parse_mode='Markdown')

async def cmd_revoke(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        await update.message.reply_text("⛔ Нет доступа.")
        return

    if not ctx.args:
        await update.message.reply_text("Укажи токен: `/revoke ТОКЕН`", parse_mode='Markdown')
        return

    token = ctx.args[0].upper()

    try:
        sb_delete_token(token)
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {e}")
        return

    await update.message.reply_text(f"✅ Токен `{token}` удалён.", parse_mode='Markdown')

# ── Запуск ────────────────────────────────────────────────────────────

def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', cmd_start))
    app.add_handler(CommandHandler('help', cmd_help))
    app.add_handler(CommandHandler('addtoken', cmd_addtoken))
    app.add_handler(CommandHandler('tokens', cmd_tokens))
    app.add_handler(CommandHandler('revoke', cmd_revoke))
    print("Бот запущен...")
    app.run_polling()

if __name__ == '__main__':
    main()
