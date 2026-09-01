import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';

const schema = z.object({
  phone: z
    .string()
    .min(12, 'Введите номер в формате +79XXXXXXXXX')
    .regex(/^\+79\d{9}$/, 'Формат: +79XXXXXXXXX'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '+7' },
  });

  const onSubmit = async (data: FormData) => {
    if (!isOnline) return;
    setError('');
    setIsSubmitting(true);
    try {
      const result = await api.auth.requestPasswordReset(data.phone);
      navigate('/reset-password', {
        state: { resetId: result.resetId, demoCode: result.demoCode },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить код');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="mb-4" />
          <h1 className="text-h1">Восстановление пароля</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            Введите телефон — мы отправим код для сброса пароля
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <Input
            label="Телефон"
            type="tel"
            placeholder="+79001234567"
            error={errors.phone?.message}
            {...register('phone')}
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
            Отправить код
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
