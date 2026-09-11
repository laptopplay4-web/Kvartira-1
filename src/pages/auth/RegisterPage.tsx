import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { QrCode, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Logo } from '@/components/ui/Logo';
import { DirectionPicker } from '@/components/directions/DirectionPicker';
import { Skeleton } from '@/components/ui/Skeleton';
import { PHONE_INCOMPLETE_MESSAGE, PHONE_STORAGE_REGEX } from '@/utils/phone';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { AUTH_PASSWORD_MIN_LENGTH } from '@/services/auth/constants';
import { INVALID_REGISTRATION_INVITE_MESSAGE } from '@/services/registration/constants';
import { ConsentCheckbox } from '@/components/legal/ConsentCheckbox';
import { CONSENT_ADULT_AGE } from '@/services/legal/constants';
import {
  getGuardianConsentDocument,
  getOptionalConsentDocuments,
  getRequiredConsentDocuments,
} from '@/services/legal/helpers';
import {
  clearPersistedRegistrationInviteToken,
  persistRegistrationInviteToken,
  resolveRegistrationInviteToken,
} from '@/services/registration/invite';

const schema = z
  .object({
    phone: z.string().regex(PHONE_STORAGE_REGEX, PHONE_INCOMPLETE_MESSAGE),
    password: z
      .string()
      .min(AUTH_PASSWORD_MIN_LENGTH, `Минимум ${AUTH_PASSWORD_MIN_LENGTH} символов`),
    confirmPassword: z.string(),
    firstName: z.string().min(2, 'Введите имя'),
    lastName: z.string().min(2, 'Введите фамилию'),
    directionIds: z.array(z.string()).min(1, 'Выберите хотя бы одно направление'),
    isMinor: z.boolean(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianRelation: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })
  .superRefine((d, ctx) => {
    if (!d.isMinor) return;
    if ((d.guardianName ?? '').trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianName'],
        message: 'Укажите фамилию, имя и отчество представителя',
      });
    }
    if (!PHONE_STORAGE_REGEX.test(d.guardianPhone ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianPhone'],
        message: PHONE_INCOMPLETE_MESSAGE,
      });
    }
    if ((d.guardianRelation ?? '').trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianRelation'],
        message: 'Например: мама, папа, опекун',
      });
    }
  });

type FormData = z.infer<typeof schema>;

