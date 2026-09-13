/// @ts-check
/**
 * ROADMAP 1.4 — PocketBase API rule fragments ↔ src/permissions/index.ts
 *
 * Used by pb_migrations/1788326400_kvartira_rbac_rules.js (keep in sync).
 * Role field on auth record: @request.auth.role ∈ student | teacher | admin
 */

/** PocketBase filter: authenticated user */
const AUTH = '@request.auth.id != ""';

/** PocketBase filter: admin role (admin:*) */
const ADMIN = '@request.auth.role = "admin"';

/** PocketBase filter: teacher role */
const TEACHER = '@request.auth.role = "teacher"';

/** PocketBase filter: student role */
const STUDENT = '@request.auth.role = "student"';

/** Public (guest + auth) — empty rule string in PB */
const PUBLIC = '';

/** @param {string} field */
function own(field) {
  return `${field} = @request.auth.id`;
}

/** lessons:view-all | view-own | view-assigned */
const LESSON_ACCESS = `${ADMIN} || student = @request.auth.id || teacher = @request.auth.id`;

/** lesson_history: lesson participants + admin */
const LESSON_HISTORY_ACCESS = `${ADMIN} || (@collection.lessons.id ?= lesson && (@collection.lessons.student ?= @request.auth.id || @collection.lessons.teacher ?= @request.auth.id))`;

/** assignments:view-all | view-own | view-assigned (group members / general / school-wide name) */
const ASSIGNMENT_ACCESS = `${ADMIN} || teacher = @request.auth.id || group.kind = "general" || group.name = "Все ученики" || (@collection.assignment_groups.id ?= group && (@collection.assignment_groups.kind = "general" || @collection.assignment_groups.members.id ?= @request.auth.id))`;

/** assignment_groups: teacher owns custom groups; general / school-wide visible to all auth */
const ASSIGNMENT_GROUP_ACCESS = `${ADMIN} || teacher = @request.auth.id || kind = "general" || name = "Все ученики" || members.id ?= @request.auth.id`;

/** Conversation membership (chat:read) — admin without membership cannot list personal chats */
const CONVERSATION_MEMBER = `${ADMIN} || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)`;

/** Message access via conversation membership */
const MESSAGE_ACCESS = `${ADMIN} || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)`;

/** support:view-own-tickets | view-all-tickets */
const TICKET_ACCESS = `${ADMIN} || user = @request.auth.id`;

/** kvartira_files — owner, conversation/assignment/ticket participants; school/event public.
 * Assignment branch mirrors ASSIGNMENT_ACCESS via nested `@collection.assignments.group.*`
 * (not a second `@collection.assignment_groups` join — that fails for students). */
const FILE_ACCESS = `${ADMIN} || owner = @request.auth.id || purpose = "school" || purpose = "event" || (purpose = "chat" && contextId != "" && @collection.conversation_members.conversation ?= contextId && @collection.conversation_members.user ?= @request.auth.id) || (purpose = "assignment" && contextId != "" && @collection.assignments.id ?= contextId && (@collection.assignments.teacher ?= @request.auth.id || @collection.assignments.group.kind = "general" || @collection.assignments.group.name = "Все ученики" || @collection.assignments.group.members.id ?= @request.auth.id)) || (purpose = "support" && contextId != "" && @collection.support_tickets.id ?= contextId && (@collection.support_tickets.user ?= @request.auth.id || @request.auth.role = "admin"))`;

/** Own row or admin */
const OWN_USER_OR_ADMIN = `${ADMIN} || user = @request.auth.id`;

/**
 * teacher_availability read — authenticated only.
 *
 * Booking requires every student to read any teacher's schedule, so this stays
 * broad, but guests get nothing and the record carries working hours only.
 */
const AVAILABILITY_READ = `${ADMIN} || teacher = @request.auth.id || ${AUTH}`;

