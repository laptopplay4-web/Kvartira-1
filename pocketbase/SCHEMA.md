# PocketBase schema — «Квартира»

ROADMAP **1.2** · миграция `pb_migrations/1788148800_kvartira_schema.js`

> Источник типов: `src/types/index.ts` · демо-данные: `src/mocks/seed.ts`  
> API rules: **RBAC 1.4** — см. **`RBAC.md`** · миграция `1788326400_kvartira_rbac_rules.js`

## Коллекции

| PB collection | TS type / domain | Ключевые поля |
|---------------|------------------|---------------|
| `users` *(auth)* | `User` | phone, role, firstName, lastName, avatarUrl, bio, directionIds (json, teachers) |
| `directions` | `Direction` | name, description, icon |
| `teacher_availability` | `TeacherAvailability` | teacher, schedule (json), exceptions, planningPeriod (json) |
| `lessons` | `Lesson` | student, teacher, direction, date, startTime, status |
| `lesson_history` | `LessonHistoryEntry` | lesson, action, user |
| `conversations` | `Conversation` | type, title, participantIds, metadata |
| `conversation_members` | `ConversationMember` | conversation, user, role, muted |
| `messages` | `Message` | conversation, sender, text, attachments (json) |
| `events` | `SchoolEvent` | type, date, registeredUserIds |
| `event_registrations` | `EventRegistration` | event, user, application |
| `assignments` | `Assignment` | teacher, student, materials, submission, feedback |
| `skills` | `Skill` | name, direction, maxLevel |
| `student_skill_progress` | `StudentSkillProgress` | student, skill, level |
| `progress_goals` | `ProgressGoal` | student, title, status |
| `progress_history` | `ProgressHistoryEntry` | student, type, title |
| `achievement_definitions` | `AchievementDefinition` | code, title, icon |
| `user_achievements` | `UserAchievement` | student, achievement |
| `help_articles` | `HelpArticle` | question, answer, category |
| `support_tickets` | `SupportTicket` | user, subject, attachments |
| `legal_documents` | `LegalDocument` | type, content, versionHistory |
| `user_consents` | `UserConsent` | user, document, version |
| `security_sessions` | `SecuritySession` | user, deviceLabel, isCurrent |
| `login_history` | `LoginHistoryEntry` | user, success |
| `security_alerts` | `SecurityAlert` | user, type, read |
| `notifications` | `AppNotification` | user, type, title, link |
| `notification_preferences` | `NotificationPreferences` | user, pushEnabled |
| `push_subscriptions` | Web Push endpoint | user, endpoint, p256dh, auth, userAgent |
| `school_settings` | `PublicSchoolInfo` | name, contacts (json) |
| `public_news` | `PublicNewsItem` | title, excerpt, publishedAt |
| `kvartira_files` | file storage | owner, purpose, contextId, file, mimeType, size |
| `audit_logs` | `AuditLog` | actor, action, entityType, entityId |

## Индексы (бизнес-инварианты)

| Индекс | Назначение |
|--------|------------|
| `idx_users_phone` UNIQUE | один аккаунт на телефон |
| `idx_lessons_teacher_slot` UNIQUE | anti double-booking (§31) |
| `idx_availability_teacher` UNIQUE | одно расписание на препода |
| `idx_conv_member` UNIQUE | один membership на пару |
| `idx_event_registration` UNIQUE | одна регистрация на событие |
| `idx_skill_progress` UNIQUE | один прогресс на навык |
| `idx_user_achievement` UNIQUE | достижение один раз |
| `idx_achievement_code` UNIQUE | код достижения |
| `idx_legal_doc_type` UNIQUE | один документ на тип |
| `idx_notif_prefs_user` UNIQUE | настройки на пользователя |

## Применение

```bash
npm run pb:up
# миграции применяются автоматически при старте контейнера
```

Проверка: Admin UI → Collections — все таблицы из таблицы выше.

## Auth (ROADMAP 1.3 ✅)

Вход по **телефону + паролю** через стандартный PB endpoint и server hooks в `pb_hooks/`.

| Компонент | Назначение |
|-----------|------------|
| `pb_hooks/auth.pb.js` | Поиск пользователя по `phone`, запись `login_history`, регистрация |
| `pb_hooks/lib/kvartiraAuth.js` | Нормализация +79XXXXXXXXX, IP/устройство, алерт `failed_login` |
| `pb_migrations/1788235200_kvartira_auth_config.js` | `users.email` optional (синтетический email из phone) |

