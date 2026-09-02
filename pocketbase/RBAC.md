# PocketBase RBAC — API rules

ROADMAP **1.4** · миграция `pb_migrations/1788326400_kvartira_rbac_rules.js`  
Источник прав: `src/permissions/index.ts` + `services/*/access.ts`

> Фрагменты правил: `pb_hooks/lib/kvartiraRbac.js` (`COLLECTION_RULES`) — держать в sync с миграцией.

## Роли

| PB `@request.auth.role` | TS `UserRole` | Ключевые permissions |
|-------------------------|---------------|----------------------|
| `student` | `student` | `lessons:view-own`, `lessons:book`, `chat:read`, … |
| `teacher` | `teacher` | `lessons:view-assigned`, `availability:manage`, `assignments:create`, … |
| `admin` | `admin` | `lessons:view-all`, `admin:*`, `admin:users`, `legal:manage`, … |

## Паттерны правил

| Паттерн | Permission / access helper | PB выражение |
|---------|---------------------------|--------------|
| Admin only | `admin:*`, `legal:manage`, … | `@request.auth.role = "admin"` |
| Authenticated | любой logged-in | `@request.auth.id != ""` |
| Public read | landing, legal, FAQ | `""` (пустое правило) |
| Own row | `profile:*`, `security:view-own` | `user = @request.auth.id` |
| Lesson participant | `canViewLesson` | `student/teacher = @request.auth.id` |
| Assignment participant | `canViewAssignment` | `student/teacher = @request.auth.id` |
| Chat member | `canAccessConversation` | `@collection.conversation_members…` |
| Own message edit | `chat:delete_message` | `sender = @request.auth.id` |

## Коллекции

| Collection | list/view | create | update | delete |
|------------|-----------|--------|--------|--------|
| `users` | auth (`lessons/chat UI`) | public (register hook) | self · admin; **роль** только admin, student↔teacher | superuser |
| `directions` | public | admin | admin | admin |
| `teacher_availability` | auth (booking) · owner · admin | teacher own · admin | teacher own · admin | teacher own · admin |
| `lessons` | participant · admin | student own · admin | participant · admin | participant · admin |
| `lesson_history` | lesson participant · admin | auth | admin | admin |
| `conversations` | member · admin | auth | member · admin | owner · admin |
| `conversation_members` | member · self · admin | auth | self · admin | self · owner/admin of conv · admin |
| `messages` | conv member · admin | member | sender · admin | sender · admin |
| `events` | public (adapter hides `invited`) | teacher · admin | teacher · admin | teacher · admin |
| `event_registrations` | own · admin | own · admin | own · admin | own · admin |
| `assignments` | group members · general · teacher · admin | teacher · admin | teacher · admin | teacher · admin |
| `assignment_groups` | members · general · teacher · admin | teacher · admin | owner teacher · admin | owner teacher · admin |
| `skills` | auth | teacher · admin | teacher · admin | admin |
| `student_skill_progress` | student · teacher · admin | teacher · admin | teacher · admin | admin |
| `progress_goals` | student · teacher · admin | teacher · admin | teacher · admin | teacher · admin |
| `progress_history` | student · teacher · admin | own · teacher · admin | admin | admin |
| `achievement_definitions` | auth | admin | admin | admin |
| `user_achievements` | student · teacher · admin | own · teacher · admin | admin | admin |
| `help_articles` | public (`support:view-faq`) | admin (`support:manage-faq`) | admin | admin |
| `support_tickets` | own · admin | auth own | own · admin | admin |
| `legal_documents` | public | admin (`legal:manage`) | admin | admin |
| `user_consents` | own · admin | own · admin | admin | admin |
| `security_sessions` | own · admin | auth | own · admin | own · admin |
| `login_history` | own · admin | auth (hooks) | admin | admin |
| `security_alerts` | own · admin | auth (hooks) | own · admin | admin |
| `notifications` | own · admin | auth | own · admin | own · admin |
| `notification_preferences` | own · admin | own · admin | own · admin | admin |
| `school_settings` | public | admin (`admin:school-settings`) | admin | admin |
| `public_news` | public | admin | admin | admin |
| `kvartira_files` | owner · chat/assignment/ticket participants · admin | auth (owner=self) | owner · admin (contextId only) | owner · admin |
| `audit_logs` | admin | null (hooks) | null | null |

## IDOR на фазе 2

PB rules — первый барьер. Адаптер (`src/services/api/pocketbase/`) дополнительно использует `can()` и `services/*/access.ts` (например, teacher видит progress только assigned students — уточнение в adapter).

## Применение

```bash
npm run pb:up
# миграция 1788326400_kvartira_rbac_rules.js применяется автоматически
```

Откат: down-миграция сбрасывает правила в `null` (locked).
