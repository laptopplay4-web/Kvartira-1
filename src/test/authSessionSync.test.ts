import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mockAuthApi } from '@/services/api/mock';

const ROOT = resolve(import.meta.dirname, '../..');

describe('auth session sync (PocketBase role refresh)', () => {
  it('mock refreshSession is a no-op', async () => {
    expect(await mockAuthApi.refreshSession()).toBeNull();
  });

  it('pocketbase auth exposes refreshSession', () => {
    const source = readFileSync(
      resolve(ROOT, 'src/services/api/pocketbase/auth.ts'),
      'utf8',
    );
    expect(source).toContain('refreshSession');
    expect(source).toContain("collection('users').getOne");
    expect(source).toContain('setPocketBaseAuth');
  });

  it('authStore syncSession clears cache on role change', () => {
    const source = readFileSync(resolve(ROOT, 'src/stores/authStore.ts'), 'utf8');
    expect(source).toContain('syncSession');
    expect(source).toContain('refreshSession');
    expect(source).toContain('roleChanged');
    expect(source).toContain('clearAppQueryCache');
    expect(source).toContain('resolveBootstrapSession');
    expect(source).not.toContain('if (!session) {\n          if (isPocketBaseMode()) clearPocketBaseAuth();');
  });

  it('ProtectedRoute waits for auth hydration', () => {
    const source = readFileSync(resolve(ROOT, 'src/app/layouts.tsx'), 'utf8');
    expect(source).toContain('useAuthStore.persist.hasHydrated()');
    expect(source).toContain('AuthRouteLoading');
  });

  it('ProtectedRoute wires useAuthSessionSync', () => {
    const source = readFileSync(resolve(ROOT, 'src/app/layouts.tsx'), 'utf8');
    expect(source).toContain('useAuthSessionSync');
  });

  it('useAuthSessionSync subscribes to users collection', () => {
    const source = readFileSync(
      resolve(ROOT, 'src/hooks/useAuthSessionSync.ts'),
      'utf8',
    );
    expect(source).toContain("collection('users')");
    expect(source).toContain(".subscribe(userId");
    expect(source).toContain("event.action === 'update'");
    expect(source).toContain("event.action === 'delete'");
    expect(source).toContain('logout');
    expect(source).toContain("addEventListener('focus'");
    expect(source).not.toMatch(/void syncSession\(\);\s*\n\s*const onFocus/);
  });
});
