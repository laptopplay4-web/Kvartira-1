import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  formatOwnPhoneDisplay,
  persistLoginPhone,
  resolveOwnPhoneNumber,
} from '@/services/auth/ownPhone';
import { useAuthStore } from '@/stores/authStore';

export function useOwnPhone(userId: string | undefined) {
  const sessionPhone = useAuthStore((s) => s.session?.user.phone);
  const updateSessionUser = useAuthStore((s) => s.updateSessionUser);

  const { data: profilePhone, isLoading } = useQuery({
    queryKey: ['users', 'me', userId, 'phone'],
    queryFn: async () => {
      if (!userId) return '';
      const profile = await api.users.getUser(userId, userId);
      return profile.phone ?? '';
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const phone = userId
    ? resolveOwnPhoneNumber(userId, profilePhone, sessionPhone)
    : '';

  useEffect(() => {
    if (!userId || !phone) return;
    persistLoginPhone(userId, phone);
    if (sessionPhone !== phone) {
      const current = useAuthStore.getState().session?.user;
      if (current?.id === userId) {
        updateSessionUser({ ...current, phone });
      }
    }
  }, [userId, phone, sessionPhone, updateSessionUser]);

  return {
    phone,
    display: formatOwnPhoneDisplay(phone),
    isLoading: !!userId && isLoading && !phone,
  };
}
