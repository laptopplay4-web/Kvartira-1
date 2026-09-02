# Квартира — Production Roadmap

Версия: 1.0 · 2026-08-31

> **Источник правды для новых чатов.** Читать вместе с `stack.mdc` §16 и §42.
> Продуктовые требования: `PROJECT_SPEC.md`. Протокол сессии: `session-handoff.mdc`.

---

## 1. Критерий «приложение закончено»

Production-ready, когда выполнены **все** условия:

1. **PROJECT_SPEC §31 invariants** — на сервере (не только mock):
   - нет double-booking;
   - слоты проверяет сервер;
   - RBAC на сервере;
   - IDOR-safe по всем ресурсам;
   - история изменений сохраняется;
   - пароли/секреты не в логах;
   - файлы — только авторизованным.

2. **`VITE_API_MODE=pocketbase`** в production (mock только для dev/test).

3. **Фазы 0–6** — все P0/P1 закрыты; P2 — закрыты или явно отложены с обоснованием.

4. **275+ domain tests** проходят; E2E smoke (фаза 5) — green.

---

## 2. Текущий статус (2026-09-02)

| Область | Статус |
|---------|--------|
| MVP (auth, lessons, chat, events, profile, admin, PWA) | ✅ mock + pocketbase |
| Этап 2 (assignments, progress, support, public, security, legal CMS) | ✅ mock + pocketbase |
| Production backend | ⏳ фазы 3.4–6 |
| Frontend polish (фаза 0) | ✅ |
| **Текущая фаза** | **3** |
| **Следующий шаг** | **3.4** — Email channel (optional) |
| Тесты | 543 (44 files; 4 skipped) |
| Graphify | см. `stack.mdc` §42 |

Полный чеклист реализации — `stack.mdc` §16.

---

## 3. Принятые решения

| Вопрос | Решение |
|--------|---------|
| Backend | **PocketBase** |
| API mode | `VITE_API_MODE=mock` (dev) / `pocketbase` (prod) |
| Env | `VITE_API_URL` — URL PocketBase instance |
| Адаптер | `src/services/api/pocketbase/*` → контракты `types.ts` |
| Realtime chat | PocketBase subscriptions → `ChatRealtimeService` |
| Файлы | PocketBase storage + signed URLs |
| Push | Web Push + PB hooks (фаза 3) |
| SMS recovery | Stub UI до выбора провайдера |

---

## 4. Протокол сессии (кратко)

1. Прочитать: `ROADMAP.md` (этот файл) → `stack.mdc` §16 + §42 → `PROJECT_SPEC.md`.
2. `graphify query "<тема>"` — связи в коде.
3. Взять **один** пункт из текущей фазы (не перескакивать фазы без причины).
4. Реализовать → `npm run test` + `typecheck`.
5. Конец сессии: `graphify update .` → обновить `stack.mdc` (версия, §16, §42, stats, тесты).
6. Отметить выполненный пункт в §7 этой таблицы (или в stack §42).

Handoff для пользователя (новый чат):

```
Ознакомься с ROADMAP.md и stack.mdc §42. graphify query по теме. Выполни следующий шаг из roadmap.
Обнови stack.mdc и graphify update.
```

---

## 5. Архитектура пути к production

```
[Done]  UI + Domain + mock/* APIs
           ↓
[Phase 0] Frontend polish (mock) — закрыть пробелы PROJECT_SPEC
           ↓
[Phase 1] PocketBase schema + auth + seed
           ↓
[Phase 2] API adapter по модулям (types.ts contracts)
           ↓
[Phase 3] Files + realtime + push
           ↓
[Phase 4] Admin audit + school settings
           ↓
[Phase 5] Hardening + E2E + a11y
           ↓
[Phase 6] Deploy (CI, hosting, env docs)
```

---

## 6. Фазы

### Фаза 0 — Frontend polish (mock)

Закрыть пробелы PROJECT_SPEC без backend. **Один пункт = одна сессия.**

