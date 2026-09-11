import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Music2 } from 'lucide-react';

import { AvatarPhotoViewer } from '@/components/profile/AvatarPhotoViewer';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { getRoleBadgeVariant, getRoleLabel } from '@/permissions';
import { api } from '@/services/api';
import { getAvatarFullPhotoUrl, hasAvatarPhoto } from '@/services/profile/avatar';
import { isDisplayableAvatarSrc } from '@/services/profile/constants';
import {
  formatUserDirectionLabels,
  resolveUserDirections,
} from '@/services/users/helpers';
import { cn, formatUserName } from '@/utils';
import type { User } from '@/types';

interface UserPreviewModalProps {
  open: boolean;
  userId: string | null;
  seedUser?: User | null;
  requesterId: string;
  onClose: () => void;
}

export function UserPreviewModal({
  open,
  userId,
  seedUser,
  requesterId,
  onClose,
}: UserPreviewModalProps) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const enabled = open && !!userId && !!requesterId;

  useEffect(() => {
    if (!open) setPhotoOpen(false);
  }, [open]);

  const {
    data: fetchedUser,
    isLoading: userLoading,
    isError: userError,
  } = useQuery({
    queryKey: ['user-preview', userId, requesterId],
    queryFn: () => api.users.getUser(userId!, requesterId),
    enabled,
    staleTime: 60_000,
  });

  const { data: directions = [], isLoading: directionsLoading } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled,
    staleTime: 5 * 60_000,
  });

  const user = fetchedUser ?? (seedUser?.id === userId ? seedUser : null);
  const loading = enabled && !user && userLoading;
  const displayName = user ? formatUserName(user) : 'Профиль';
  const userDirections = user ? resolveUserDirections(user, directions) : [];
  const directionLabel = user ? formatUserDirectionLabels(user, directions) : '';
  const fullPhotoUrl = user ? getAvatarFullPhotoUrl(user) : undefined;
  const canViewPhoto = !!user && hasAvatarPhoto(user) && isDisplayableAvatarSrc(fullPhotoUrl);

  return (
    <>
      <Modal open={open && !!userId} onClose={onClose} title="Профиль" className="sm:max-w-sm">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-4" aria-busy>
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : userError && !user ? (
          <p className="py-6 text-center text-body-sm text-text-muted" role="alert">
            Не удалось загрузить профиль
          </p>
        ) : user ? (
          <div className="flex flex-col items-center gap-4 pb-1 pt-2 text-center">
            {canViewPhoto ? (
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                aria-label={`Открыть фото: ${displayName}`}
                className={cn(
                  'relative rounded-full bg-gradient-to-br from-brand/35 via-brand/10 to-transparent p-[3px]',
                  'motion-safe:animate-scale-in focus-ring transition-transform active:scale-[0.97]',
                )}
              >
                <Avatar
                  src={user.avatarUrl}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  size="lg"
                  className="h-24 w-24 text-2xl ring-2 ring-surface"
                />
              </button>
            ) : (
              <div
                className={cn(
                  'relative motion-safe:animate-scale-in',
                  'rounded-full bg-gradient-to-br from-brand/35 via-brand/10 to-transparent p-[3px]',
                )}
              >
                <Avatar
                  src={user.avatarUrl}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  size="lg"
                  className="h-24 w-24 text-2xl ring-2 ring-surface"
                />
              </div>
            )}

            <div className="min-w-0 space-y-2">
              <h3 className="truncate text-h2">{displayName}</h3>
              <Badge variant={getRoleBadgeVariant(user.role)} className="mx-auto">
                {getRoleLabel(user.role)}
              </Badge>
            </div>

            <div className="w-full space-y-2 border-t border-border-subtle pt-4 text-left">
              <p className="flex items-center gap-1.5 text-caption font-medium text-text-muted">
                <Music2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Направления
              </p>
              {directionsLoading && !directionLabel ? (
                <Skeleton className="h-8 w-full rounded-xl" />
              ) : userDirections.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label={directionLabel}>
                  {userDirections.map((direction, index) => (
                    <li key={direction.id}>
                      <span
                        className={cn(
                          'inline-flex rounded-xl border border-border-subtle bg-surface-elevated px-3 py-1.5 text-body-sm text-text-secondary',
                          'motion-safe:animate-fade-in',
                        )}
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        {direction.name}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-text-muted">Направления не указаны</p>
              )}
            </div>

            {user.bio?.trim() ? (
              <p className="w-full border-t border-border-subtle pt-4 text-left text-body-sm text-text-secondary">
                {user.bio.trim()}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <AvatarPhotoViewer
        open={photoOpen}
        src={fullPhotoUrl}
        alt={`Фото профиля ${displayName}`}
        onClose={() => setPhotoOpen(false)}
      />
    </>
  );
}