/**
 * users list/view — who may see whose directory card.
 *
 * Before: `@request.auth.id != ""` — any student could enumerate the whole
 * school in a single request. Now:
 *
 * - admin — everyone;
 * - own record;
 * - teachers — public (landing page and booking flow list them);
 * - staff sees students (teacher needs the roster for chats, groups, ДЗ);
 * - student ↔ co-members of a shared assignment group;
 * - student ↔ co-participants of a shared conversation.
 *
 * The last two clauses correlate inside a SINGLE row: one `@collection.x`
 * alias resolves to one joined row, so this is a real join and not two
 * independent existence checks. `participantIds` is a json array kept in sync
 * by the chat adapter on create/add/remove/leave.
 *
 * Phone and email stay hidden regardless — see pb_hooks/users.pb.js.
 */
const USER_DIRECTORY_ACCESS = [
  ADMIN,
  'id = @request.auth.id',
  'role = "teacher"',
  `(${TEACHER} && role = "student")`,
  '(@collection.assignment_groups.members ?= @request.auth.id && @collection.assignment_groups.members ?= id)',
  '(@collection.conversations.participantIds ?~ @request.auth.id && @collection.conversations.participantIds ?~ id)',
].join(' || ');

/**
 * Collection API rules — maps to permissions/index.ts + services access helpers
 * @type {Record<string, { listRule: string, viewRule: string, createRule: string, updateRule: string, deleteRule: string | null }>}
 */