**Запрос входа (JWT в ответе — встроенный PB token):**

```http
POST /api/collections/users/auth-with-password
Content-Type: application/json

{ "identity": "+79001234567", "password": "student123" }
```

Hook `onRecordAuthWithPasswordRequest` подставляет запись по полю `phone`, если поиск по email не нашёл пользователя.

**Регистрация:** `POST /api/collections/users/records` с `phone`, `password`, `passwordConfirm`, `firstName`, `lastName` — hook выставляет `role=student` и email `{digits}@kvartira.local`.

**История входов:** `onRecordAuthRequest` → коллекция `login_history`; неверный пароль → `success: false` + `security_alerts.failed_login`.

## RBAC (ROADMAP 1.4 ✅)

API rules на всех 29 коллекциях — маппинг к `src/permissions/index.ts`.

| Компонент | Назначение |
|-----------|------------|
| `pb_migrations/1788326400_kvartira_rbac_rules.js` | Применение list/view/create/update/delete rules |
| `pb_hooks/lib/kvartiraRbac.js` | Фрагменты правил (`COLLECTION_RULES`) — sync с миграцией |
| `RBAC.md` | Таблица коллекций ↔ permissions |

Ключевые IDOR-паттерны: lesson/assignment participant, conversation membership (`@collection.conversation_members`), own-row для security/notifications.

## Seed (ROADMAP 1.5 ✅)

Демо-данные из `src/mocks/seed.ts` → `npm run pb:seed` (`pocketbase/seed/`).

| Компонент | Назначение |
|-----------|------------|
| `pocketbase/seed/index.ts` | CLI: superuser auth + запуск |
| `pocketbase/seed/run.ts` | Создание записей во всех коллекциях |
| `pocketbase/seed/helpers.ts` | phone→email, маппинг ID, шкала навыков 0–10 |
| `pocketbase/seed/pbClient.ts` | HTTP-клиент PocketBase |

Идемпотентность: пропуск, если `users.phone = +79001234567` уже существует.

## Events adapter (ROADMAP 2.3 ✅)

`src/services/api/pocketbase/events.ts` — контракт `EventsApi`.

| Компонент | Назначение |
|-----------|------------|
| `pocketbase/events.ts` | list/detail, register/unregister, admin CRUD |
| `mappers.ts` `mapEventRecord` / `mapEventRegistrationRecord` | PB → `SchoolEvent` / `EventRegistration` |
| `pb_hooks/events.pb.js` | лимит мест + sync `registeredUserIds` |
| `pb_hooks/lib/kvartiraEvents.js` | capacity check, sync helper |
| Client IDOR | `canViewSchoolEvent` (invited), `canManageEventsAdmin` |

**Запись:** `event_registrations` (unique `idx_event_registration`); hook обновляет `events.registeredUserIds` — иначе ученик не видит чужие записи из-за own-row RBAC. Конкурсная заявка — json `application`. Достижения при записи — до Progress adapter.

## Chat adapter (ROADMAP 2.4 ✅)

`src/services/api/pocketbase/chat.ts` — контракт `ChatApi`.

| Компонент | Назначение |
|-----------|------------|
| `pocketbase/chat.ts` | conversations, messages, members, mute, pin, search, attachments JSON |
| `mappers.ts` `mapConversationRecord` / `mapMessageRecord` / `mapConversationMemberRecord` | PB → chat types |
| `pb_hooks/chat.pb.js` | lastMessage sync + read receipts |
| `pb_hooks/lib/kvartiraChat.js` | `syncConversationLastMessage`, `syncReadReceipts` |
| `pb_migrations/1788585600_kvartira_chat_adapter.js` | owner/admin может удалять участников группы |
| Client IDOR | `canAccessConversation`, `canSendToConversation`, `canEditMessage`, … |

**Вложения:** json + `pbfile:` refs → `kvartira_files` (фаза 3.1). **Realtime:** PB subscriptions → `ChatRealtimeService` (фаза 3.2 ✅).

## Assignments adapter (ROADMAP 2.5 ✅)

