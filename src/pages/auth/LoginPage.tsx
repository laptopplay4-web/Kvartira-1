import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/types';
import { Logo } from '@/components/ui/Logo';
import { PHONE_INCOMPLETE_MESSAGE, PHONE_STORAGE_REGEX } from '@/utils/phone';

const schema = z.object({
  phone: z.string().regex(PHONE_STORAGE_REGEX, PHONE_INCOMPLETE_MESSAGE),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const passwordResetSuccess = Boolean(
    (location.state as { passwordResetSuccess?: boolean } | null)?.passwordResetSuccess,
  );
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '+7', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await login(data.phone, data.password);
      navigate('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка входа');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" className="mb-4" />
          <p className="text-body-sm text-text-secondary">Войдите в аккаунт</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                label="Телефон"
                error={errors.phone?.message}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
          <Input
            label="Пароль"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-body-sm text-brand hover:underline focus-ring rounded"
            >
              Забыли пароль?
            </Link>
          </div>
          {passwordResetSuccess && (
            <p className="text-sm text-success" role="status">
              Пароль обновлён. Войдите с новым паролем.
            </p>
          )}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" fullWidth loading={isLoading}>
            Войти
          </Button>
        </form>

        <p className="mt-8 text-center text-caption text-text-muted">
          <Link to="/legal" className="hover:text-brand hover:underline focus-ring rounded">
            Политика конфиденциальности и документы
          </Link>
        </p>
      </div>
    </div>
  );
}
