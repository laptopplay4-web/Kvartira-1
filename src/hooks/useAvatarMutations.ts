import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/authStore';

import { api } from '@/services/api';

import { ApiError } from '@/services/api/types';

export function useAvatarMutations(userId: string) {
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);
  const queryClient = useQueryClient();
  const [avatarError, setAvatarError] = useState('');

  const uploadAvatarMutation = useMutation({
    mutationFn: (input: Parameters<typeof api.users.uploadAvatar>[1]) =>
      api.users.uploadAvatar(userId, input),
    onSuccess: (updated) => {
      updateSessionUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setAvatarError('');
    },
    onError: (e) => {
      setAvatarError(e instanceof ApiError ? e.message : 'Не удалось загрузить фото');
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => api.users.removeAvatar(userId),
    onSuccess: (updated) => {
      updateSessionUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setAvatarError('');
    },
    onError: (e) => {
      setAvatarError(e instanceof ApiError ? e.message : 'Не удалось удалить фото');
    },
  });

  return {
    avatarError,
    setAvatarError,
    uploadAvatarMutation,
    removeAvatarMutation,
  };
}