| ID | Задача | Файлы | P | Статус |
|----|--------|-------|---|--------|
| 0.1 | Settings: UI аккаунта (имя, телефон) | `SettingsPage.tsx`, `mock/index.ts` | P2 | ✅ |
| 0.2 | Avatar upload + crop + fallback | `AvatarUpload`, `UsersApi` | P2 | ✅ |
| 0.3 | Учебный аудиоплеер (seek, duration, speed, volume) | `components/ui/AudioPlayer.tsx` | P2 | ✅ |
| 0.4 | Lesson detail: материалы + chat link + teacher notes | `LessonDetailPage.tsx`, types | **P1** | ✅ |
| 0.5 | Home: блок ближайших ДЗ (student) | `HomePage.tsx` | P2 | ✅ |
| 0.6 | Availability: UI исключений/отпусков | `AvailabilityPage.tsx` | P2 | ✅ |
| 0.7 | Assignment feedback: audio comment | `AssignmentDetailPage.tsx` | P2 | ✅ |
| 0.8 | Events: competition form + imageUrl | `EventDetailPage.tsx` | P2 | ✅ |
| 0.9 | PWA install prompt | hook + `AppLayout` | P2 | ✅ |
| 0.10 | Public detail `/directions/:id`, `/teachers/:id` | `router.tsx`, new pages | P3 | ✅ |
| 0.11 | Admin: events CRUD, school settings stub | admin pages | P2 | ✅ |
| 0.12 | Notification preferences UI (mock toggles) | Settings + types | P2 | ✅ |
| 0.13 | Password recovery flow (UI + mock stub) | Login + auth API | P2 | ✅ |

**Критерий завершения:** все P1–P2 закрыты или отложены с пометкой в §7.

---

### Фаза 1 — PocketBase foundation

| ID | Задача | Детали | Статус |
|----|--------|--------|--------|
| 1.1 | Инфра | `pocketbase/` или docker-compose; `.env.example` | ✅ |
| 1.2 | Collections schema | User, Lesson, Availability, Chat, Event, Assignment, Progress, Support, Legal, Security, Notification, AuditLog | ✅ |
| 1.3 | Auth | Phone+password, JWT, login history hooks | ✅ |
| 1.4 | RBAC rules | PB API rules ↔ `permissions/index.ts` | ✅ |
| 1.5 | Seed | Порт `mocks/seed.ts` → PB seed script | ✅ |

**Критерий:** demo login через PocketBase, не mock.

---

### Фаза 2 — API adapter (по модулям)

Паттерн: `src/services/api/pocketbase/<module>.ts` → `types.ts`.

**Порядок:** Auth+Users → Lessons+Availability → Events → Chat → Assignments → Progress → Support → Legal → Security → Notifications.

Для каждого модуля:
- adapter реализует контракт;
- IDOR в PB rules + client guards;
- integration tests;
- регистрация в `createApiClient()`.

**Критично (§31):** booking lock → unique constraint + transaction; slots — server hook или эквивалент `calculateAvailableSlots`.

| Модуль | Статус |
|--------|--------|
| Auth + Users | ✅ |
| Lessons + Availability | ✅ |
| Events | ✅ |
| Chat | ✅ |
| Assignments | ✅ |
| Progress | ✅ |
| Support | ✅ |
| Legal | ✅ |
| Security | ✅ |
| Notifications | ✅ |

---

### Фаза 3 — Files, realtime, push

| ID | Задача | Статус |
|----|--------|--------|
| 3.1 | File storage (chat/assignment/support) | ✅ |
| 3.2 | Chat realtime (PB subscriptions) | ✅ |
| 3.3 | Web Push | ✅ |
| 3.4 | Email channel (optional, security) | ⏳ |

---

### Фаза 4 — Admin & audit

| ID | Задача | Статус |
|----|--------|--------|
| 4.1 | AuditLog (book/reschedule/cancel, admin, consents) | ⏳ |
| 4.2 | Admin Security extended view | ⏳ |
| 4.3 | Admin school settings | ⏳ |
| 4.4 | Admin events management | ⏳ |

---

### Фаза 5 — Production hardening

| ID | Задача | Статус |
|----|--------|--------|
| 5.1 | E2E smoke (Playwright) | ⏳ |
| 5.2 | Security review / IDOR audit | ⏳ |
| 5.3 | Performance (React Query, pagination) | ⏳ |
| 5.4 | Accessibility pass | ⏳ |
| 5.5 | Error boundaries + logging (optional) | ⏳ |

---

### Фаза 6 — Deploy

| ID | Задача | Статус |
|----|--------|--------|
| 6.1 | CI: typecheck + lint + test + build | ⏳ |
| 6.2 | Hosting: static (Vite) + PB | ⏳ |
| 6.3 | Env docs + deploy checklist | ⏳ |
| 6.4 | PWA prod: HTTPS, SW update strategy | ⏳ |

---

## 7. Вне scope (явно отложено)

- Повторяющиеся занятия
- Дата рождения
- YCLIENTS
- Offline sync критических операций
- Полноценный SMS password recovery (до провайдера)
- Admin schedule dual queries (намеренно, см. stack §21)

---

## 8. Рекомендуемый порядок сессий

