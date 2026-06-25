# Планер энергетического баланса · inamora.ru

PWA-приложение для отслеживания энергии дел.

## Структура файлов

```
planer/
├── index.html        ← главная страница
├── manifest.json     ← PWA-манифест
├── sw.js             ← Service Worker (офлайн)
├── css/
│   └── style.css     ← все стили (палитра inamora)
├── js/
│   ├── db.js         ← хранилище данных (localStorage)
│   ├── auth.js       ← авторизация по токену
│   ├── day.js        ← экран дневного листа
│   ├── week.js       ← экран итогов недели
│   ├── month.js      ← экран итогов месяца
│   ├── profile.js    ← экран профиля
│   └── app.js        ← роутинг и навигация
└── icons/
    ├── icon-192.png  ← иконка для Android (нужно добавить)
    └── icon-512.png  ← иконка для сплэш-экрана (нужно добавить)
```

## Деплой на inamora.ru

1. Загрузите папку `planer/` в корень сайта через FTP/cPanel
2. Приложение будет доступно по адресу `https://inamora.ru/planer/`

## Добавление покупателей

Откройте `js/auth.js` и добавьте токены в объект `VALID_TOKENS`:

```js
const VALID_TOKENS = {
  'INAMORA-DEMO':   { expires: null },      // демо-доступ
  'INAMORA-A1B2C3': { expires: null },      // покупатель 1
  'INAMORA-D4E5F6': { expires: null },      // покупатель 2
  // expires: '2026-01-01' — если хотите ограничить по дате
};
```

Токен покупатель получает в письме после оплаты.

## Генератор токенов (запустить в консоли браузера)

```js
function genToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let t = 'INAMORA-';
  for (let i = 0; i < 6; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}
console.log(genToken()); // INAMORA-X7KM3P
```

## Установка на телефон (для покупателя)

**Android:**
1. Открыть `https://inamora.ru/planer/` в Chrome
2. Меню → «Добавить на главный экран»
3. Готово — иконка появится на рабочем столе

**iPhone:**
1. Открыть в Safari
2. Поделиться → «На экран «Домой»»

## Иконки

Нужно добавить два файла в папку `icons/`:
- `icon-192.png` — 192×192 px
- `icon-512.png` — 512×512 px

Можно создать на [favicon.io](https://favicon.io) или в Canva.