function RegistrationInviteGate({ checking }: { checking: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="mb-4" />
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-brand)_25%,transparent)]">
            <ScanLine className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="text-h1">Регистрация по QR</h1>
          <p className="mt-3 text-body-sm text-text-secondary">
            Аккаунт ученика создаётся только после сканирования QR-кода в школе «Квартира».
            Код размещён на стенде у входа.
          </p>
        </div>

        {checking ? (
          <div className="mt-8 space-y-3" aria-busy="true" aria-label="Проверка приглашения">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : (
          <div className="mt-8 space-y-4 rounded-2xl border border-border-subtle bg-surface-elevated/80 p-5">
            <div className="flex items-start gap-3 text-left text-body-sm text-text-secondary">
              <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
              <p>
                Откройте камеру телефона, наведите на распечатанный QR — браузер откроет форму
                регистрации с действующим приглашением.
              </p>
            </div>
            <p className="text-body-sm text-text-muted" role="status">
              {INVALID_REGISTRATION_INVITE_MESSAGE}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-body-sm text-text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-brand hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registerUser = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [error, setError] = useState('');

  const inviteToken = useMemo(
    () => resolveRegistrationInviteToken({ search: searchParams.toString() }),
    [searchParams],
  );

  useEffect(() => {
    if (inviteToken) persistRegistrationInviteToken(inviteToken);
  }, [inviteToken]);

  const inviteQuery = useQuery({
    queryKey: ['registration-invite', 'validate', inviteToken ?? ''],
    queryFn: () => api.auth.validateRegistrationInvite(inviteToken!),
    enabled: !!inviteToken,
    staleTime: 60_000,
    retry: false,
  });

  const inviteValid = !!inviteToken && inviteQuery.data?.valid === true;
  const inviteChecking = !!inviteToken && inviteQuery.isLoading;

  const { data: legalDocs = [] } = useQuery({
    queryKey: ['legal', 'documents'],
    queryFn: () => api.legal.getDocuments(),
    enabled: inviteValid,
  });

  const requiredDocs = useMemo(() => getRequiredConsentDocuments(legalDocs), [legalDocs]);
  const optionalDocs = useMemo(() => getOptionalConsentDocuments(legalDocs), [legalDocs]);
  const guardianDoc = useMemo(() => getGuardianConsentDocument(legalDocs), [legalDocs]);

  // Nothing is pre-checked: a pre-ticked box is not consent under 152-ФЗ.
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});
  const [consentError, setConsentError] = useState('');

  const toggleConsent = (documentId: string, checked: boolean) => {
    setAcceptedIds((prev) => ({ ...prev, [documentId]: checked }));
    setConsentError('');
  };

  const { data: directions = [], isLoading: directionsLoading } = useQuery({
    queryKey: ['directions'],
    queryFn: () => api.lessons.getDirections(),
    enabled: inviteValid,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '+7', directionIds: [], isMinor: false, guardianPhone: '+7' },
  });

  const isMinorSelected = watch('isMinor');

  const onSubmit = async (data: FormData) => {
    if (!inviteToken) {
      setError(INVALID_REGISTRATION_INVITE_MESSAGE);
      return;
    }

    const missingRequired = requiredDocs.filter((doc) => !acceptedIds[doc.id]);
    if (missingRequired.length > 0) {
      setConsentError('Без обязательных согласий аккаунт создать нельзя');
      return;
    }
    if (data.isMinor && guardianDoc && !acceptedIds[guardianDoc.id]) {
      setConsentError('Нужно согласие законного представителя');
      return;
    }

    setError('');
    setConsentError('');
    try {
      await registerUser(
        data.phone,
        data.password,
        data.firstName,
        data.lastName,
        data.directionIds,
        inviteToken,
      );
      const userId = useAuthStore.getState().session?.user.id;
      if (userId) {
        const guardianConsentId =
          data.isMinor && guardianDoc && acceptedIds[guardianDoc.id] ? guardianDoc.id : null;
        const documentIds = [
          ...requiredDocs.map((doc) => doc.id),
          ...optionalDocs.filter((doc) => acceptedIds[doc.id]).map((doc) => doc.id),
        ];

        if (documentIds.length > 0) {
          await api.legal.acceptDocuments(documentIds, userId);
        }
        if (guardianConsentId) {
          await api.legal.acceptDocument(guardianConsentId, userId, {
            guardian: {
              fullName: (data.guardianName ?? '').trim(),
              phone: (data.guardianPhone ?? '').trim(),
              relation: (data.guardianRelation ?? '').trim(),
            },
          });
        }
      }
      clearPersistedRegistrationInviteToken();
      navigate('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Ошибка регистрации');
    }
  };

  if (!inviteValid) {
    return <RegistrationInviteGate checking={inviteChecking} />;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" className="mb-4" />
          <h1 className="text-h1">Регистрация</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            Приглашение школы подтверждено — создайте аккаунт ученика
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Имя" error={errors.firstName?.message} {...register('firstName')} />
            <Input label="Фамилия" error={errors.lastName?.message} {...register('lastName')} />
          </div>
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
          <Input label="Пароль" type="password" error={errors.password?.message} {...register('password')} />
          <Input
            label="Подтверждение пароля"
            type="password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Controller
            name="directionIds"
            control={control}
            render={({ field }) => (
              <DirectionPicker
                directions={directions}
                value={field.value}
                onChange={field.onChange}
                disabled={directionsLoading}
                error={errors.directionIds?.message}
                label="Направление обучения"
                hint="Можно выбрать несколько, если занимаетесь по разным направлениям"
              />
            )}
          />

          <fieldset className="space-y-3">
            <legend className="text-body-sm font-medium">Согласия</legend>
            <p className="text-caption text-text-muted">
              Каждая цель обработки данных подтверждается отдельно. Согласия по желанию можно
              не давать сейчас и отозвать позже в профиле.
            </p>

            {requiredDocs.map((doc) => (
              <ConsentCheckbox
                key={doc.id}
                document={doc}
                required
                checked={!!acceptedIds[doc.id]}
                onChange={(checked) => toggleConsent(doc.id, checked)}
              />
            ))}

            {optionalDocs.map((doc) => (
              <ConsentCheckbox
                key={doc.id}
                document={doc}
                checked={!!acceptedIds[doc.id]}
                onChange={(checked) => toggleConsent(doc.id, checked)}
              />
            ))}

            {guardianDoc && (
              <Controller
                name="isMinor"
                control={control}
                render={({ field }) => (
                  <label className="flex items-start gap-3 text-body-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-subtle text-brand focus-ring"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                    <span>Ученику меньше {CONSENT_ADULT_AGE} лет</span>
                  </label>
                )}
              />
            )}

            {guardianDoc && isMinorSelected && (
              <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-elevated/60 p-3">
                <p className="text-caption text-text-muted">
                  За несовершеннолетнего согласие даёт законный представитель.
                </p>
                <Input
                  label="ФИО представителя"
                  error={errors.guardianName?.message}
                  {...register('guardianName')}
                />
                <Controller
                  name="guardianPhone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      label="Телефон представителя"
                      error={errors.guardianPhone?.message}
                      value={field.value ?? '+7'}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
                <Input
                  label="Кем приходится ученику"
                  placeholder="мама, папа, опекун"
                  error={errors.guardianRelation?.message}
                  {...register('guardianRelation')}
                />
                <ConsentCheckbox
                  document={guardianDoc}
                  required
                  checked={!!acceptedIds[guardianDoc.id]}
                  onChange={(checked) => toggleConsent(guardianDoc.id, checked)}
                />
              </div>
            )}

            <p className="text-caption text-text-muted">
              Полные тексты —{' '}
              <Link to="/legal" className="text-brand hover:underline" target="_blank">
                документы школы
              </Link>
              .
            </p>
          </fieldset>

          {consentError && (
            <p className="text-sm text-danger" role="alert">
              {consentError}
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
