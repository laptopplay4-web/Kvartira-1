import { describe, it, expect } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { router } from '@/app/router';

function collectPaths(routes: RouteObject[]): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    if (route.path) paths.push(route.path);
    if (route.children) paths.push(...collectPaths(route.children));
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
    expect(paths).toContain('/profile');
    expect(paths).toContain('/profile/availability');
    expect(paths).toContain('/profile/progress');
    expect(paths).toContain('/profile/help');
    expect(paths).toContain('/profile/help/:id');
    expect(paths).toContain('/profile/security');
    expect(paths).toContain('/profile/legal');
    expect(paths).toContain('/legal');
    expect(paths).toContain('/legal/:id');
    expect(paths).toContain('/directions/:id');
    expect(paths).toContain('/teachers/:id');
    expect(paths).toContain('/assignments');
    expect(paths).toContain('/assignments/create');
    expect(paths).toContain('/assignments/:id');
    expect(paths).toContain('/admin');
    expect(paths).toContain('/admin/schedule');
    expect(paths).toContain('/admin/users');
    expect(paths).toContain('/admin/legal');
    expect(paths).toContain('/admin/events');
    expect(paths).toContain('/admin/school');
    expect(paths).toContain('/forgot-password');
    expect(paths).toContain('/reset-password');
  });
});
