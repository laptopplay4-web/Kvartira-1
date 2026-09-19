# PocketBase — локальный backend «Квартира»

Сервер для хранения данных приложения (пользователи, занятия, чаты и т.д.). Сейчас приложение работает на «заглушке» (mock); этот сервер — первый шаг к настоящему backend.

## Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (или Docker Engine + Compose)

## Быстрый старт

```bash
# из корня проекта
npm run pb:up
```

Админ-панель: http://127.0.0.1:8090/_/

При первом запуске создайте admin-аккаунт в браузере.

## Переменные окружения

Скопируйте `.env.example` → `.env` и при необходимости измените:

| Переменная | Назначение | По умолчанию |
|------------|------------|--------------|
| `PB_HTTP_PORT` | Порт PocketBase | `8090` |
| `VITE_API_URL` | URL для фронтенда | `http://127.0.0.1:8090` |
| `VITE_API_MODE` | `mock` или `pocketbase` | `mock` |
| `VITE_LESSONS_SOURCE` | `native` или `yclients` (занятия через YCLIENTS) | `native` |
| `YCLIENTS_COMPANY_ID` | ID филиала YCLIENTS (server-only) | — |
| `YCLIENTS_PARTNER_TOKEN` | Partner API token | — |
| `YCLIENTS_USER_TOKEN` | User token для отмены записей | — |

Пока `VITE_API_MODE=mock` — приложение не обращается к PocketBase.

### YCLIENTS (занятия)

1. Задать `YCLIENTS_*` в `.env` (пробрасываются в docker-compose) и **перезапустить** PocketBase.
2. Админ → `/admin/yclients` — связать направления↔услуги и staff↔преподаватели.
3. Фронт: `VITE_API_MODE=pocketbase` + `VITE_LESSONS_SOURCE=yclients`.
4. Без виджетов: запись/отмена/график через BFF `pb_hooks/yclients.pb.js`.

## Команды

| Команда | Действие |
|---------|----------|
| `npm run pb:up` | Запустить сервер |
| `npm run pb:down` | Остановить |
| `npm run pb:logs` | Логи |
| `npm run pb:seed` | Загрузить демо-данные из `src/mocks/seed.ts` (фаза 1.5) |

После обновления миграций (локально без Docker):

```bash
cd pocketbase
.\pocketbase.exe migrate --dir=./pb_data --migrationsDir=./pb_migrations --hooksDir=./pb_hooks
```

Затем перезапустить `serve` (миграции при `serve` тоже применяются, но явный `migrate` надёжнее).

## Структура

```
pocketbase/
├── pb_data/        # БД и файлы (не в git)
├── pb_migrations/  # Схема коллекций (фаза 1.2 ✅)
├── pb_hooks/       # Server hooks — auth.pb.js ✅ (1.3), lib/kvartiraRbac.js ✅ (1.4)
├── seed/           # npm run pb:seed — демо-данные из mocks/seed.ts (1.5)
├── RBAC.md         # API rules ↔ permissions/index.ts (1.4)
├── SCHEMA.md       # Карта коллекций ↔ types.ts
└── README.md
```

Подробная схема — **`SCHEMA.md`** (28 коллекций + расширение `users`).

### Seed (фаза 1.5)

После первого запуска (`npm run pb:up`) создайте superuser в Admin UI, затем в `.env`:

```
PB_ADMIN_EMAIL=...
PB_ADMIN_PASSWORD=...
```

```bash
npm run pb:seed
```

Скрипт переносит демо-данные из `src/mocks/seed.ts` (ученики, занятия, чаты и т.д.). Повторный запуск пропускается, если ученик `+79001234567` уже есть. Для чистой перезаливки — удалите `pocketbase/pb_data` и запустите снова.

Демо-вход после seed: `+79001234567` / `student123` (через PocketBase API; фронтенд подключится в фазе 2).

### Auth (фаза 1.3)

Вход: `POST /api/collections/users/auth-with-password` с телефоном в `identity`.  
Hooks: `pb_hooks/auth.pb.js` — см. **`SCHEMA.md` § Auth**.

### Web Push (телефон)

1. В `.env` — `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEB_PUSH_RELAY_SECRET`, `WEB_PUSH_RELAY_URL`  
   (ключи: `npm run push:vapid`).
2. Три процесса:
   - **Vite:** `npm run dev` (подхватит `VITE_VAPID_*`)
   - **PocketBase с env:** `npm run pb:serve` (не голый `pocketbase.exe` — иначе hooks не видят relay)  
     Docker: `npm run pb:up`, в `.env` для контейнера:  
     `WEB_PUSH_RELAY_URL=http://host.docker.internal:3001/send`
   - **Relay:** `npm run push:relay`
3. В приложении: Настройки → Система → включить Push → разрешить уведомления в браузере.
4. Проверка: создать ДЗ / сообщение — на устройство уйдёт push (нужна подписка + `pushEnabled`).

**Телефон:** Web Push работает только с **HTTPS** (или localhost).  
Сайт по `http://192.168.x.x` на телефоне push не получит — нужен production HTTPS или туннель (ngrok/cloudflare).
