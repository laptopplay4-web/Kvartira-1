import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const RBAC_MIGRATION = resolve(ROOT, 'pocketbase/pb_migrations/1788326400_kvartira_rbac_rules.js');
const RBAC_LIB = resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraRbac.js');
const NARROW_USERS_MIGRATION = resolve(
  ROOT,
  'pocketbase/pb_migrations/1790313600_kvartira_narrow_user_directory.js',
);
const RBAC_DOC = resolve(ROOT, 'pocketbase/RBAC.md');
const SCHEMA_DOC = resolve(ROOT, 'pocketbase/SCHEMA.md');

const RBAC_MIGRATION_COLLECTIONS = [
  'users',
  'directions',
  'teacher_availability',
  'lessons',
  'lesson_history',
  'conversations',
  'conversation_members',
  'messages',
  'events',
  'event_registrations',
  'assignments',
  'help_articles',
  'support_tickets',
  'legal_documents',
  'user_consents',
  'security_sessions',
  'login_history',
  'security_alerts',
  'notifications',
  'notification_preferences',
  'school_settings',
  'public_news',
  'audit_logs',
] as const;

const RBAC_LIB_COLLECTIONS = [...RBAC_MIGRATION_COLLECTIONS, 'kvartira_files', 'assignment_groups'] as const;

describe('PocketBase RBAC rules (ROADMAP 1.4)', () => {
  it('rbac migration defines rules for all collections', () => {
    const source = readFileSync(RBAC_MIGRATION, 'utf8');
    for (const name of RBAC_MIGRATION_COLLECTIONS) {
      expect(source).toContain(`${name}:`);
    }
    expect(source).toContain('applyRules(app, name, rules)');
    expect(source).toContain('lockRules(app, name)');
  });

  it('migration unlocks lessons with participant IDOR checks', () => {
    const source = readFileSync(RBAC_MIGRATION, 'utf8');
    expect(source).toContain('student = @request.auth.id || teacher = @request.auth.id');
  });

  it('migration restricts chat to conversation members', () => {
    const source = readFileSync(RBAC_MIGRATION, 'utf8');
    expect(source).toContain('@collection.conversation_members.conversation');
    expect(source).toContain('@collection.conversation_members.user');
  });

  it('audit_logs create/update/delete locked to hooks (null)', () => {
    const source = readFileSync(RBAC_MIGRATION, 'utf8');
    expect(source).toMatch(/audit_logs:[\s\S]*createRule: null/);
    expect(source).toMatch(/audit_logs:[\s\S]*updateRule: null/);
    expect(source).toMatch(/audit_logs:[\s\S]*deleteRule: null/);
  });

  it('kvartiraRbac.js exports COLLECTION_RULES aligned with permissions roles', () => {
    const source = readFileSync(RBAC_LIB, 'utf8');
    expect(source).toContain('COLLECTION_RULES');
    expect(source).toContain('@request.auth.role = "admin"');
    expect(source).toContain('@request.auth.role = "teacher"');
    expect(source).toContain('@request.auth.role = "student"');
    expect(source).toContain('permissions/index.ts');
    for (const name of RBAC_LIB_COLLECTIONS) {
      expect(source).toContain(`${name}:`);
    }
  });

  it('users directory is no longer readable by every authenticated account', () => {
    const source = readFileSync(RBAC_LIB, 'utf8');
    expect(source).toContain('USER_DIRECTORY_ACCESS');
    expect(source).toMatch(/users:\s*\{\s*listRule: USER_DIRECTORY_ACCESS/);
    expect(source).toMatch(/viewRule: USER_DIRECTORY_ACCESS/);
    // students may only reach people they share a group or a conversation with
    expect(source).toContain('@collection.assignment_groups.members ?= @request.auth.id');
    expect(source).toContain('@collection.conversations.participantIds ?~ @request.auth.id');
  });

  it('narrow user directory migration mirrors the hook rule', () => {
    const source = readFileSync(NARROW_USERS_MIGRATION, 'utf8');
    expect(source).toContain('USER_DIRECTORY_ACCESS');
    expect(source).toContain('users.listRule = USER_DIRECTORY_ACCESS');
    expect(source).toContain('users.viewRule = USER_DIRECTORY_ACCESS');
    expect(source).toContain('@collection.conversations.participantIds ?~ @request.auth.id');
  });

  it('kvartiraRbac lesson_history allows lesson participants', () => {
    const source = readFileSync(RBAC_LIB, 'utf8');
    expect(source).toContain('LESSON_HISTORY_ACCESS');
    expect(source).toContain('@collection.lessons.id ?= lesson');
  });

  it('RBAC.md documents permission mapping', () => {
    const doc = readFileSync(RBAC_DOC, 'utf8');
    expect(doc).toContain('permissions/index.ts');
    expect(doc).toContain('lessons:view-own');
    expect(doc).toContain('admin:users');
    expect(doc).toContain('chat:read');
  });

  it('kvartiraRbac allows school-wide conversation list without membership', () => {
    const source = readFileSync(RBAC_LIB, 'utf8');
    expect(source).toContain('metadata.schoolWide = true');
  });

  it('school-wide chat rules migration updates conversations list/view', () => {
    const source = readFileSync(
      resolve(ROOT, 'pocketbase/pb_migrations/1790486400_kvartira_school_wide_chat_rules.js'),
      'utf8',
    );
    expect(source).toContain('metadata.schoolWide = true');
  });

  it('SCHEMA.md references RBAC (1.4)', () => {
    const doc = readFileSync(SCHEMA_DOC, 'utf8');
    expect(doc).toContain('1.4');
    expect(doc).toContain('RBAC.md');
  });
});
