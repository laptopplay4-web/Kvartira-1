# Graph Report - Kvartira 1  (2026-09-01)

## Corpus Check
- 314 files · ~137,084 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2032 nodes · 2155 edges · 296 communities (192 shown, 104 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- КВАРТИРА — PROJECT SPECIFICATION
- devDependencies
- types.ts
- dependencies
- КВАРТИРА — DEVELOPMENT RULES FOR CURSOR
- router.tsx
- КВАРТИРА — DESIGN SYSTEM
- compilerOptions
- types/index.ts
- compilerOptions
- run.ts
- mock/index.ts
- Button.tsx
- LessonCard.tsx
- calculateSlots.ts
- 6. Занятия
- BottomNav.tsx
- Logo.tsx
- permissions/index.ts
- dates.ts
- Avatar.tsx
- Skeleton.tsx
- useOnlineStatus.ts
- LoginPage.tsx
- RegisterPage.tsx
- authStore.ts
- permissions.test.ts
- EmptyState.tsx
- Input.tsx
- MobileHeader.tsx
- AdminUsersPage.tsx
- EventDetailPage.tsx
- BookLessonPage.tsx
- LessonsPage.tsx
- api/index.ts
- booking.test.ts
- slots.test.ts
- vite-env.d.ts
- tsconfig.json
- clean-rules.mjs
- LessonsApi
- chat/helpers.ts
- chat/validation.ts
- HomePage.tsx
- lessonStatus.ts
- LessonCalendar.tsx
- lessonAccess.test.ts
- validateAvailability.ts
- formHelpers.ts
- AvailabilityPage.tsx
- helpers.ts
- 16. Профили
- useCalendarLessons.ts
- calendarRanges.ts
- 3. Роли
- calendar.test.ts
- 8. Чат
- ChatApi
- chat/access.ts
- ConversationList.tsx
- useSendMessage.ts
- ChatRealtimeService
- ChatFilters.tsx
- ImageViewer.tsx
- CreateChatModal.tsx
- MessageSearchResults.tsx
- PinnedMessageBar.tsx
- ChatHeader.tsx
- MessageComposer.tsx
- TypingIndicator.tsx
- assignments/validation.ts
- home.test.tsx
- nav.test.tsx
- routes.test.tsx
- AdminPageHeader.tsx
- AuthApi
- EventsApi
- NotificationsApi
- UsersApi
- AvailabilityApi
- layouts.test.tsx
- offline.test.tsx
- AssignmentsApi
- assignments.test.ts
- assignments/helpers.ts
- AssignmentDetailPage.tsx
- assignmentStatus.ts
- CreateAssignmentPage.tsx
- AssignmentFilePicker.tsx
- assignments/constants.ts
- ProgressApi
- progress/helpers.ts
- progress.test.ts
- AchievementBadge.tsx
- SkillProgressBar.tsx
- AchievementDefinition
- Skill
- achievements.ts
- HomeProgressBlock.tsx
- SupportApi
- support/helpers.ts
- TeacherProgressControls.tsx
- SupportTicketStatusBadge.tsx
- HelpPage.tsx
- support.test.ts
- SupportTicketFilters.tsx
- SupportAttachmentList.tsx
- support/constants.ts
- FaqArticleModal.tsx
- LegalApi
- legal/helpers.ts
- PublicLandingContent.tsx
- public/helpers.ts
- security.ts
- PublicApi
- public/constants.ts
- SecurityApi
- security/validation.ts
- security/helpers.ts
- chat.ts
- assignments.ts
- progress.ts
- support.ts
- public.ts
- legal/access.ts
- legal.ts
- LegalPublishVersionModal.tsx
- legal/constants.ts
- LegalDocumentEditModal.tsx
- Квартира — Production Roadmap
- theme/constants.ts
- lessonDetail.test.ts
- lessons/helpers.ts
- HomeAssignmentsBlock.tsx
- CompetitionApplicationModal.tsx
- events/constants.ts
- events/validation.ts
- pwa/helpers.ts
- EventFormModal.tsx
- schoolSettings.ts
- PublicDetailHeader.tsx
- Direction
- SchoolSettingsApi
- mock/notifications.ts
- pocketbaseSeed.test.ts
- notifications/constants.ts
- Toggle.tsx
- profile/validation.ts
- auth/validation.ts
- ResetPasswordPage.tsx
- ForgotPasswordPage.tsx
- avatar.ts
- messages.ts
- attachments.ts
- AvatarCropModal.tsx
- AvatarUpload.tsx
- audio/helpers.ts
- AvatarActionSheet.tsx
- AudioPlayer.tsx
- PocketBase — локальный backend «Квартира»
- AvatarProfileMenu.tsx
- AvatarPhotoViewer.tsx
- PocketBase schema — «Квартира»
- pocketbaseSchema.test.ts
- kvartiraAuth.js
- pocketbaseAuth.test.ts
- providers.tsx
- AvailabilityMonthCalendar.tsx
- layouts.tsx
- AvailabilityIntervalModal.tsx
- PocketBase RBAC — API rules
- pocketbaseRbac.test.ts
- 1788326400_kvartira_rbac_rules.js
- kvartiraRbac.js
- availability.ts
- client.ts
- errors.ts
- mappers.ts
- auth.ts
- users.ts
- pocketbaseAdapter.test.ts
- pocketbase/helpers.ts
- events.ts
- kvartiraEvents.js
- kvartiraChat.js
- pocketbase/assignments.ts
- kvartiraAssignments.js
- pocketbase/chat.ts
- pocketbase/progress.ts
- lessons.ts
- loadEvaluationData
- asIdList
- kvartiraProgress.js
- pocketbase/support.ts
- kvartiraSupport.js
- pocketbase/legal.ts
- kvartiraLegal.js
- pocketbase/security.ts
- kvartiraNotifications.js
- pocketbase/notifications.ts
- pocketbase/files.ts
- PocketBaseChatRealtimeService
- chatRealtime.test.ts
- push/helpers.ts
- kvartiraPush.js
- push-relay.mjs
- useWebPush.ts
- webPush.test.ts
- test-pb-progress.mjs

## God Nodes (most connected - your core abstractions)
1. `КВАРТИРА — PROJECT SPECIFICATION` - 34 edges
2. `КВАРТИРА — DEVELOPMENT RULES FOR CURSOR` - 31 edges
3. `КВАРТИРА — DESIGN SYSTEM` - 26 edges
4. `ChatApi` - 25 edges
5. `compilerOptions` - 20 edges
6. `runSeed()` - 16 edges
7. `compilerOptions` - 16 edges
8. `PocketBase schema — «Квартира»` - 14 edges
9. `scripts` - 13 edges
10. `LessonsApi` - 11 edges

## Surprising Connections (you probably didn't know these)
- `runSeed()` --calls--> `createDefaultNotificationPreferences()`  [EXTRACTED]
  pocketbase/seed/run.ts → src/services/notifications/helpers.ts
- `runSeed()` --calls--> `toPbSkillLevel()`  [EXTRACTED]
  pocketbase/seed/run.ts → src/services/progress/skillLevel.ts
- `getAssignedIdsForRequester()` --indirect_call--> `mapLessonRecord()`  [INFERRED]
  src/services/api/pocketbase/progress.ts → src/services/api/pocketbase/mappers.ts
- `loadEvaluationData()` --indirect_call--> `mapLessonRecord()`  [INFERRED]
  src/services/api/pocketbase/progress.ts → src/services/api/pocketbase/mappers.ts
- `loadEvaluationData()` --indirect_call--> `mapEventRecord()`  [INFERRED]
  src/services/api/pocketbase/progress.ts → src/services/api/pocketbase/mappers.ts

## Import Cycles
- None detected.

## Communities (296 total, 104 thin omitted)

### Community 0 - "КВАРТИРА — PROJECT SPECIFICATION"
Cohesion: 0.06
Nodes (30): 10. Аудио, 11. Домашние задания, 12. Обратная связь, 13. Прогресс, 14. Достижения, 15. Мероприятия, 17. Настройки, 18. Уведомления (+22 more)

### Community 1 - "devDependencies"
Cohesion: 0.04
Nodes (47): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom, devDependencies, eslint (+39 more)

### Community 2 - "types.ts"
Cohesion: 0.06
Nodes (33): ApiClient, ApiError, ChangePasswordInput, CompletePasswordResetInput, CreateAssignmentInput, CreateConversationInput, CreateEventInput, CreateHelpArticleInput (+25 more)

### Community 3 - "dependencies"
Cohesion: 0.05
Nodes (42): clsx, date-fns, @hookform/resolvers, lucide-react, dependencies, clsx, date-fns, @hookform/resolvers (+34 more)

### Community 4 - "КВАРТИРА — DEVELOPMENT RULES FOR CURSOR"
Cohesion: 0.06
Nodes (31): 10. Validation, 11. Forms, 12. Authentication, 13. Files, 14. PWA, 15. Responsive, 16. Accessibility, 17. State handling (+23 more)

### Community 5 - "router.tsx"
Cohesion: 0.06
Nodes (34): AdminEventsPage, AdminLegalPage, AdminSchedulePage, AdminSchoolSettingsPage, AdminUsersPage, appRoutes, AssignmentDetailPage, AssignmentsPage (+26 more)

### Community 6 - "КВАРТИРА — DESIGN SYSTEM"
Cohesion: 0.07
Nodes (26): 10. Cards, 11. Calendar, 12. Forms, 13. Чат, 14. Аудио, 15. Notifications, 16. Empty states, 17. Error states (+18 more)

### Community 7 - "compilerOptions"
Cohesion: 0.08
Nodes (25): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, baseUrl, jsx (+17 more)

### Community 8 - "types/index.ts"
Cohesion: 0.03
Nodes (77): AppNotification, Assignment, AssignmentDisplayStatus, AssignmentFeedback, AssignmentMaterial, AssignmentResponseType, AssignmentStatus, AssignmentSubmission (+69 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): ES2023, vite.config.ts, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution (+11 more)

### Community 10 - "run.ts"
Cohesion: 0.05
Nodes (53): ID_ALIASES, IdMap, passwordForPhone(), patchRecordTimestamps(), phoneToEmail(), remapLink(), remapMetadata(), env() (+45 more)

### Community 11 - "mock/index.ts"
Cohesion: 0.08
Nodes (21): assertAvailabilityAccess(), assertEventsAdminAccess(), assertLessonAccess(), db, getUserById(), mockAssignmentsApi, mockAuthApi, mockAvailabilityApi (+13 more)

### Community 12 - "Button.tsx"
Cohesion: 0.13
Nodes (10): BookLessonLinkProps, Button, ButtonProps, Size, sizes, Variant, variants, ErrorStateProps (+2 more)

### Community 13 - "LessonCard.tsx"
Cohesion: 0.16
Nodes (10): AssignmentStatusBadgeProps, Badge(), BadgeProps, variants, Card(), CardProps, paddingMap, LessonCardProps (+2 more)

### Community 14 - "calculateSlots.ts"
Cohesion: 0.44
Nodes (9): calculateAvailableSlots(), CalculateSlotsParams, formatTime(), getDayRanges(), lessonOverlapsSlot(), parseTime(), rangesOverlap(), slotsConflict() (+1 more)

### Community 15 - "6. Занятия"
Cohesion: 0.25
Nodes (8): 6. Занятия, Доступность преподавателя, Запись, История, Карточка занятия, Отмена, Перенос, Статусы

### Community 17 - "Logo.tsx"
Cohesion: 0.40
Nodes (3): LogoProps, LogoSize, sizeClasses

### Community 19 - "dates.ts"
Cohesion: 0.08
Nodes (19): AttachmentList(), AttachmentListProps, MessageActions(), MessageActionsProps, MessageBubble(), MessageBubbleProps, cnSkeleton(), MessageList (+11 more)

### Community 23 - "useOnlineStatus.ts"
Cohesion: 0.60
Nodes (4): getSnapshot(), OFFLINE_NETWORK_MESSAGE, subscribe(), useOnlineStatus()

### Community 26 - "authStore.ts"
Cohesion: 0.67
Nodes (3): AuthState, useAuthStore, useCurrentUser()

### Community 27 - "permissions.test.ts"
Cohesion: 0.50
Nodes (3): admin, student, teacher

### Community 36 - "LessonsPage.tsx"
Cohesion: 0.40
Nodes (3): HISTORY_FILTERS, HistoryFilter, PageView

### Community 46 - "chat/helpers.ts"
Cohesion: 0.12
Nodes (17): LAST_MESSAGE_PREVIEW_LENGTH, MESSAGE_SEARCH_MIN_LENGTH, buildMessageListWithSeparators(), ChatFilter, ChatListEntry, DateSeparator, filterConversations(), getConversationDisplayTitle() (+9 more)

### Community 47 - "chat/validation.ts"
Cohesion: 0.13
Nodes (20): ALLOWED_AUDIO_MIMES, ALLOWED_DOCUMENT_MIMES, ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES, DRAFT_STORAGE_PREFIX, MAX_ATTACHMENTS_PER_MESSAGE, MAX_AUDIO_SIZE, MAX_DOCUMENT_SIZE (+12 more)

### Community 48 - "HomePage.tsx"
Cohesion: 0.47
Nodes (4): HomePage(), isUpcomingLesson(), StatCardProps, todayISO()

### Community 59 - "LessonCalendar.tsx"
Cohesion: 0.11
Nodes (17): CalendarLessonItem(), CalendarLessonItemProps, CalendarNav(), CalendarNavProps, CalendarViewSwitcher(), CalendarViewSwitcherProps, VIEWS, DayView() (+9 more)

### Community 60 - "lessonAccess.test.ts"
Cohesion: 0.33
Nodes (5): admin, lesson, otherStudent, student, teacher

### Community 62 - "validateAvailability.ts"
Cohesion: 0.32
Nodes (12): AvailabilityValidationError, hasOverlappingBreaks(), isBreakWithinWorkPeriod(), isValidTimeRange(), parseTime(), rangesOverlap(), SLOT_INTERVAL_OPTIONS, validateAvailabilityExceptions() (+4 more)

### Community 63 - "formHelpers.ts"
Cohesion: 0.11
Nodes (17): ALL_WEEKDAYS, AvailabilityFormState, availabilityToForm(), createDefaultExceptionItem(), createDefaultFormState(), createExceptionId(), customExceptionsFromApi(), DEFAULT_WORK_HOURS (+9 more)

### Community 64 - "AvailabilityPage.tsx"
Cohesion: 0.60
Nodes (4): AvailabilityPage(), getFieldError(), INTERVAL_LABELS, todayInputValue()

### Community 67 - "16. Профили"
Cohesion: 0.33
Nodes (6): 16. Профили, Аватар, Имя, Принцип, Профиль преподавателя, Профиль ученика для преподавателя

### Community 68 - "useCalendarLessons.ts"
Cohesion: 0.50
Nodes (4): CalendarFilters, calendarLessonsQueryKey(), useCalendarLessons(), UseCalendarLessonsParams

### Community 70 - "3. Роли"
Cohesion: 0.50
Nodes (4): 3. Роли, Администратор, Преподаватель, Ученик

### Community 74 - "chat/access.ts"
Cohesion: 0.22
Nodes (10): canAccessConversation(), canAddMember(), canDeleteConversation(), canLeaveConversation(), canManageMembers(), canRemoveMember(), canSendToConversation(), canUpdateConversation() (+2 more)

### Community 75 - "ConversationList.tsx"
Cohesion: 0.40
Nodes (3): ConversationItem(), ConversationItemProps, ConversationListProps

### Community 76 - "useSendMessage.ts"
Cohesion: 0.40
Nodes (3): createClientMutationId(), SendMessageVars, uid()

### Community 77 - "ChatRealtimeService"
Cohesion: 0.11
Nodes (6): ChatRealtimeCallback, ChatRealtimeEvent, ChatRealtimeEventType, ChatRealtimeService, Listener, MockChatRealtimeService

### Community 84 - "ChatHeader.tsx"
Cohesion: 0.40
Nodes (3): ChatHeaderProps, ConversationSettings(), ConversationSettingsProps

### Community 85 - "MessageComposer.tsx"
Cohesion: 0.21
Nodes (8): AttachmentPreview(), AttachmentPreviewProps, MessageComposerProps, PendingAttachment, SendPayload, ComposerReplyPreview(), ComposerReplyPreviewProps, ReplyPreviewProps

### Community 88 - "assignments/validation.ts"
Cohesion: 0.47
Nodes (3): responseTypeMatchesFile(), validateAssignmentFeedbackAudio(), validateAssignmentResponseFile()

### Community 98 - "home.test.tsx"
Cohesion: 0.11
Nodes (15): adminUser, lesson, mockGetAllUsers, mockGetAssignments, mockGetConversations, mockGetDirections, mockGetEvents, mockGetLessons (+7 more)

### Community 100 - "routes.test.tsx"
Cohesion: 0.17
Nodes (10): adminUser, mockGetAllUsers, mockGetConversations, mockGetDirections, mockGetEvents, mockGetLessons, mockGetNotifications, mockGetTeachers (+2 more)

### Community 109 - "offline.test.tsx"
Cohesion: 0.29
Nodes (4): mockGetTeacherAvailability, mockUpdateTeacherAvailability, mockUseOnlineStatus, teacherUser

### Community 112 - "assignments.test.ts"
Cohesion: 0.25
Nodes (4): baseAssignment, otherStudent, student, teacher

### Community 113 - "assignments/helpers.ts"
Cohesion: 0.43
Nodes (6): filterPendingAssignments(), getAssignmentDisplayStatus(), getUpcomingAssignmentsForHome(), HOME_ASSIGNMENTS_LIMIT, sortAssignmentsByDueDate(), todayISO()

### Community 117 - "CreateAssignmentPage.tsx"
Cohesion: 0.40
Nodes (3): FormData, RESPONSE_TYPE_OPTIONS, schema

### Community 123 - "progress/helpers.ts"
Cohesion: 0.31
Nodes (5): computeAttendanceStats(), computeProgressSummary(), isLessonAttended(), isLessonMissed(), MISSED_LESSON_STATUSES

### Community 124 - "progress.test.ts"
Cohesion: 0.29
Nodes (4): admin, otherStudent, student, teacher

### Community 130 - "achievements.ts"
Cohesion: 0.27
Nodes (12): AchievementEvaluationData, countCompletedLessons(), evaluateAndUnlockAchievements(), hasLessonRegularity(), hasPerformanceParticipation(), hasSkillMasterLevel(), isAchievementUnlocked(), isLessonCompleted() (+4 more)

### Community 134 - "TeacherProgressControls.tsx"
Cohesion: 0.22
Nodes (4): AddGoalButtonProps, CreateGoalModalProps, GoalManageActionsProps, SkillManageRowProps

### Community 142 - "SupportTicketFilters.tsx"
Cohesion: 0.33
Nodes (4): STATUS_FILTERS, SupportCategoryFilter, SupportStatusFilter, SupportTicketFiltersProps

### Community 147 - "legal/helpers.ts"
Cohesion: 0.36
Nodes (4): countPendingConsents(), getPendingConsents(), getUserConsentForDocument(), hasCurrentConsent()

### Community 150 - "security.ts"
Cohesion: 0.23
Nodes (9): resetMockDatabase(), assertViewAccess(), buildPasswordMap(), createMockSecurityApi(), getUserById(), MockSecurityDb, pushAlert(), recordAuthLogin() (+1 more)

### Community 155 - "security/validation.ts"
Cohesion: 0.40
Nodes (3): MAX_LOGIN_HISTORY_ENTRIES, MIN_PASSWORD_LENGTH, ChangePasswordInput

### Community 156 - "security/helpers.ts"
Cohesion: 0.40
Nodes (3): getLastSuccessfulLogin(), SECURITY_ALERT_LABELS, sortLoginHistoryByDate()

### Community 157 - "chat.ts"
Cohesion: 0.60
Nodes (4): createMockChatApi(), createSystemMessage(), MockChatDb, uid()

### Community 158 - "assignments.ts"
Cohesion: 0.67
Nodes (3): createMockAssignmentsApi(), MockAssignmentsDb, uid()

### Community 160 - "support.ts"
Cohesion: 0.67
Nodes (3): createMockSupportApi(), MockSupportDb, uid()

### Community 170 - "LegalPublishVersionModal.tsx"
Cohesion: 0.67
Nodes (3): LegalPublishVersionModal(), LegalPublishVersionModalProps, todayISO()

### Community 176 - "Квартира — Production Roadmap"
Cohesion: 0.11
Nodes (18): 10. Changelog roadmap, 1. Критерий «приложение закончено», 2. Текущий статус (2026-08-31), 3. Принятые решения, 4. Протокол сессии (кратко), 5. Архитектура пути к production, 6. Фазы, 7. Вне scope (явно отложено) (+10 more)

### Community 177 - "theme/constants.ts"
Cohesion: 0.38
Nodes (6): applyThemePreference(), getStoredThemePreference(), initThemePreference(), THEME_OPTIONS, THEME_STORAGE_KEY, ThemePreference

### Community 178 - "lessonDetail.test.ts"
Cohesion: 0.50
Nodes (4): createChatApi(), delay(), student, teacher

### Community 181 - "CompetitionApplicationModal.tsx"
Cohesion: 0.40
Nodes (3): CompetitionApplicationModalProps, FormData, schema

### Community 185 - "pwa/helpers.ts"
Cohesion: 0.23
Nodes (8): BeforeInstallPromptEvent, usePwaInstall(), PWA_INSTALL_DISMISS_COOLDOWN_MS, PWA_INSTALL_DISMISS_KEY, PWA_INSTALL_SHOW_DELAY_MS, canShowInstallBanner(), isPwaInstalled(), wasInstallPromptDismissedRecently()

### Community 198 - "mock/notifications.ts"
Cohesion: 0.28
Nodes (8): pushNotification(), createMockNotificationsApi(), getPreferencesForUser(), MockNotificationsDb, MockPushDelivery, MockPushSubscriptionRecord, tryPushNotification(), uid()

### Community 199 - "pocketbaseSeed.test.ts"
Cohesion: 0.22
Nodes (8): README, ROOT, SCHEMA_DOC, SEED_CLIENT, SEED_HELPERS, SEED_INDEX, SEED_RUN, SEEDED_COLLECTIONS

### Community 205 - "auth/validation.ts"
Cohesion: 0.24
Nodes (5): AUTH_PASSWORD_MIN_LENGTH, MOCK_PASSWORD_RESET_CODE, PASSWORD_RESET_CODE_LENGTH, PASSWORD_RESET_MIN_LENGTH, PASSWORD_RESET_TTL_MS

### Community 207 - "ResetPasswordPage.tsx"
Cohesion: 0.40
Nodes (3): FormData, ResetLocationState, schema

### Community 209 - "avatar.ts"
Cohesion: 0.12
Nodes (16): AvatarCropState, AvatarCropZoomBounds, AvatarUploadInput, clampCropState(), getCoverScale(), getCropZoomBounds(), getInitialCropState(), loadImageFromFile() (+8 more)

### Community 210 - "messages.ts"
Cohesion: 0.27
Nodes (7): getReplyPreviewText(), canDeleteMessage(), canEditMessage(), DELETED_MESSAGE_TEXT, getMessageDisplayText(), isMessageDeleted(), isSystemMessage()

### Community 211 - "attachments.ts"
Cohesion: 0.22
Nodes (6): createAttachmentFromFile(), detectAttachmentType(), getExtension(), maxSizeForType(), validateAttachment(), validateAttachments()

### Community 212 - "AvatarCropModal.tsx"
Cohesion: 0.43
Nodes (6): AvatarCropModal(), AvatarCropModalProps, getCenter(), getDistance(), getViewportSize(), PointerPoint

### Community 219 - "PocketBase — локальный backend «Квартира»"
Cohesion: 0.22
Nodes (8): Auth (фаза 1.3), PocketBase — локальный backend «Квартира», Seed (фаза 1.5), Быстрый старт, Команды, Переменные окружения, Структура, Требования

### Community 223 - "PocketBase schema — «Квартира»"
Cohesion: 0.13
Nodes (14): Assignments adapter (ROADMAP 2.5 ✅), Auth (ROADMAP 1.3 ✅), Chat adapter (ROADMAP 2.4 ✅), Events adapter (ROADMAP 2.3 ✅), File storage (ROADMAP 3.1 ✅), PocketBase schema — «Квартира», Progress adapter (ROADMAP 2.6 ✅), RBAC (ROADMAP 1.4 ✅) (+6 more)

### Community 224 - "pocketbaseSchema.test.ts"
Cohesion: 0.40
Nodes (4): MIGRATION, REQUIRED_COLLECTIONS, ROOT, SCHEMA_DOC

### Community 226 - "kvartiraAuth.js"
Cohesion: 0.08
Nodes (16): getClientIp(), getDeviceLabel(), isValidPhone(), normalizePhone(), phoneToEmail(), pushSecurityAlert(), recordLoginAttempt(), trimLoginHistory() (+8 more)

### Community 227 - "pocketbaseAuth.test.ts"
Cohesion: 0.33
Nodes (5): AUTH_HOOK, AUTH_LIB, AUTH_MIGRATION, ROOT, SCHEMA_DOC

### Community 230 - "providers.tsx"
Cohesion: 0.47
Nodes (3): AppProviders(), queryClient, router

### Community 231 - "AvailabilityMonthCalendar.tsx"
Cohesion: 0.40
Nodes (5): AvailabilityCalendarMode, AvailabilityMonthCalendar(), AvailabilityMonthCalendarProps, isInPendingRange(), WEEKDAY_LABELS

### Community 232 - "layouts.tsx"
Cohesion: 0.40
Nodes (4): AdminRoute(), AppLayout(), GuestRoute(), ProtectedRoute()

### Community 235 - "PocketBase RBAC — API rules"
Cohesion: 0.29
Nodes (6): IDOR на фазе 2, PocketBase RBAC — API rules, Коллекции, Паттерны правил, Применение, Роли

### Community 236 - "pocketbaseRbac.test.ts"
Cohesion: 0.25
Nodes (7): RBAC_DOC, RBAC_LIB, RBAC_LIB_COLLECTIONS, RBAC_MIGRATION, RBAC_MIGRATION_COLLECTIONS, ROOT, SCHEMA_DOC

### Community 240 - "client.ts"
Cohesion: 0.53
Nodes (4): clearPocketBaseAuth(), getPbUrl(), getPocketBase(), setPocketBaseAuth()

### Community 241 - "errors.ts"
Cohesion: 0.47
Nodes (5): extractPbFieldError(), mapPocketBaseError(), PB_FIELD_MESSAGE_MAP, PB_MESSAGE_MAP, withPbError()

### Community 242 - "mappers.ts"
Cohesion: 0.05
Nodes (26): PbAchievementDefinitionRecord, PbAssignmentRecord, PbAvailabilityRecord, PbConversationMemberRecord, PbConversationRecord, PbDirectionRecord, PbEventRecord, PbEventRegistrationRecord (+18 more)

### Community 249 - "pocketbase/helpers.ts"
Cohesion: 0.33
Nodes (5): escapePbFilter(), getPbRecordCreatedAt(), getPbRecordUpdatedAt(), normalizePbDateTime(), pbEqOr()

### Community 251 - "events.ts"
Cohesion: 0.38
Nodes (5): assertCanViewEvent(), assertEventsAdminAccess(), getRequesterUser(), loadEventOrThrow(), pocketbaseEventsApi

### Community 252 - "kvartiraEvents.js"
Cohesion: 0.83
Nodes (3): assertRegistrationCapacity(), relId(), syncRegisteredUserIds()

### Community 254 - "kvartiraChat.js"
Cohesion: 0.70
Nodes (4): isDeletedMessage(), relId(), syncConversationLastMessage(), syncReadReceipts()

### Community 257 - "pocketbase/assignments.ts"
Cohesion: 0.38
Nodes (4): assertViewAccess(), getRequesterUser(), loadAssignmentOrThrow(), pocketbaseAssignmentsApi

### Community 258 - "kvartiraAssignments.js"
Cohesion: 0.80
Nodes (4): assertAssignmentCreate(), assertAssignmentUpdate(), isUsersAuth(), relId()

### Community 260 - "pocketbase/chat.ts"
Cohesion: 0.19
Nodes (8): assertConversationAccess(), getRequesterUser(), loadConversationOrThrow(), loadMembers(), loadUserMembers(), openConversations, pocketbaseChatApi, mapConversationMemberRecord()

### Community 261 - "pocketbase/progress.ts"
Cohesion: 0.33
Nodes (9): assertManageGoalsAccess(), assertManageSkillsAccess(), assertViewAccess(), getAssignedIdsForRequester(), getRequesterUser(), persistUnlocks(), pocketbaseProgressApi, syncAchievements() (+1 more)

### Community 262 - "lessons.ts"
Cohesion: 0.25
Nodes (5): assertLessonAccess(), getRequesterUser(), loadTeacherLessons(), pocketbaseLessonsApi, mapLessonRecord()

### Community 263 - "loadEvaluationData"
Cohesion: 0.29
Nodes (7): mapAchievementDefinitionRecord(), mapAssignmentRecord(), mapProgressHistoryRecord(), mapSkillProgressRecord(), mapUserAchievementRecord(), loadEvaluationData(), studentFilter()

### Community 264 - "asIdList"
Cohesion: 0.33
Nodes (6): loadMessagesForConversations(), asIdList(), mapConversationRecord(), mapEventRecord(), mapLastMessage(), mapMessageRecord()

### Community 265 - "kvartiraProgress.js"
Cohesion: 0.73
Nodes (5): assertProgressCreate(), assertProgressUpdate(), isUsersAuth(), relId(), teacherHasStudent()

### Community 268 - "pocketbase/support.ts"
Cohesion: 0.32
Nodes (4): assertViewAccess(), getRequesterUser(), loadTicketOrThrow(), pocketbaseSupportApi

### Community 272 - "kvartiraLegal.js"
Cohesion: 0.60
Nodes (3): assertConsentCreate(), isUsersAuth(), relId()

### Community 274 - "pocketbase/security.ts"
Cohesion: 0.40
Nodes (3): getPasswordChangedAt(), pocketbaseSecurityApi, userFilter()

### Community 276 - "kvartiraNotifications.js"
Cohesion: 0.48
Nodes (5): assertNotificationCreate(), assertNotificationPreferencesCreate(), assertNotificationPreferencesUpdate(), isUsersAuth(), relId()

### Community 277 - "pocketbase/notifications.ts"
Cohesion: 0.40
Nodes (3): getPreferencesRecord(), pocketbaseNotificationsApi, userFilter()

### Community 279 - "pocketbase/files.ts"
Cohesion: 0.15
Nodes (20): collectStoredFileIds(), dataUrlToFile(), getSignedUrl(), isStoredFileRef(), KvartiraFileRecord, loadFileRecord(), parseStoredFileRef(), PB_FILE_URL_PREFIX (+12 more)

### Community 285 - "push/helpers.ts"
Cohesion: 0.23
Nodes (11): PUSH_PERMISSION_DENIED_MESSAGE, PUSH_UNSUPPORTED_MESSAGE, VAPID_PUBLIC_KEY_ENV, getActivePushSubscription(), getVapidPublicKey(), getWebPushClientState(), isWebPushConfigured(), isWebPushSupported() (+3 more)

### Community 286 - "kvartiraPush.js"
Cohesion: 0.52
Nodes (6): dispatchPushForNotification(), getSubscriptionsForUser(), isPushEnabledForUser(), relId(), removeSubscription(), sendViaRelay()

## Knowledge Gaps
- **759 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+754 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **104 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `dependencies`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `ProgressApi` connect `ProgressApi` to `types.ts`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `SupportApi` connect `SupportApi` to `types.ts`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _759 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `КВАРТИРА — PROJECT SPECIFICATION` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._