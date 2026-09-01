/// <reference path="../pb_data/types.d.ts" />

/**
 * ROADMAP 1.4 — PocketBase API rules ↔ src/permissions/index.ts
 * Rule definitions: pb_hooks/lib/kvartiraRbac.js (keep in sync)
 */

// Inline copy — migrations cannot require pb_hooks; sync with kvartiraRbac.js COLLECTION_RULES
const RULES = {
  users: {
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin" || id = @request.auth.id',
    createRule: '',
    updateRule: '@request.auth.role = "admin" || id = @request.auth.id',
    deleteRule: null,
  },
  directions: {
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  teacher_availability: {
    listRule:
      '@request.auth.role = "admin" || teacher = @request.auth.id || @request.auth.id != ""',
    viewRule:
      '@request.auth.role = "admin" || teacher = @request.auth.id || @request.auth.id != ""',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.role = "teacher" && teacher = @request.auth.id)',
    updateRule:
      '@request.auth.role = "admin" || (@request.auth.role = "teacher" && teacher = @request.auth.id)',
    deleteRule:
      '@request.auth.role = "admin" || (@request.auth.role = "teacher" && teacher = @request.auth.id)',
  },
  lessons: {
    listRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
    viewRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.role = "student" && student = @request.auth.id)',
    updateRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
    deleteRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
  },
  lesson_history: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  conversations: {
    listRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)',
    viewRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)',
    createRule: '@request.auth.id != ""',
    updateRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id)',
    deleteRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= id && @collection.conversation_members.user ?= @request.auth.id && @collection.conversation_members.role ?= "owner")',
  },
  conversation_members: {
    listRule:
      '@request.auth.role = "admin" || user = @request.auth.id || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)',
    viewRule:
      '@request.auth.role = "admin" || user = @request.auth.id || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin" || user = @request.auth.id',
  },
  messages: {
    listRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)',
    viewRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)',
    createRule:
      '@request.auth.role = "admin" || (@collection.conversation_members.conversation ?= conversation && @collection.conversation_members.user ?= @request.auth.id)',
    updateRule: '@request.auth.role = "admin" || sender = @request.auth.id',
    deleteRule: '@request.auth.role = "admin" || sender = @request.auth.id',
  },
  events: {
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    deleteRule: '@request.auth.role = "admin"',
  },
  event_registrations: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.id != "" && user = @request.auth.id)',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin" || user = @request.auth.id',
  },
  assignments: {
    listRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
    viewRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.role = "teacher" && teacher = @request.auth.id)',
    updateRule:
      '@request.auth.role = "admin" || student = @request.auth.id || teacher = @request.auth.id',
    deleteRule:
      '@request.auth.role = "admin" || (@request.auth.role = "teacher" && teacher = @request.auth.id)',
  },
  skills: {
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    deleteRule: '@request.auth.role = "admin"',
  },
  student_skill_progress: {
    listRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    viewRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    deleteRule: '@request.auth.role = "admin"',
  },
  progress_goals: {
    listRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    viewRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    updateRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    deleteRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
  },
  progress_history: {
    listRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    viewRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  achievement_definitions: {
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  user_achievements: {
    listRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    viewRule:
      '@request.auth.role = "admin" || student = @request.auth.id || (@request.auth.role = "teacher")',
    createRule: '@request.auth.role = "admin" || @request.auth.role = "teacher"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  help_articles: {
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  support_tickets: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.id != "" && user = @request.auth.id)',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin"',
  },
  legal_documents: {
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  user_consents: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.id != "" && user = @request.auth.id)',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  security_sessions: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin" || user = @request.auth.id',
  },
  login_history: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  security_alerts: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin"',
  },
  notifications: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin" || user = @request.auth.id',
  },
  notification_preferences: {
    listRule: '@request.auth.role = "admin" || user = @request.auth.id',
    viewRule: '@request.auth.role = "admin" || user = @request.auth.id',
    createRule:
      '@request.auth.role = "admin" || (@request.auth.id != "" && user = @request.auth.id)',
    updateRule: '@request.auth.role = "admin" || user = @request.auth.id',
    deleteRule: '@request.auth.role = "admin"',
  },
  school_settings: {
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  public_news: {
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.role = "admin"',
    updateRule: '@request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  },
  audit_logs: {
    listRule: '@request.auth.role = "admin"',
    viewRule: '@request.auth.role = "admin"',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  },
};

/** @param {string} name @param {object} rules */
function applyRules(app, name, rules) {
  const collection = app.findCollectionByNameOrId(name);
  collection.listRule = rules.listRule;
  collection.viewRule = rules.viewRule;
  collection.createRule = rules.createRule;
  collection.updateRule = rules.updateRule;
  collection.deleteRule = rules.deleteRule;
  app.save(collection);
}

/** @param {string} name */
function lockRules(app, name) {
  const collection = app.findCollectionByNameOrId(name);
  collection.listRule = null;
  collection.viewRule = null;
  collection.createRule = null;
  collection.updateRule = null;
  collection.deleteRule = null;
  app.save(collection);
}

migrate(
  (app) => {
    for (const [name, rules] of Object.entries(RULES)) {
      applyRules(app, name, rules);
    }
  },
  (app) => {
    for (const name of Object.keys(RULES)) {
      lockRules(app, name);
    }
  },
);
