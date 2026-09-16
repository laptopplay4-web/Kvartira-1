# Готовность к выкладке на сервер

Дата: 2026-09-09 · после security / 152-ФЗ / UI-рефакторинга.

## Что уже готово

- Клиент и PocketBase-адаптеры для основных модулей.
- Закрыта утечка телефонов через synthetic email.
- Серверные хуки на занятиях, сужение справочника пользователей, rate limit входа.
- Согласия по целям, отзыв, удаление аккаунта, выгрузка данных, audit log.
- CSP на сборке + пример nginx headers.
- Единые кнопки/окна с лёгкими анимациями.
- Тесты: **579 passed**; `typecheck` / `lint` / `build` зелёные.

## Нужно сделать вам перед запуском

1. Выложить фронт + `pb_hooks` + миграции (включая `1792400000` legal bootstrap и ранее некатанные) и **перезапустить PocketBase**.
2. (Рекомендуется) `npm run pb:seed:legal` — полные тексты документов; без seed миграция/bootstrap создаёт краткие stub, регистрация уже работает.
3. В `/admin/registration-qr` открыть страницу (seed автоматически заменяется) и **распечатать** QR; при компрометации — «Новый QR».
4. Задать секреты: `WEB_PUSH_RELAY_SECRET`, VAPID, HTTPS, `VITE_API_MODE=pocketbase`.
5. Подключить `deploy/security-headers.conf` на nginx.
6. Подключить `deploy/static-cache.conf` для `/assets/` (immutable long-cache hashed JS/CSS) и `no-cache` для `index.html` / `/`.
7. Отдать шаблонные тексты документов юристу (`docs/ROSKOMNADZOR_CHECKLIST.md`).
8. Хостинг БД и бэкапов — на территории РФ.

## Что добавить

| Приоритет | Что | Зачем |
|-----------|-----|--------|
| P0 | Бэкапы PocketBase + мониторинг | без этого любой сбой = потеря школы |
| P0 | E2E smoke (вход, запись, чат, QR) | ловит поломки, которые unit-тесты не видят |
| P1 | Email-канал (ROADMAP 3.4) | восстановление пароля / security-письма |
| P1 | Серверная проверка слотов при book | клиент уже считает; на сервере — второй замок |
| P2 | HttpOnly cookie вместо token в localStorage | XSS-устойчивее; большая переделка PB auth |
| P2 | Vendor split (`react-vendor`, `query-vendor`) | `vite.config.ts` manualChunks — меньше повторной загрузки при обновлениях app-кода |
| P2 | CDN origin-pull | опционально: CDN тянет `dist/` с origin; те же `security-headers.conf` + `static-cache.conf` на origin |

## CDN и статика (чек-лист)

1. **Origin:** nginx отдаёт `dist/`; include `deploy/security-headers.conf` (CSP complement, HSTS, frame deny).
2. **Hashed assets:** include `deploy/static-cache.conf` — `/assets/` → `Cache-Control: public, max-age=31536000, immutable`; `index.html` и `/` → `no-cache`.
3. **CDN (опционально):** origin-pull всего `dist/` или только `/assets/`; не кэшировать HTML entry на edge дольше чем origin.
4. **Сборка:** после `npm run build` проверить, что чанки `react-vendor` / `query-vendor` попали в `/assets/` с content-hash в имени.
5. **Без выдуманных credentials:** API keys / CDN tokens задаются в панели провайдера, не в репозитории.

## Что убрать / не трогать

- Модуль «Прогресс» уже удалён — не возвращать без продукта.
- Демо-вход в production уже вырезан.
- Seed invite token не использовать в бою.

## Что исправить / досмотреть

| Тема | Статус |
|------|--------|
| Audit только на согласиях/аккаунте | book/reschedule/cancel audit — ещё можно расширить |
| SMS recovery | stub до провайдера |
| Admin Security extended | ROADMAP 4.2 |
| A11y pass | фокус/контраст после UI — выборочная ручная проверка |
| Graphify warning на `offline.test.tsx` | косметика AST |

## Критерий «можно пускать учеников»

- [ ] HTTPS + security headers + static-cache для `/assets/`
- [ ] Миграции применены, PB перезапущен
- [ ] QR invite сменён
- [ ] Юрист подписал тексты / РКН-уведомление подано
- [ ] Один полный ручной прогон: QR → регистрация с галочками → занятие → чат с файлом → отзыв рассылки → выгрузка данных → удаление аккаунта
