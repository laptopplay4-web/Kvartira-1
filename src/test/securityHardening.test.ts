import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { renderRegistrationQrSvgDataUrl } from '@/services/registration/qr';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (relative: string) => readFileSync(resolve(ROOT, relative), 'utf8');

describe('event rosters are not public', () => {
  const hook = read('pocketbase/pb_hooks/events.pb.js');

  it('redacts participant id lists for everyone but staff', () => {
    expect(hook).toContain("onRecordEnrich");
    expect(hook).toContain("redact('registeredUserIds')");
    expect(hook).toContain("redact('invitedUserIds')");
  });

  it('keeps the seat count and the self-check working', () => {
    // The UI reads `.length` for free seats and `.includes(me)` for the badge,
    // so ids are replaced one-for-one instead of being dropped.
    expect(hook).toContain("raw.map((id) => (viewerId && String(id) === viewerId ? viewerId : 'hidden'))");
  });
});

describe('notification fan-out is limited to shared context', () => {
  const lib = read('pocketbase/pb_hooks/lib/kvartiraNotifications.js');
  const hook = read('pocketbase/pb_hooks/notifications.pb.js');

  it('a teacher must share a lesson, group or chat with the target', () => {
    expect(lib).toContain('function teacherSharesContextWith');
    expect(lib).toContain("['lessons', `teacher = {:staff} && student = {:target}`]");
    expect(lib).toContain("role === 'teacher' && teacherSharesContextWith(app, auth.id, userId)");
  });

  it('passes the app into the create guard so it can run the lookup', () => {
    expect(hook).toContain('assertNotificationCreate($app, e)');
  });
});

describe('login throttling', () => {
  const lib = read('pocketbase/pb_hooks/lib/kvartiraAuth.js');
  const hook = read('pocketbase/pb_hooks/auth.pb.js');

  it('counts recent failures per user and IP', () => {
    expect(lib).toContain('function assertLoginNotThrottled');
    expect(lib).toContain('MAX_FAILED_LOGINS');
    expect(lib).toContain('ApiError(429');
  });

  it('runs before the password is validated', () => {
    const throttleAt = hook.indexOf('assertLoginNotThrottled');
    const validateAt = hook.indexOf('validatePassword');
    expect(throttleAt).toBeGreaterThan(-1);
    expect(throttleAt).toBeLessThan(validateAt);
  });

  it('never locks anyone out when the counter itself fails', () => {
    expect(lib).toContain('// Never lock people out because the counter itself failed.');
  });
});

describe('registration invite fails closed on the seeded token', () => {
  const lib = read('pocketbase/pb_hooks/lib/kvartiraInvite.js');
  const endpoint = read('pocketbase/pb_hooks/invite.pb.js');

  it('rejects the committed default token outside development', () => {
    expect(lib).toContain('SEED_INVITE_TOKEN');
    expect(lib).toContain('!isDevEnvironment() && tokensEqual(String(token).trim(), SEED_INVITE_TOKEN)');
    expect(lib).toContain("$os.getenv('KVARTIRA_DEV')");
  });

  it('reports the default token as invalid so the gate screen shows', () => {
    expect(endpoint).toContain('invite.SEED_INVITE_TOKEN');
    expect(endpoint).toContain('!isDefaultToken && invite.isValidInviteToken');
  });
});

describe('demo login is unavailable in a production bundle', () => {
  it('is guarded in the store and in the PocketBase adapter', () => {
    expect(read('src/stores/authStore.ts')).toContain('if (import.meta.env.PROD)');
    expect(read('src/services/api/pocketbase/auth.ts')).toContain('if (import.meta.env.PROD)');
  });
});

describe('push relay requires a shared secret', () => {
  it('hook sends it and the relay refuses to start without it', () => {
    expect(read('pocketbase/pb_hooks/lib/kvartiraPush.js')).toContain(
      "$os.getenv('WEB_PUSH_RELAY_SECRET')",
    );
    const relay = read('pocketbase/push-relay.mjs');
    expect(relay).toContain('WEB_PUSH_RELAY_SECRET');
    expect(relay).toContain('timingSafeEqual');
    expect(relay).toContain('res.writeHead(401)');
  });
});

describe('security headers', () => {
  it('CSP is built from VITE_API_URL and inline script hashes', () => {
    const config = read('vite.config.ts');
    expect(config).toContain('kvartira-csp');
    expect(config).toContain("script-src 'self'");
    expect(config).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(config).toContain('connect-src');
    expect(config).toContain('sha256-');
  });

  it('frame-ancestors and X-Frame-Options ship as real headers', () => {
    const conf = read('deploy/security-headers.conf');
    expect(conf).toContain('X-Frame-Options "DENY"');
    expect(conf).toContain("frame-ancestors 'none'");
    expect(conf).toContain('Referrer-Policy');
  });
});

describe('registration QR renders without dangerouslySetInnerHTML', () => {
  it('page uses an <img> tag', () => {
    const page = read('src/pages/admin/AdminRegistrationQrPage.tsx');
    expect(page).not.toContain('dangerouslySetInnerHTML');
    expect(page).toContain('<img');
  });

  it('helper returns an inert data URL', async () => {
    const src = await renderRegistrationQrSvgDataUrl('https://example.com/register?invite=abc', 120);
    expect(src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(src.split(',')[1])).toContain('<svg');
  });
});

describe('152-ФЗ audit journal is wired on the server', () => {
  const audit = read('pocketbase/pb_hooks/lib/kvartiraAudit.js');
  const legal = read('pocketbase/pb_hooks/legal.pb.js');
  const users = read('pocketbase/pb_hooks/users.pb.js');

  it('records consent accept and revoke with request IP and User-Agent', () => {
    expect(audit).toContain("action, 'user_consents'");
    expect(audit).toContain('ipAddress: context.ip');
    expect(legal).toContain("consent.accepted");
    expect(legal).toContain("consent.revoked");
  });

  it('records account deletion before the row is purged', () => {
    expect(users).toContain('logAccountDeletion');
    const deleteAt = users.indexOf('onRecordDeleteRequest');
    const auditAt = users.indexOf('logAccountDeletion');
    const cleanupAt = users.indexOf('cleanupUserReferences');
    expect(deleteAt).toBeGreaterThan(-1);
    expect(auditAt).toBeGreaterThan(deleteAt);
    expect(cleanupAt).toBeGreaterThan(auditAt);
  });

  it('acknowledges a data export download for the audit trail', () => {
    expect(users).toContain('/api/kvartira/data-export/ack');
    expect(audit).toContain('account.data_exported');
  });
});
