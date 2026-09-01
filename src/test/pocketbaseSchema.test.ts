import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const MIGRATION = resolve(ROOT, 'pocketbase/pb_migrations/1788148800_kvartira_schema.js');
const SCHEMA_DOC = resolve(ROOT, 'pocketbase/SCHEMA.md');

/** ROADMAP 1.2 required collection names */
const REQUIRED_COLLECTIONS = [
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
  'skills',
  'student_skill_progress',
  'progress_goals',
  'progress_history',
  'achievement_definitions',
  'user_achievements',
  'help_articles',
  'support_tickets',
  'legal_documents',
  'user_consents',
  'security_sessions',
  'login_history',
  'security_alerts',
  'notifications',
  'notification_preferences',
  'audit_logs',
] as const;

describe('PocketBase schema (ROADMAP 1.2)', () => {
  it('migration file exists and defines all required collections', () => {
    const source = readFileSync(MIGRATION, 'utf8');
    for (const name of REQUIRED_COLLECTIONS) {
      if (name === 'users') {
        expect(source).toContain("findCollectionByNameOrId('users')");
      } else {
        expect(source).toContain(`'${name}'`);
      }
    }
  });

  it('documents double-booking unique index on lessons', () => {
    const source = readFileSync(MIGRATION, 'utf8');
    expect(source).toContain('idx_lessons_teacher_slot');
  });

  it('SCHEMA.md lists roadmap collections', () => {
    const doc = readFileSync(SCHEMA_DOC, 'utf8');
    for (const name of REQUIRED_COLLECTIONS) {
      expect(doc).toContain(`\`${name}\``);
    }
  });
});
