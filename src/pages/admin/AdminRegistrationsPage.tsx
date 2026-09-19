import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { api } from '@/services/api';
import { useCurrentUser } from '@/stores/authStore';
import { filterPendingRegistrations } from '@/services/users/accountStatus';
import { sortUsersByRoleAndName } from '@/services/users/helpers';
import { PendingRegistrationCard } from '@/components/admin/PendingRegistrationCard';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminRegistrationsPage() {
  const currentUser = useCurrentUser()!;

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(currentUser.id),
  });

  const pending = sortUsersByRoleAndName(filterPendingRegistrations(users));

  if (error) {
    return (
      <div className="page-container">
        <AdminPageHeader title="Заявки" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <AdminPageHeader title="Заявки на регистрацию" />

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Нет заявок"
          description="Новые регистрации по QR появятся здесь."
          className="py-8"
        />
      ) : (
        <div className="space-y-3">
          {pending.map((user) => (
            <PendingRegistrationCard key={user.id} user={user} currentUser={currentUser} />
          ))}
        </div>
      )}
    </div>
  );
}
