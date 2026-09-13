import { NavLink, Link, useLocation } from 'react-router-dom';
import { Home, Calendar, MessageCircle, Sparkles, User, Shield } from 'lucide-react';
import { cn } from '@/utils';
import { can } from '@/permissions';
import { useCurrentUser } from '@/stores/authStore';
import { Logo } from '@/components/ui/Logo';
import { SchoolAboutButton } from '@/components/school/SchoolAboutButton';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: number;
}

interface BottomNavProps {
  chatBadge?: number;
  eventsBadge?: number;
}

export function BottomNav({ chatBadge = 0, eventsBadge = 0 }: BottomNavProps) {
  const items: NavItem[] = [
    { to: '/home', label: 'Главная', icon: Home },
    { to: '/lessons', label: 'Занятия', icon: Calendar },
    { to: '/chat', label: 'Чат', icon: MessageCircle, badge: chatBadge },
    { to: '/events', label: 'События', icon: Sparkles, badge: eventsBadge },
    { to: '/profile', label: 'Профиль', icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface/95 backdrop-blur-md pb-[var(--spacing-safe-bottom)] md:hidden"
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home'}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-caption transition-colors focus-ring',
                isActive
                  ? 'font-medium text-brand'
                  : 'text-text-muted hover:bg-surface-elevated hover:text-text-secondary',
              )
            }
          >
            <span className="relative">
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              {badge != null && badge > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-contrast">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function SidebarNav({ chatBadge = 0, eventsBadge = 0 }: BottomNavProps) {
  const user = useCurrentUser();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const items: NavItem[] = [
    { to: '/home', label: 'Главная', icon: Home },
    { to: '/lessons', label: 'Занятия', icon: Calendar },
    { to: '/chat', label: 'Чат', icon: MessageCircle, badge: chatBadge },
    { to: '/events', label: 'События', icon: Sparkles, badge: eventsBadge },
    { to: '/profile', label: 'Профиль', icon: User },
  ];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border-subtle bg-surface p-4 md:flex">
      <div className="mb-8 px-2">
        <div className="flex items-center gap-1">
          <NavLink to="/home" className="focus-ring inline-block rounded-lg" aria-label="На главную">
            <Logo size="md" />
          </NavLink>
          <SchoolAboutButton />
        </div>
        <p className="mt-2 text-caption">Школа музыки</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Основная навигация">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/home'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring',
                isActive
                  ? 'bg-brand-muted text-brand'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
              )
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            <span className="flex-1">{label}</span>
            {badge != null && badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-contrast">
                {badge}
              </span>
            )}
          </NavLink>
        ))}
        {user && can(user, 'admin:access') && (
          <Link
            to="/admin"
            aria-current={isAdminRoute ? 'page' : undefined}
            className={cn(
              'mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring',
              isAdminRoute
                ? 'bg-accent-muted text-accent'
                : 'text-text-secondary hover:bg-surface-elevated',
            )}
          >
            <Shield className="h-5 w-5" aria-hidden />
            Админ
          </Link>
        )}
      </nav>
    </aside>
  );
}
