import { NavLink, Outlet } from 'react-router-dom';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { can } from '@/permissions';
import { cn } from '@/utils';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'shrink-0 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors focus-ring',
    isActive ? 'bg-brand-muted text-brand' : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
  );

export default function SettingsLayout() {
  const user = useCurrentUser()!;
  const showSecurity = can(user, 'security:view-own');

  return (
    <div className="page-container max-w-lg">
      <BackLink label="Профиль" fallbackTo="/profile" />

      <h1 className="text-h1 mb-4">Настройки</h1>

      <nav
        className="mb-6 flex gap-1 overflow-x-auto pb-1"
        aria-label="Разделы настроек"
      >
        <NavLink to="/profile/settings/account" className={tabClass} end>
          Аккаунт
        </NavLink>
        <NavLink to="/profile/settings/system" className={tabClass}>
          Системные настройки
        </NavLink>
        {showSecurity && (
          <NavLink to="/profile/settings/security" className={tabClass}>
            Безопасность
          </NavLink>
        )}
      </nav>

      <Outlet />
    </div>
  );
}
