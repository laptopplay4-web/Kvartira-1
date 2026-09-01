import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { canCreateAssignment } from '@/services/assignments/access';
import { MAX_MATERIALS_PER_ASSIGNMENT } from '@/services/assignments/constants';
import { validateAssignmentMaterial } from '@/services/assignments/validation';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import type { AssignmentResponseType } from '@/types';
import { readFileAsDataUrl } from '@/utils/files';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  AssignmentFilePicker,
  type PendingAssignmentFile,
} from '@/components/assignments/AssignmentFilePicker';
import { formatLessonDate } from '@/utils/dates';
import { formatUserName } from '@/utils';

const RESPONSE_TYPE_OPTIONS: { value: AssignmentResponseType; label: string }[] = [
  { value: 'text', label: 'Текст' },
  { value: 'audio', label: 'Аудио' },
  { value: 'video', label: 'Видео' },
  { value: 'image', label: 'Изображение' },
  { value: 'file', label: 'Файл' },
];

const schema = z.object({
  title: z.string().trim().min(1, 'Введите название'),
  description: z.string().trim().min(1, 'Введите описание'),
  studentId: z.string().min(1, 'Выберите ученика'),
  dueDate: z.string().min(1, 'Укажите срок'),
  responseType: z.enum(['text', 'audio', 'video', 'image', 'file']),
  lessonId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CreateAssignmentPage() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [submitError, setSubmitError] = useState('');
  const [materials, setMaterials] = useState<PendingAssignmentFile[]>([]);
  const [materialError, setMaterialError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      responseType: 'text',
      lessonId: '',
    },
  });

  const selectedStudentId = watch('studentId');

  const { data: lessons, isLoading: lessonsLoading, error: lessonsError, refetch } = useQuery({
    queryKey: ['lessons', user.id, 'create-assignment'],
    queryFn: () => api.lessons.getLessons({ teacherId: user.id, requesterId: user.id }),
    enabled: canCreateAssignment(user),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
    enabled: canCreateAssignment(user),
  });

  const students = useMemo(() => {
    if (!lessons || !users) return [];
    const studentIds = [...new Set(lessons.map((l) => l.studentId))];
    return studentIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .sort((a, b) => formatUserName(a).localeCompare(formatUserName(b), 'ru'));
  }, [lessons, users]);

  const studentLessons = useMemo(() => {
    if (!lessons || !selectedStudentId) return [];
    return lessons
      .filter((l) => l.studentId === selectedStudentId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
  }, [lessons, selectedStudentId]);

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      api.assignments.createAssignment(
        {
          title: data.title,
          description: data.description,
          studentId: data.studentId,
          dueDate: data.dueDate,
          responseType: data.responseType,
          lessonId: data.lessonId || undefined,
          materials: materials
            .filter((m) => !m.uploading && !m.error)
            .map(({ filename, mimeType, url }) => ({ filename, mimeType, url })),
        },
        user.id,
      ),
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      navigate(`/assignments/${assignment.id}`);
    },
    onError: (e) => {
      setSubmitError(e instanceof ApiError ? e.message : 'Не удалось создать задание');
    },
  });

  const handleMaterialFiles = async (files: FileList | File[]) => {
    if (!isOnline) return;
    setMaterialError('');

    for (const file of Array.from(files)) {
      if (materials.length >= MAX_MATERIALS_PER_ASSIGNMENT) {
        setMaterialError(`Максимум ${MAX_MATERIALS_PER_ASSIGNMENT} файлов`);
        break;
      }

      const validation = validateAssignmentMaterial({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      if (!validation.valid) {
        setMaterialError(validation.message);
        continue;
      }

      const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setMaterials((prev) => [
        ...prev,
        { id, filename: file.name, mimeType: file.type, url: '', uploading: true },
      ]);

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await api.assignments.uploadAssignmentFile(
          { filename: file.name, mimeType: file.type, size: file.size, dataUrl },
          user.id,
          'material',
        );
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, url: uploaded.url, uploading: false } : m,
          ),
        );
      } catch (e) {
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  uploading: false,
                  error: e instanceof ApiError ? e.message : 'Ошибка загрузки',
                }
              : m,
          ),
        );
      }
    }
  };

  const hasUploadingMaterials = materials.some((m) => m.uploading);

  if (!canCreateAssignment(user)) {
    return <Navigate to="/assignments" replace />;
  }

  if (lessonsError) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const isLoading = lessonsLoading || usersLoading;
  const minDueDate = format(new Date(), 'yyyy-MM-dd');

  const onSubmit = (data: FormData) => {
    if (!isOnline) return;
    setSubmitError('');
    createMutation.mutate(data);
  };

  return (
    <div className="page-container max-w-lg">
      <BackLink label="К заданиям" fallbackTo="/assignments" />

      <h1 className="text-h1 mb-6">Новое задание</h1>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!isOnline && (
              <p className="text-body-sm text-warning" role="alert">
                {OFFLINE_NETWORK_MESSAGE}
              </p>
            )}

            <Input
              label="Название"
              error={errors.title?.message}
              {...register('title')}
              disabled={!isOnline}
            />

            <div className="space-y-1.5">
              <label htmlFor="description" className="text-label block">
                Описание
              </label>
              <textarea
                id="description"
                rows={4}
                className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body text-text-primary placeholder:text-text-muted transition-colors focus-ring hover:border-border/80 focus:border-brand"
                aria-invalid={!!errors.description}
                disabled={!isOnline}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-caption text-danger" role="alert">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="studentId" className="text-label block">
                Ученик
              </label>
              <select
                id="studentId"
                className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body text-text-primary focus-ring hover:border-border/80 focus:border-brand"
                aria-invalid={!!errors.studentId}
                disabled={!isOnline || students.length === 0}
                {...register('studentId')}
              >
                <option value="">Выберите ученика</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {formatUserName(student)}
                  </option>
                ))}
              </select>
              {errors.studentId && (
                <p className="text-caption text-danger" role="alert">
                  {errors.studentId.message}
                </p>
              )}
              {!isLoading && students.length === 0 && (
                <p className="text-caption text-text-muted">
                  Нет учеников с занятиями. Сначала проведите занятие.
                </p>
              )}
            </div>

            <Input
              label="Срок выполнения"
              type="date"
              min={minDueDate}
              error={errors.dueDate?.message}
              {...register('dueDate')}
              disabled={!isOnline}
            />

            <div className="space-y-1.5">
              <label htmlFor="responseType" className="text-label block">
                Тип ответа
              </label>
              <select
                id="responseType"
                className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body text-text-primary focus-ring hover:border-border/80 focus:border-brand"
                disabled={!isOnline}
                {...register('responseType')}
              >
                {RESPONSE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedStudentId && studentLessons.length > 0 && (
              <div className="space-y-1.5">
                <label htmlFor="lessonId" className="text-label block">
                  Связанное занятие
                  <span className="ml-1 font-normal text-text-muted">(необязательно)</span>
                </label>
                <select
                  id="lessonId"
                  className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-body text-text-primary focus-ring hover:border-border/80 focus:border-brand"
                  disabled={!isOnline}
                  {...register('lessonId')}
                >
                  <option value="">Без привязки</option>
                  {studentLessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {formatLessonDate(lesson.date)}, {lesson.startTime}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <AssignmentFilePicker
              label="Материалы"
              hint="PDF, документы, изображения, аудио или видео (необязательно)"
              files={materials}
              onFilesSelected={handleMaterialFiles}
              onRemove={(id) => setMaterials((prev) => prev.filter((m) => m.id !== id))}
              disabled={!isOnline}
              error={materialError}
            />

            {submitError && (
              <p className="text-body-sm text-danger" role="alert">
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={createMutation.isPending}
              disabled={!isOnline || students.length === 0 || hasUploadingMaterials}
            >
              Создать задание
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
