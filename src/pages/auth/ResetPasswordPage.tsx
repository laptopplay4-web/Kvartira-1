import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { PASSWORD_RESET_MIN_LENGTH } from '@/services/auth/constants';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';

const schema = z
  .object({
    code: z
      .string()
      .length(6, 'Код — 6 цифр')
      .regex(/^\d+$/, 'Код должен содержать только цифры'),
    newPassword: z.string().min(PASSWORD_RESET_MIN_LENGTH, `Минимум ${PASSWORD_RESET_MIN_LENGTH} символов`),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

interface ResetLocationState {
  resetId?: string;
  demoCode?: string;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as ResetLocationState;
  const resetId = state.resetId;
  const isOnline = useOnlineStatus();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  if (!resetId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <Logo size="lg" className="mx-auto mb-4" />
          <p className="text-body-sm text-text-secondary">
            Сначала запросите код восстановления пароля
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block text-brand hover:underline focus-ring rounded"
          >
            Восстановить пароль
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    if (!isOnline) return;
    setError('');
    setIsSubmitting(true);
    try {
      await api.auth.completePasswordReset({
        resetId,
        code: data.code,
        newPassword: data.newPassword,
      });
      navigate('/login', {
        state: { passwordResetSuccess: true },
        replace: true,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сменить пароль');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="mb-4" />
          <h1 className="text-h1">Новый пароль</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            Введите код из SMS и задайте новый пароль
          </p>
        </div>

        {state.demoCode && (
          <p className="mt-6 rounded-lg border border-border-subtle bg-surface-elevated px-4 py-3 text-center text-body-sm text-text-secondary">
            Демо-код: <span className="font-mono text-text-primary">{state.demoCode}</span>
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input
            label="Код из SMS"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            error={errors.code?.message}
            {...register('code')}
          />
          <Input
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            label="Подтверждение пароля"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {!isOnline && (
            <p className="text-sm text-danger" role="status">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting} disabled={!isOnline}>
            Сохранить пароль
          </Button>
        </form>

        <p className="mt-6 text-center text-body-sm text-text-muted">
          <Link to="/login" className="text-brand hover:underline focus-ring rounded">
            ← Вернуться ко входу
          </Link>
        </p>
      </div>
    </div>
  );
}
