import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const SEED_INDEX = resolve(ROOT, 'pocketbase/seed/index.ts');
const SEED_RUN = resolve(ROOT, 'pocketbase/seed/run.ts');
const SEED_HELPERS = resolve(ROOT, 'pocketbase/seed/helpers.ts');
const SEED_CLIENT = resolve(ROOT, 'pocketbase/seed/pbClient.ts');
const README = resolve(ROOT, 'pocketbase/README.md');
const SCHEMA_DOC = resolve(ROOT, 'pocketbase/SCHEMA.md');

/** Collections populated by runSeed (ROADMAP 1.5) */
const SEEDED_COLLECTIONS = [
  'directions',
  'users',
  'teacher_availability',
  'lessons',
  'lesson_history',
  'conversations',
  'conversation_members',
  'messages',
  'events',
  'event_registrations',
  'assignments',
  'assignment_groups',
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
] as const;

describe('PocketBase seed (ROADMAP 1.5)', () => {
  it('seed script files exist and import mocks/seed.ts', () => {
    const indexSource = readFileSync(SEED_INDEX, 'utf8');
    const runSource = readFileSync(SEED_RUN, 'utf8');
    expect(indexSource).toContain('runSeed');
    expect(indexSource).toContain('ensureLegalDocuments');
    expect(runSource).toContain("from '../../src/mocks/seed'");
    expect(runSource).toContain('DEMO_ACCOUNTS');
  });

  it('ensureLegal upserts legal_documents without full reseed', () => {
    const source = readFileSync(resolve(ROOT, 'pocketbase/seed/ensureLegal.ts'), 'utf8');
    expect(source).toContain('LEGAL_PRIVACY_POLICY_TEXT');
    expect(source).toContain('createRecord');
    expect(source).toContain('updateRecord');
  });

  it('helpers map demo phones for PB schema', () => {
    const source = readFileSync(SEED_HELPERS, 'utf8');
    expect(source).toContain('phoneToEmail');
    expect(source).toContain('passwordForPhone');
    expect(source).toContain('user-teacher-1');
  });

  it('pbClient uses superuser auth endpoint', () => {
    const source = readFileSync(SEED_CLIENT, 'utf8');
    expect(source).toContain('_superusers/auth-with-password');
  });

  it('runSeed covers all demo collections from seed.ts', () => {
    const source = readFileSync(SEED_RUN, 'utf8');
    for (const name of SEEDED_COLLECTIONS) {
      expect(source).toContain(`'${name}'`);
    }
  });

  it('README and SCHEMA document seed step (1.5)', () => {
    const readme = readFileSync(README, 'utf8');
    const schema = readFileSync(SCHEMA_DOC, 'utf8');
    expect(readme).toContain('pb:seed');
    expect(readme).toContain('1.5');
    expect(schema).toContain('1.5');
  });
});
