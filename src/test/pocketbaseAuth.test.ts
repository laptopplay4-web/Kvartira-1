import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const AUTH_HOOK = resolve(ROOT, 'pocketbase/pb_hooks/auth.pb.js');
const AUTH_LIB = resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraAuth.js');
const SECURITY_LIB = resolve(ROOT, 'pocketbase/pb_hooks/lib/kvartiraSecurity.js');
const AUTH_MIGRATION = resolve(ROOT, 'pocketbase/pb_migrations/1788235200_kvartira_auth_config.js');
const BOOL_MIGRATION = resolve(
  ROOT,
  'pocketbase/pb_migrations/1789190400_kvartira_login_history_bool.js',
);
const SCHEMA_DOC = resolve(ROOT, 'pocketbase/SCHEMA.md');
const LOGIN_PAGE = resolve(ROOT, 'src/pages/auth/LoginPage.tsx');
const REGISTER_PAGE = resolve(ROOT, 'src/pages/auth/RegisterPage.tsx');
const FORGOT_PAGE = resolve(ROOT, 'src/pages/auth/ForgotPasswordPage.tsx');

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

  it('auth side-effect hooks cannot fail a successful login', () => {
    const source = readFileSync(AUTH_HOOK, 'utf8');
    expect(source).toContain('login must succeed even if history write fails');
    expect(source).toContain('login must succeed even if session write fails');
  });

  it('findRecordsByFilter uses return value, not an output array', () => {
    const authLib = readFileSync(AUTH_LIB, 'utf8');
    const securityLib = readFileSync(SECURITY_LIB, 'utf8');
    expect(authLib).toMatch(/rows\s*=\s*app\.findRecordsByFilter/);
    expect(securityLib).toMatch(/rows\s*=\s*app\.findRecordsByFilter/);
    expect(securityLib).not.toMatch(/findRecordsByFilter\([^)]+,\s*\[/);
  });

  it('relaxes login_history.success required bool', () => {
    const source = readFileSync(BOOL_MIGRATION, 'utf8');
    expect(source).toContain('login_history');
    expect(source).toContain('success');
    expect(source).toContain('required = false');
  });

  it('login page has no demo role shortcuts', () => {
    const login = readFileSync(LOGIN_PAGE, 'utf8');
    expect(login).not.toContain('demoLogin');
    expect(login).not.toContain('Быстрый вход для демо');
  });

  it('login, register and forgot-password use PhoneInput mask', () => {
    const login = readFileSync(LOGIN_PAGE, 'utf8');
    const register = readFileSync(REGISTER_PAGE, 'utf8');
    const forgot = readFileSync(FORGOT_PAGE, 'utf8');
    expect(login).toContain('PhoneInput');
    expect(register).toContain('PhoneInput');
    expect(forgot).toContain('PhoneInput');
    expect(login).toContain('PHONE_STORAGE_REGEX');
    expect(register).toContain('PHONE_STORAGE_REGEX');
  });
});
