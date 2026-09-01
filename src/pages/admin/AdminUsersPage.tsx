import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '@/services/api';
import { getRoleLabel } from '@/permissions';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatUserName } from '@/utils';
import type { UserRole } from '@/types';

const ROLE_VARIANT: Record<UserRole, 'default' | 'brand' | 'info' | 'warning'> = {
  student: 'info',
  teacher: 'brand',
  admin: 'warning',
};

export default function AdminUsersPage() {
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
  });

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  const grouped = {
    admin: users?.filter((u) => u.role === 'admin') ?? [],
    teacher: users?.filter((u) => u.role === 'teacher') ?? [],
    student: users?.filter((u) => u.role === 'student') ?? [],
  };

  const isEmpty = !isLoading && users?.length === 0;

  return (
    <div className="page-container">
      <AdminPageHeader title="Пользователи" />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : isEmpty ? (
        <EmptyState
          icon={Users}
          title="Нет пользователей"
          description="В системе пока нет зарегистрированных пользователей."
          className="py-8"
        />
      ) : (
        (['admin', 'teacher', 'student'] as UserRole[]).map((role) => (
          <section key={role} className="mb-8">
            <h2 className="mb-3 text-label">{getRoleLabel(role)} ({grouped[role].length})</h2>
            <div className="space-y-2">
              {grouped[role].map((user) => (
                <Card key={user.id} className="flex items-center gap-3">
                  <Avatar firstName={user.firstName} lastName={user.lastName} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{formatUserName(user)}</p>
                    <p className="text-caption">{user.phone}</p>
                  </div>
                  <Badge variant={ROLE_VARIANT[user.role]}>{getRoleLabel(user.role)}</Badge>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
