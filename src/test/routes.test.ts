import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { router } from '@/app/router';

function collectPaths(routes: RouteObject[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    const segment = route.path ?? '';
    const full =
      segment === ''
        ? prefix
        : segment.startsWith('/')
          ? segment
          : `${prefix}/${segment}`.replace(/\/+/g, '/');

    if (segment) paths.push(full);
    if (route.children) paths.push(...collectPaths(route.children, full || prefix));
  }
  return paths;
}

describe('router', () => {
  it('defines main routes', () => {
    const paths = collectPaths(router.routes);
    expect(paths).toContain('/home');
    expect(paths).toContain('/lessons');
    expect(paths).toContain('/lessons/book');
    expect(paths).toContain('/chat');
    expect(paths).toContain('/events');
    expect(paths).toContain('/events/archive');
    expect(paths).toContain('/profile');
    expect(paths).toContain('/profile/settings');
    expect(paths).toContain('/lessons/availability');
    expect(paths).toContain('/profile/availability');
    expect(paths).toContain('/profile/progress');
    expect(paths).toContain('/profile/help');
    expect(paths).toContain('/profile/help/:id');
    expect(paths).toContain('/profile/settings/account');
    expect(paths).toContain('/profile/directions');
    expect(paths).toContain('/profile/settings/system');
    expect(paths).toContain('/profile/settings/security');
    expect(paths).toContain('/profile/security');
    expect(paths).toContain('/profile/legal');
    expect(paths).toContain('/legal');
    expect(paths).toContain('/legal/:id');
    expect(paths).toContain('/directions/:id');
    expect(paths).toContain('/teachers/:id');
    expect(paths).toContain('/assignments');
    expect(paths).toContain('/assignments/groups');
    expect(paths).toContain('/assignments/groups/:id');
    expect(paths).toContain('/assignments/create');
    expect(paths).toContain('/assignments/:id/edit');
    expect(paths).toContain('/assignments/:id');
    expect(paths).toContain('/admin');
    expect(paths).toContain('/admin/help');
    expect(paths).toContain('/admin/help/:id');
    expect(paths).toContain('/admin/schedule');
    expect(paths).toContain('/admin/users');
    expect(paths).toContain('/admin/legal');
    expect(paths).toContain('/admin/events');
    expect(paths).toContain('/admin/school');
    expect(paths).toContain('/admin/registration-qr');
    expect(paths).toContain('/admin/directions');
    expect(paths).toContain('/forgot-password');
    expect(paths).toContain('/reset-password');
  });
});
