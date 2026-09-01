import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { AUTH_PASSWORD_MIN_LENGTH } from '@/services/auth/constants';

const schema = z
  .object({
    phone: z.string().regex(/^\+79\d{9}$/, 'Формат: +79XXXXXXXXX'),
    password: z
      .string()
      .min(AUTH_PASSWORD_MIN_LENGTH, `Минимум ${AUTH_PASSWORD_MIN_LENGTH} символов`),
    confirmPassword: z.string(),
    firstName: z.string().min(2, 'Введите имя'),
    lastName: z.string().min(2, 'Введите фамилию'),
    acceptLegal: z.literal(true, {
      errorMap: () => ({ message: 'Необходимо принять условия документов' }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [error, setError] = useState('');

  const { data: requiredDocs } = useQuery({
    queryKey: ['legal', 'documents', 'required'],
    queryFn: async () => {
      const docs = await api.legal.getDocuments();
      return docs.filter((d) => d.requiresConsent);
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '+7', acceptLegal: undefined },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      await registerUser(data.phone, data.password, data.firstName, data.lastName);
      const userId = useAuthStore.getState().session?.user.id;
      if (userId && requiredDocs?.length) {
        await api.legal.acceptDocuments(
          requiredDocs.map((d) => d.id),
          userId,
        );
      }
      navigate('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка регистрации');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="mb-4" />
          <h1 className="text-h1">Регистрация</h1>
          <p className="mt-2 text-body-sm text-text-secondary">Создайте аккаунт ученика</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Имя" error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Фамилия" error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <Input label="Телефон" type="tel" error={errors.phone?.message} {...register('phone')} />
          <Input label="Пароль" type="password" error={errors.password?.message} {...register('password')} />
          <Input
            label="Подтверждение пароля"
            type="password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Controller
            name="acceptLegal"
            control={control}
            render={({ field }) => (
              <label className="flex items-start gap-3 text-body-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border-subtle text-brand focus-ring"
                  checked={field.value === true}
                  onChange={(e) => field.onChange(e.target.checked ? true : undefined)}
                />
                <span>
                  Я принимаю{' '}
                  <Link to="/legal" className="text-brand hover:underline" target="_blank">
                    документы и согласия
                  </Link>{' '}
                  школы
                </span>
              </label>
            )}
          />
          {errors.acceptLegal && (
            <p className="text-sm text-danger" role="alert">
              {errors.acceptLegal.message}
            </p>
          )}

          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" fullWidth loading={isLoading}>
            Зарегистрироваться
          </Button>
        </form>

        <p className="mt-6 text-center text-body-sm text-text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-brand hover:underline">Войти</Link>
        </p>
      </div>
    </div>
  );
}