`src/services/api/pocketbase/assignments.ts` — контракт `AssignmentsApi`.

| Компонент | Назначение |
|-----------|------------|
| `pocketbase/assignments.ts` | list/detail, create, submit, review, upload (dataUrl) |
| `mappers.ts` `mapAssignmentRecord` | PB → `Assignment` (`teacher`/`student`/`lesson` → *Id) |
| `pb_hooks/assignments.pb.js` | create teacher lock + submit/review field lock |
| `pb_hooks/lib/kvartiraAssignments.js` | `assertAssignmentCreate`, `assertAssignmentUpdate` |
| Client IDOR | `canViewAssignment`, `canCreateAssignment`, `canSubmitAssignment`, `canReviewAssignment` |

**Создание:** преподаватель → `status: assigned`. **Сдача:** ученик пишет только `submission` + `submitted`. **Проверка:** преподаватель пишет только `feedback` + `reviewed`. **Вложения:** `kvartira_files` + signed URLs (фаза 3.1 ✅). Уведомление ученику — до Notifications adapter. Unlock достижений — Progress adapter (2.6).

## Progress adapter (ROADMAP 2.6 ✅)

`src/services/api/pocketbase/progress.ts` — контракт `ProgressApi`.

| Компонент | Назначение |
|-----------|------------|
| `pocketbase/progress.ts` | summary, skills, goals CRUD, history, achievements, auto-unlock |
| `mappers.ts` `mapSkillRecord` / `mapProgressGoalRecord` / … | PB → progress types; skill 0–10 ↔ 0–100 |
| `pb_hooks/progress.pb.js` | teacher writes only assigned students |
| `pb_hooks/lib/kvartiraProgress.js` | `assertProgressCreate` / `assertProgressUpdate` / `teacherHasStudent` |
| `pb_migrations/1788672000_kvartira_progress_adapter.js` | student may create own unlocks + history |
| Client IDOR | `canViewStudentProgress`, `canManageStudentGoals`, `canManageStudentSkills` |

**Шкала навыков:** в PB `maxLevel`/`level` 0–10, в UI 0–100 (`toPbSkillLevel` / `fromPbSkillLevel`). **Достижения:** `evaluateAndUnlockAchievements` при чтении summary/achievements и после updateSkillProgress. Уведомление «Новое достижение» пишется в `notifications`.

## Support adapter (ROADMAP 2.7 ✅)

`src/services/api/pocketbase/support.ts` — контракт `SupportApi`.

| Компонент | Назначение |
|-----------|------------|
| `pocketbase/support.ts` | FAQ, tickets, create/reply, attachments (dataUrl) |
| `mappers.ts` `mapHelpArticleRecord` / `mapSupportTicketRecord` | PB → support types |
| `pb_hooks/support.pb.js` | create user lock + admin-only reply/status |
| `pb_hooks/lib/kvartiraSupport.js` | `assertTicketCreate`, `assertTicketUpdate` |
| Client IDOR | `canViewTicket`, `canCreateTicket`, `canReplyToTicket`, `canManageFaq` |

**Создание:** пользователь → `status: open`. **Ответ:** только admin → `adminReply` + `answered`/`closed`. FAQ CRUD — admin (`support:manage-faq`). **Вложения:** `kvartira_files` + signed URLs (фаза 3.1 ✅).

## File storage (ROADMAP 3.1 ✅)

`src/services/api/pocketbase/files.ts` — загрузка и signed URLs для chat/assignment/support.

| Компонент | Назначение |
|-----------|------------|
| `kvartira_files` collection | owner, purpose (`chat`/`assignment`/`support`), contextId, file field |
| `pocketbase/files.ts` | `uploadStoredFile`, `resolveStoredFileUrl`, `linkStoredFilesToContext` |
| `pb_migrations/1788758400_kvartira_files_storage.js` | collection + RBAC (participants IDOR) |
| `pb_hooks/files.pb.js` | owner lock on create; immutable metadata on update |
| Adapters | `chat.ts`, `assignments.ts`, `support.ts` — upload → PB storage; read → signed URL |

**Доступ:** admin · owner · участник чата / задания / обращения по `contextId`. Ссылки в JSON: `pbfile:{recordId}`.

## Следующие шаги

- **3.2** — Chat realtime (PB subscriptions)