1. **1.5** → **2.x** — seed, then adapter
4. Остальные 0.x по приоритету
5. **3–6** — после adapter core

---

## 9. Env (production checklist)

```env
VITE_API_MODE=pocketbase
VITE_API_URL=https://api.example.com
```

Deploy checklist (фаза 6.3):
- [ ] HTTPS на frontend и PB
- [ ] PB admin panel защищён
- [ ] CORS настроен
- [ ] Backup PB data
- [x] `.env.example` в репо (без секретов)

---

## 10. Changelog roadmap

| Дата | Изменение |
|------|-----------|
| 2026-09-02 | Seed: убраны placeholder-файлы ДЗ/занятий/мероприятий; next: 3.4 |
| 2026-09-02 | Production cutover: no demo login UI; PB assignments/groups + public adapter; next: 3.4 |
| 2026-08-31 | v1.0 — initial roadmap; backend: PocketBase; фаза 0, next: 0.4 |
| 2026-08-31 | 0.4 ✅ — Lesson detail materials + chat link + teacher notes; next: 0.5 |
| 2026-08-31 | 0.5 ✅ — Home assignments block (student); next: 0.6 |
| 2026-08-31 | 0.6 ✅ — Availability exceptions/vacations UI; next: 0.7 |
| 2026-08-31 | 0.7 ✅ — Assignment feedback audio comment; next: 0.8 |
| 2026-08-31 | 0.8 ✅ — Events competition form + imageUrl; next: 0.9 |
| 2026-08-31 | 0.10 ✅ — Public detail `/directions/:id`, `/teachers/:id`; next: 0.11 |
| 2026-08-31 | 0.11 ✅ — Admin events CRUD + school settings stub; next: 0.12 |
| 2026-08-31 | 0.12 ✅ — Notification preferences UI (mock toggles); next: 0.13 |
| 2026-08-31 | 0.13 ✅ — Password recovery flow (UI + mock stub); next: 0.1 |
| 2026-08-31 | 0.1 ✅ — Settings account UI (name, phone); next: 0.2 |
| 2026-08-31 | 0.2 ✅ — Avatar upload + crop + fallback; next: 0.3 |
| 2026-08-31 | 0.3 ✅ — Audio player; фаза 0 complete; next: 1.1 |
| 2026-08-31 | 1.5 ✅ — PB seed script (`npm run pb:seed`, mocks/seed.ts → collections); next: 2.1 |
| 2026-08-31 | 1.4 ✅ — PB RBAC API rules (29 collections ↔ permissions/index.ts); next: 1.5 |
| 2026-08-31 | 1.3 ✅ — PB auth hooks (phone login, login_history, failed_login alert); next: 1.4 |
| 2026-08-31 | 1.2 ✅ — PB collections schema (28 collections, migrations); next: 1.3 |
| 2026-08-31 | 1.1 ✅ — PocketBase infra (docker-compose, pocketbase/, .env.example); next: 1.2 |
| 2026-08-31 | 3.3 ✅ — Web Push (push_subscriptions, SW handlers, Settings subscribe, PB hook + relay); next: 3.4 |
| 2026-08-31 | 3.2 ✅ — Chat realtime (PB subscriptions → messages/conversations/members); next: 3.3 |
| 2026-08-31 | 3.1 ✅ — File storage (kvartira_files, signed URLs, chat/assignment/support adapters); next: 3.2 |
| 2026-08-31 | 2.10 ✅ — PocketBase adapter Notifications (list/read, preferences, create/update hooks); next: 3.1 |
| 2026-08-31 | 2.9 ✅ — PocketBase adapter Security (sessions, password, alerts, login hooks); next: 2.10 |
| 2026-08-31 | 2.8 ✅ — PocketBase adapter Legal (documents, consents, publish hooks); next: 2.9 |
| 2026-08-31 | 2.7 ✅ — PocketBase adapter Support (FAQ, tickets, admin reply hooks); next: 2.8 |
| 2026-08-31 | 2.6 ✅ — PocketBase adapter Progress (skills/goals/achievements, 0–10↔0–100, assigned-student hooks); next: 2.7 |
| 2026-08-31 | 2.5 ✅ — PocketBase adapter Assignments (create/submit/review, field-lock hooks); next: 2.6 |
| 2026-08-31 | 2.4 ✅ — PocketBase adapter Chat (messages, members, mute/pin/search, lastMessage + read receipt hooks); next: 2.5 |
| 2026-08-31 | 2.3 ✅ — PocketBase adapter Events (register/unregister, admin CRUD, capacity hook); next: 2.4 |
