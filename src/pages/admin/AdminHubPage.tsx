import { Link } from 'react-router-dom';
import { Building2, CalendarDays, ChevronRight, FileText, Users } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { can, type Permission } from '@/permissions';
import { BackLink } from '@/components/ui/BackLink';
import { Card } from '@/components/ui/Card';

const ADMIN_LINKS: { to: string; icon: typeof CalendarDays; label: string; permission: Permission }[] = [
  { to: '/admin/schedule', icon: CalendarDays, label: 'Расписание', permission: 'admin:schedule' },
  { to: '/admin/users', icon: Users, label: 'Пользователи', permission: 'admin:users' },
  { to: '/admin/school', icon: Building2, label: 'Школа', permission: 'admin:school-settings' },
  { to: '/admin/legal', icon: FileText, label: 'Документы', permission: 'legal:manage' },
];

export default function AdminHubPage() {
  const user = useCurrentUser()!;
  const items = ADMIN_LINKS.filter((item) => can(user, item.permission));

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
        {items.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}>
            <Card interactive className="flex min-h-11 items-center gap-3">
              <Icon className="h-5 w-5 text-text-muted" aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
