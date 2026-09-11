import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Users } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { getRoleLabel, getRoleBadgeVariant } from '@/permissions';
import { canToggleUserStaffRole } from '@/services/users/access';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { PromoteToTeacherModal } from '@/components/admin/PromoteToTeacherModal';
import { roleDemoteButtonClassName, rolePromoteButtonClassName } from '@/components/admin/roleActionButtons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPageHeader } from '@/components/ui/AdminPageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { UserPreviewTrigger } from '@/components/users/UserPreviewTrigger';
import { formatUserName } from '@/utils';
import type { User, UserRole } from '@/types';

const SECTION_ORDER: UserRole[] = ['admin', 'teacher', 'student'];

export default function AdminUsersPage() {
  const currentUser = useCurrentUser()!;
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(currentUser.id),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'student' | 'teacher' }) =>
      api.users.updateUserRole(currentUser.id, userId, role),
    onMutate: ({ userId }) => {
      setPromotingUserId(userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['teachers'] });
      void queryClient.invalidateQueries({ queryKey: ['public'] });
    },
    onSettled: () => {
      setPromotingUserId(null);
    },
  });

  if (error) return <div className="page-container"><ErrorState onRetry={() => refetch()} /></div>;

  const grouped = {
    admin: users?.filter((u) => u.role === 'admin') ?? [],
    teacher: users?.filter((u) => u.role === 'teacher') ?? [],
    student: users?.filter((u) => u.role === 'student') ?? [],
  };

  const isEmpty = !isLoading && users?.length === 0;
  const mutationError =
    roleMutation.error instanceof ApiError
      ? roleMutation.error.message
      : roleMutation.error
        ? 'Не удалось изменить роль'
        : '';

  function promoteToTeacher(userId: string) {
    if (!isOnline || roleMutation.isPending) return;
    roleMutation.mutate({ userId, role: 'teacher' });
  }

  function demoteToStudent(user: User) {
    if (!isOnline || roleMutation.isPending || !canToggleUserStaffRole(currentUser, user)) return;
    roleMutation.mutate({ userId: user.id, role: 'student' });
  }

  function renderUserCard(user: User, role: UserRole) {
    const showDemote =
      role === 'teacher' && canToggleUserStaffRole(currentUser, user);
    const isDemoting = promotingUserId === user.id && roleMutation.isPending;

    return (
      <Card key={user.id} className="flex items-center gap-3">
        <UserPreviewTrigger user={user} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-0">
          <Avatar
            src={user.avatarUrl}
            firstName={user.firstName}
            lastName={user.lastName}
          />
          <div className="min-w-0 flex-1 text-left">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-medium">{formatUserName(user)}</p>
              <Badge variant={getRoleBadgeVariant(user.role)} className="shrink-0">
                {getRoleLabel(user.role)}
              </Badge>
            </div>
            <p className="text-caption">{user.phone}</p>
          </div>
        </UserPreviewTrigger>
        {showDemote && (
          <Button
            type="button"
            variant="ghost"
            className={roleDemoteButtonClassName}
            loading={isDemoting}
            disabled={!isOnline || (roleMutation.isPending && !isDemoting)}
            onClick={() => demoteToStudent(user)}
            aria-label={`Сделать учеником: ${formatUserName(user)}`}
          >
            {!isDemoting && <Minus aria-hidden />}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="page-container">
      <AdminPageHeader title="Пользователи" />

      {!isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="status">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      {mutationError && (
        <p className="mb-4 text-body-sm text-danger" role="alert">
          {mutationError}
        </p>
      )}

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
        SECTION_ORDER.map((role) => (
          <section key={role} className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-label">
                {getRoleLabel(role)} ({grouped[role].length})
              </h2>
              {role === 'teacher' && (
                <IconButton
                  label="Добавить преподавателя"
                  className={rolePromoteButtonClassName}
                  disabled={!isOnline || grouped.student.length === 0}
                  onClick={() => setPromoteModalOpen(true)}
                >
                  <Plus className="h-5 w-5" aria-hidden />
                </IconButton>
              )}
            </div>
            <div className="space-y-2">
              {grouped[role].length > 0 ? (
                grouped[role].map((user) => renderUserCard(user, role))
              ) : (
                <Card className="py-4">
                  <p className="text-body-sm text-text-muted">Пока никого нет</p>
                </Card>
              )}
            </div>
          </section>
        ))
      )}

      <PromoteToTeacherModal
        open={promoteModalOpen}
        onClose={() => setPromoteModalOpen(false)}
        students={grouped.student}
        onPromote={promoteToTeacher}
        promotingUserId={promotingUserId}
        disabled={!isOnline}
      />
    </div>
  );
}
