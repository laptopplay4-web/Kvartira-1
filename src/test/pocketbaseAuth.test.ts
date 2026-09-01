import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const AUTH_HOOK = resolve(ROOT, 'pocketbase/pb_hooks/auth.pb.js');
const AUTH_LIB = resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraAuth.js');
const AUTH_MIGRATION = resolve(ROOT, 'pocketbase/pb_migrations/1788235200_kvartira_auth_config.js');
const SCHEMA_DOC = resolve(ROOT, 'pocketbase/SCHEMA.md');

describe('PocketBase auth hooks (ROADMAP 1.3)', () => {
  it('auth.pb.js defines phone login and login history hooks', () => {
    const source = readFileSync(AUTH_HOOK, 'utf8');
    expect(source).toContain('onRecordAuthWithPasswordRequest');
    expect(source).toContain('onRecordAuthRequest');
    expect(source).toContain('findFirstRecordByData');
    expect(source).toContain("'phone'");
    expect(source).toContain('recordLoginAttempt');
  });

  it('kvartiraAuth.js normalizes +7 phone and writes login_history', () => {
    const source = readFileSync(AUTH_LIB, 'utf8');
    expect(source).toContain('normalizePhone');
    expect(source).toContain('phoneToEmail');
    expect(source).toContain("login_history");
    expect(source).toContain('failed_login');
    expect(source).toMatch(/\+79\\d\{9\}/);
  });

  it('auth config migration makes users email optional', () => {
    const source = readFileSync(AUTH_MIGRATION, 'utf8');
    expect(source).toContain('emailField.required = false');
  });

  it('SCHEMA.md documents auth hooks (1.3)', () => {
    const doc = readFileSync(SCHEMA_DOC, 'utf8');
    expect(doc).toContain('1.3');
    expect(doc).toContain('auth-with-password');
  });
});
