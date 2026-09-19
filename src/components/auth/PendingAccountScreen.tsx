import { useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

/** Full-screen gate while accountStatus === pending (login allowed). */
export function PendingAccountScreen() {
  const logout = useAuthStore((s) => s.logout);
  const syncSession = useAuthStore((s) => s.syncSession);

  useEffect(() => {
    void syncSession();
    const onFocus = () => {
      void syncSession();
    };
    const timer = window.setInterval(() => {
      void syncSession();
    }, 4000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncSession]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <Logo size="lg" className="mb-8" />
      <h1 className="text-center text-h1">Ожидайте подтверждения</h1>
      <p className="mt-3 max-w-sm text-center text-body-sm text-text-secondary">
        Заявка отправлена администратору школы. Когда аккаунт подтвердят, приложение откроется
        автоматически — перелогиниваться не нужно.
      </p>
      <Button
        variant="secondary"
        className="mt-8"
        onClick={() => {
          void logout();
        }}
      >
        Выйти
      </Button>
    </div>
  );
}
