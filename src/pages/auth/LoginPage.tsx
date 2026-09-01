import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/types';
import { GraduationCap, Music, Shield } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const schema = z.object({
  phone: z
    .string()
    .min(12, 'Введите номер в формате +79XXXXXXXXX')
    .regex(/^\+79\d{9}$/, 'Формат: +79XXXXXXXXX'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const passwordResetSuccess = Boolean(
    (location.state as { passwordResetSuccess?: boolean } | null)?.passwordResetSuccess,
  );
  const { login, demoLogin, isLoading } = useAuthStore();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
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

  const handleDemo = async (role: 'student' | 'teacher' | 'admin') => {
    setError('');
    try {
      await demoLogin(role);
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
          <Input
            label="Телефон"
            type="tel"
            placeholder="+79001234567"
            error={errors.phone?.message}
            {...register('phone')}
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

        <div className="mt-8">
          <p className="mb-3 text-center text-caption">Быстрый вход для демо</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleDemo('student')}
              disabled={isLoading}
              className="flex-col h-auto py-3 gap-1"
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
              <span className="text-xs">Ученик</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleDemo('teacher')}
              disabled={isLoading}
              className="flex-col h-auto py-3 gap-1"
            >
              <Music className="h-4 w-4" aria-hidden />
              <span className="text-xs">Препод.</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleDemo('admin')}
              disabled={isLoading}
              className="flex-col h-auto py-3 gap-1"
            >
              <Shield className="h-4 w-4" aria-hidden />
              <span className="text-xs">Админ</span>
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-body-sm text-text-muted">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-brand hover:underline focus-ring rounded">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
