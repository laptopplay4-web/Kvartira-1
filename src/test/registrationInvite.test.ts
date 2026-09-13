import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  mockAuthApi,
  mockSchoolSettingsApi,
  resetMockDatabase,
} from '@/services/api/mock';
import { SEED_REGISTRATION_INVITE_TOKEN } from '@/services/registration/constants';
import {
  buildRegistrationInviteUrl,
  createRotatedRegistrationInvite,
  ensurePrintableRegistrationInvite,
  inviteTokensEqual,
  isRegistrationInviteTokenFormat,
  isSeedRegistrationInviteToken,
  readInviteTokenFromSearch,
} from '@/services/registration/invite';

describe('registration invite helpers', () => {
  it('builds register deep link with invite query', () => {
    const url = buildRegistrationInviteUrl('https://app.example', 'abc123token');
    expect(url).toBe('https://app.example/register?invite=abc123token');
  });

  it('reads invite from search string', () => {
    expect(readInviteTokenFromSearch('?invite=tok-1')).toBe('tok-1');
    expect(readInviteTokenFromSearch('foo=1')).toBeNull();
  });

  it('compares tokens in constant time for equal length', () => {
    expect(inviteTokensEqual('abcd', 'abcd')).toBe(true);
    expect(inviteTokensEqual('abcd', 'abce')).toBe(false);
    expect(inviteTokensEqual('abc', 'abcd')).toBe(false);
  });

  it('validates invite token format', () => {
    expect(isRegistrationInviteTokenFormat(SEED_REGISTRATION_INVITE_TOKEN)).toBe(true);
    expect(isRegistrationInviteTokenFormat('short')).toBe(false);
    expect(isRegistrationInviteTokenFormat('bad token with spaces!!!!')).toBe(false);
  });

  it('rotates to a new random token', () => {
    const a = createRotatedRegistrationInvite();
    const b = createRotatedRegistrationInvite();
    expect(a.token).not.toBe(b.token);
    expect(isRegistrationInviteTokenFormat(a.token)).toBe(true);
  });

  it('detects seed token and replaces it for printable QR', () => {
    expect(isSeedRegistrationInviteToken(SEED_REGISTRATION_INVITE_TOKEN)).toBe(true);
    const fromSeed = ensurePrintableRegistrationInvite({
      token: SEED_REGISTRATION_INVITE_TOKEN,
      rotatedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(fromSeed.didRotate).toBe(true);
    expect(fromSeed.invite.token).not.toBe(SEED_REGISTRATION_INVITE_TOKEN);
    expect(isRegistrationInviteTokenFormat(fromSeed.invite.token)).toBe(true);

    const kept = ensurePrintableRegistrationInvite(fromSeed.invite);
    expect(kept.didRotate).toBe(false);
    expect(kept.invite.token).toBe(fromSeed.invite.token);
  });
});

describe('mock registration invite gate', () => {
  beforeEach(() => {
    resetMockDatabase();
  });

  it('rejects register without invite', async () => {
    await expect(
      mockAuthApi.register('+79009998871', 'password1', 'Аня', 'Тест', ['dir-vocal'], ''),
    ).rejects.toMatchObject({ code: 'INVITE_REQUIRED' });
  });

  it('rejects register with wrong invite', async () => {
    await expect(
      mockAuthApi.register(
        '+79009998872',
        'password1',
        'Аня',
        'Тест',
        ['dir-vocal'],
        'wrong-invite-token-xxxxxxxxxxxxxxxxxxxxxxxx',
      ),
    ).rejects.toMatchObject({ code: 'INVITE_INVALID' });
  });

  it('validates and accepts seed invite', async () => {
    const check = await mockAuthApi.validateRegistrationInvite(SEED_REGISTRATION_INVITE_TOKEN);
    expect(check.valid).toBe(true);

    const session = await mockAuthApi.register(
      '+79009998873',
      'password1',
      'Аня',
      'Тест',
      ['dir-vocal'],
      SEED_REGISTRATION_INVITE_TOKEN,
    );
    expect(session.user.role).toBe('student');
    expect(session.user.phone).toBe('+79009998873');
  });

  it('admin getRegistrationInvite replaces seed so QR opens the form', async () => {
    const before = await mockSchoolSettingsApi.getRegistrationInvite(
      'user-admin',
      'http://localhost',
    );
    expect(before.token).not.toBe(SEED_REGISTRATION_INVITE_TOKEN);
    expect(before.registerUrl).toContain('/register?invite=');
    expect(before.registerUrl).toContain(before.token);

    const check = await mockAuthApi.validateRegistrationInvite(before.token);
    expect(check.valid).toBe(true);

    const rotated = await mockSchoolSettingsApi.rotateRegistrationInvite(
      'user-admin',
      'http://localhost',
    );
    expect(rotated.token).not.toBe(before.token);

    await expect(
      mockAuthApi.register(
        '+79009998874',
        'password1',
        'Аня',
        'Тест',
        ['dir-vocal'],
        before.token,
      ),
    ).rejects.toMatchObject({ code: 'INVITE_INVALID' });

    const session = await mockAuthApi.register(
      '+79009998874',
      'password1',
      'Аня',
      'Тест',
      ['dir-vocal'],
      rotated.token,
    );
    expect(session.user.id).toBeTruthy();
  });

  it('student cannot manage registration invite', async () => {
    await expect(
      mockSchoolSettingsApi.getRegistrationInvite('user-student'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('registration invite wiring', () => {
  it('PB hooks enforce invite and strip secret from school_settings enrich', () => {
    const authHook = readFileSync(
      resolve(process.cwd(), 'pocketbase/pb_hooks/auth.pb.js'),
      'utf8',
    );
    const inviteHook = readFileSync(
      resolve(process.cwd(), 'pocketbase/pb_hooks/invite.pb.js'),
      'utf8',
    );
    const inviteLib = readFileSync(
      resolve(process.cwd(), 'pocketbase/pb_hooks/lib/kvartiraInvite.js'),
      'utf8',
    );

    expect(authHook).toContain('assertRegistrationInviteOnUserCreate');
    expect(inviteHook).toContain('/api/kvartira/registration-invite/validate');
    expect(inviteHook).toContain('stripInviteFromSchoolSettingsRecord');
    expect(inviteLib).toContain('X-Registration-Invite');
    expect(inviteLib).toContain('x_registration_invite');
    expect(inviteLib).toContain('query.invite');
    expect(inviteLib).toContain('findFirstRecordByFilter');
    expect(inviteLib).toContain('id != ""');
    expect(inviteLib).toContain('decodeJsonField');
    expect(inviteLib).toContain('String.fromCharCode');
    expect(inviteLib).not.toContain("findRecordsByFilter('school_settings', ''");
  });

  it('PB auth adapter sends invite as header and query on register', () => {
    const authAdapter = readFileSync(
      resolve(process.cwd(), 'src/services/api/pocketbase/auth.ts'),
      'utf8',
    );
    expect(authAdapter).toContain('REGISTRATION_INVITE_HEADER');
    expect(authAdapter).toContain('invite: normalizedInvite');
  });

  it('RegisterPage gates on invite validation', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'src/pages/auth/RegisterPage.tsx'),
      'utf8',
    );
    expect(page).toContain('validateRegistrationInvite');
    expect(page).toContain('RegistrationInviteGate');
  });
});
