# Бот управления токенами планера

Telegram-бот для выдачи и отзыва токенов доступа к планеру inamora.

## Команды

| Команда | Описание |
|---|---|
| `/addtoken` | Создать токен на 365 дней |
| `/addtoken 30` | Создать токен на 30 дней |
| `/addtoken 0` | Создать бессрочный токен |
| `/tokens` | Список всех токенов |
| `/revoke ТОКЕН` | Удалить токен |

## Деплой на Railway

1. Создай новый проект на [railway.app](https://railway.app)
2. Подключи GitHub репозиторий → папку `bot/`
3. Добавь переменные окружения:

| Переменная | Значение |
|---|---|
| `BOT_TOKEN` | Токен от @BotFather |
| `ADMIN_ID` | Твой Telegram user_id (узнай у @userinfobot) |
| `SUPABASE_URL` | `https://lrogbpoacfrkvgxsyjoq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role ключ из Supabase → Settings → API |

4. Railway автоматически установит зависимости из `requirements.txt` и запустит `bot.py`

## Важно

Бот использует `service_role` ключ Supabase (не `anon`), чтобы иметь права на запись и удаление токенов. Этот ключ **не должен** попасть в публичный код — только в переменные окружения Railway.
