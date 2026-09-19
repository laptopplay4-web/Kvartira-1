import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  HelpCircle,
  Link2,
  Music2,
  QrCode,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { can, type Permission } from '@/permissions';
import { api } from '@/services/api';
import { countOpenSupportTickets } from '@/services/support/adminInbox';
import { countPendingRegistrations } from '@/services/users/accountStatus';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils';

const ADMIN_LINKS: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
  permission: Permission;
  badgeKey?: 'support' | 'registrations';
}[] = [
  {
    to: '/admin/registrations',
    icon: UserPlus,
    label: 'Заявки',
    permission: 'admin:users',
    badgeKey: 'registrations',
  },
  { to: '/admin/help', icon: HelpCircle, label: 'Помощь', permission: 'support:view-all-tickets', badgeKey: 'support' },
  { to: '/admin/schedule', icon: CalendarDays, label: 'Расписание', permission: 'admin:schedule' },
  { to: '/admin/users', icon: Users, label: 'Пользователи', permission: 'admin:users' },
  { to: '/admin/directions', icon: Music2, label: 'Направления', permission: 'admin:directions' },
  { to: '/admin/registration-qr', icon: QrCode, label: 'QR регистрации', permission: 'admin:school-settings' },
  { to: '/admin/yclients', icon: Link2, label: 'YCLIENTS', permission: 'admin:school-settings' },
  { to: '/admin/school', icon: Building2, label: 'Школа', permission: 'admin:school-settings' },
  { to: '/admin/legal', icon: FileText, label: 'Документы', permission: 'legal:manage' },
];

export default function AdminHubPage() {
  const user = useCurrentUser()!;
  const items = ADMIN_LINKS.filter((item) => can(user, item.permission));

  const showSupportBadge = can(user, 'support:view-all-tickets');
  const { data: openTickets } = useQuery({
    queryKey: ['support', 'tickets', 'admin-open-count', user.id],
    queryFn: () => api.support.getTickets({ requesterId: user.id, status: 'open' }),
    enabled: showSupportBadge,
  });
  const supportBadge = countOpenSupportTickets(openTickets);

  const showRegistrationsBadge = can(user, 'admin:users');
  const { data: allUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(user.id),
    enabled: showRegistrationsBadge,
  });
  const registrationsBadge = countPendingRegistrations(allUsers);

  return (
    <div className="page-container max-w-lg">
      <header className="mb-6">
        <BackLink label="Профиль" fallbackTo="/profile" />
        <h1 className="text-h1">Администрирование</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          Настройки школы. Роль администратора задаётся в PocketBase.
        </p>
      </header>

      <div className="space-y-2">
        {items.map(({ to, icon: Icon, label, badgeKey }) => {
          const badge =
            badgeKey === 'support'
              ? supportBadge
              : badgeKey === 'registrations'
                ? registrationsBadge
                : 0;
          return (
            <Link key={to} to={to}>
              <Card interactive className="flex min-h-11 items-center gap-3">
                <Icon className="h-5 w-5 text-text-muted" aria-hidden />
                <span className="flex-1 font-medium">{label}</span>
                {badge > 0 && (
                  <span
                    className={cn(
                      'flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-contrast',
                    )}
                    aria-label={
                      badgeKey === 'registrations'
                        ? `${badge} заявок на регистрацию`
                        : `${badge} открытых обращений`
                    }
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