const COLLECTION_RULES = {
  users: {
    listRule: USER_DIRECTORY_ACCESS,
    viewRule: USER_DIRECTORY_ACCESS,
    createRule: PUBLIC,
    updateRule: `${ADMIN} || id = @request.auth.id`,
    // Self-service erasure (152-ФЗ, ст. 21). Admins delete through the PB Admin
    // UI as superusers; nobody can delete somebody else through the API.
    deleteRule: 'id = @request.auth.id',
  },
  directions: {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  teacher_availability: {
    // Booking needs every student to read the schedule of any teacher, so this
    // stays broad — but authenticated only (guests get nothing) and the record
    // holds working hours, never personal data.
    listRule: AVAILABILITY_READ,
    viewRule: AVAILABILITY_READ,
    createRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
    updateRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
    deleteRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
  },
  lessons: {
    listRule: LESSON_ACCESS,
    viewRule: LESSON_ACCESS,
    createRule: `${ADMIN} || (${STUDENT} && student = @request.auth.id)`,
    updateRule: LESSON_ACCESS,
    deleteRule: LESSON_ACCESS,
  },
  lesson_history: {
    listRule: LESSON_HISTORY_ACCESS,
    viewRule: LESSON_HISTORY_ACCESS,
    createRule: AUTH,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  conversations: {
    listRule: `${ADMIN} || ${CONVERSATION_MEMBER} || metadata.schoolWide = true`,
    viewRule: `${ADMIN} || ${CONVERSATION_MEMBER} || metadata.schoolWide = true`,
    createRule: AUTH,
    updateRule: CONVERSATION_MEMBER,
    deleteRule: `${ADMIN} || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id && @collection.conversation_members.role ?= "owner")`,
  },
  conversation_members: {
    listRule: `${ADMIN} || user = @request.auth.id || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)`,
    viewRule: `${ADMIN} || user = @request.auth.id || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)`,
    createRule: AUTH,
    updateRule: `${ADMIN} || user = @request.auth.id`,
    deleteRule: `${ADMIN} || user = @request.auth.id || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id && (@collection.conversation_members.role ?= "owner" || @collection.conversation_members.role ?= "admin"))`,
  },
  messages: {
    listRule: MESSAGE_ACCESS,
    viewRule: MESSAGE_ACCESS,
    createRule: MESSAGE_ACCESS,
    updateRule: `${ADMIN} || sender = @request.auth.id`,
    deleteRule: `${ADMIN} || sender = @request.auth.id`,
  },
  events: {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: `${ADMIN} || ${TEACHER}`,
    updateRule: `${ADMIN} || ${TEACHER}`,
    deleteRule: `${ADMIN} || ${TEACHER}`,
  },
  event_registrations: {
    listRule: `${ADMIN} || ${TEACHER} || user = @request.auth.id`,
    viewRule: `${ADMIN} || ${TEACHER} || user = @request.auth.id`,
    createRule: `${AUTH} && user = @request.auth.id && @request.auth.role = "student"`,
    updateRule: `${ADMIN} || user = @request.auth.id`,
    deleteRule: `${ADMIN} || ${TEACHER} || user = @request.auth.id`,
  },
  assignment_groups: {
    listRule: ASSIGNMENT_GROUP_ACCESS,
    viewRule: ASSIGNMENT_GROUP_ACCESS,
    createRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
    updateRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
    deleteRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
  },
  assignments: {
    listRule: ASSIGNMENT_ACCESS,
    viewRule: ASSIGNMENT_ACCESS,
    createRule: `${ADMIN} || (${TEACHER} && teacher = @request.auth.id)`,
    updateRule: `${ADMIN} || ${TEACHER}`,
    deleteRule: `${ADMIN} || ${TEACHER}`,
  },
  help_articles: {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  support_tickets: {
    listRule: TICKET_ACCESS,
    viewRule: TICKET_ACCESS,
    createRule: `${ADMIN} || (${AUTH} && user = @request.auth.id)`,
    updateRule: TICKET_ACCESS,
    deleteRule: ADMIN,
  },
  legal_documents: {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  user_consents: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: `${ADMIN} || (${AUTH} && user = @request.auth.id)`,
    // Withdrawal goes through POST /api/kvartira/consents/revoke so the server
    // stamps the timestamp — nobody edits the consent journal directly.
    updateRule: null,
    deleteRule: ADMIN,
  },
  security_sessions: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: AUTH,
    updateRule: OWN_USER_OR_ADMIN,
    deleteRule: OWN_USER_OR_ADMIN,
  },
  login_history: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: AUTH,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  security_alerts: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: AUTH,
    updateRule: OWN_USER_OR_ADMIN,
    deleteRule: ADMIN,
  },
  notifications: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: AUTH,
    updateRule: OWN_USER_OR_ADMIN,
    deleteRule: OWN_USER_OR_ADMIN,
  },
  notification_preferences: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: `${ADMIN} || (${AUTH} && user = @request.auth.id)`,
    updateRule: OWN_USER_OR_ADMIN,
    deleteRule: ADMIN,
  },
  push_subscriptions: {
    listRule: OWN_USER_OR_ADMIN,
    viewRule: OWN_USER_OR_ADMIN,
    createRule: `${AUTH} && user = @request.auth.id`,
    updateRule: OWN_USER_OR_ADMIN,
    deleteRule: OWN_USER_OR_ADMIN,
  },
  school_settings: {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  public_news: {
    listRule: PUBLIC,
    viewRule: PUBLIC,
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
  },
  kvartira_files: {
    listRule: FILE_ACCESS,
    viewRule: FILE_ACCESS,
    createRule: `${AUTH} && owner = @request.auth.id`,
    updateRule: `${ADMIN} || owner = @request.auth.id`,
    deleteRule: `${ADMIN} || owner = @request.auth.id`,
  },
  audit_logs: {
    listRule: ADMIN,
    viewRule: ADMIN,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  },
};

/** True when request auth is an app user (not PocketBase superuser). */
function isUsersAuth(auth) {
  if (!auth) return false;
  try {
    return auth.collection().name === 'users';
  } catch (_) {
    return false;
  }
}

module.exports = {
  AUTH,
  ADMIN,
  TEACHER,
  STUDENT,
  PUBLIC,
  own,
  LESSON_ACCESS,
  ASSIGNMENT_ACCESS,
  ASSIGNMENT_GROUP_ACCESS,
  CONVERSATION_MEMBER,
  MESSAGE_ACCESS,
  TICKET_ACCESS,
  FILE_ACCESS,
  OWN_USER_OR_ADMIN,
  USER_DIRECTORY_ACCESS,
  AVAILABILITY_READ,
  COLLECTION_RULES,
  isUsersAuth,
};
