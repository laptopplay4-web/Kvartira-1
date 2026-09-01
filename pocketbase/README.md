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

Пока `VITE_API_MODE=mock` — приложение не обращается к PocketBase (адаптер в фазе 2).

## Команды

| Команда | Действие |
|---------|----------|
| `npm run pb:up` | Запустить сервер |
| `npm run pb:down` | Остановить |
| `npm run pb:logs` | Логи |
| `npm run pb:seed` | Загрузить демо-данные из `src/mocks/seed.ts` (фаза 1.5) |

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
