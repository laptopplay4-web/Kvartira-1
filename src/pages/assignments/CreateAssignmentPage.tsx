import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { canCreateAssignment, canManageAssignment } from '@/services/assignments/access';
import { validateAssignmentContentFile } from '@/services/assignments/validation';
import {
  GENERAL_ASSIGNMENT_GROUP_ID,
  GENERAL_ASSIGNMENT_GROUP_LABEL,
  isGeneralAssignmentGroup,
  sortRecipientGroups,
} from '@/services/assignments/groups/helpers';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import type { Assignment, AssignmentContentType } from '@/types';
import { readFileAsDataUrl } from '@/utils/files';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  AssignmentContentEditor,
  type PendingContentBlock,
} from '@/components/assignments/AssignmentContentEditor';

const schema = z.object({
  title: z.string().trim().min(1, 'Введите название'),
  description: z.string().trim().min(1, 'Введите описание'),
  groupId: z.string().min(1, 'Выберите получателей'),
});

type FormData = z.infer<typeof schema>;

function uid() {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type AssignmentFormPageProps = {
  mode: 'create' | 'edit';
};

export function AssignmentFormPage({ mode }: AssignmentFormPageProps) {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: editId } = useParams<{ id: string }>();
  const isOnline = useOnlineStatus();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitError, setSubmitError] = useState('');
  const [blocks, setBlocks] = useState<PendingContentBlock[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  const canAccess =
    mode === 'create' ? canCreateAssignment(user) : canManageAssignment(user);

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      groupId: '',
    },
  });

  const { data: groups, isLoading: groupsLoading, error: groupsError, refetch } = useQuery({
    queryKey: ['assignment-groups', user.id],
    queryFn: () => api.assignmentGroups.getGroups(user.id),
    enabled: canAccess,
  });

  const {
    data: existing,
    isLoading: existingLoading,
    error: existingError,
    refetch: refetchExisting,
  } = useQuery({
    queryKey: ['assignment', editId, user.id],
    queryFn: () => api.assignments.getAssignment(editId!, user.id),
    enabled: mode === 'edit' && !!editId && canAccess,
  });

  const generalGroup = groups?.find((g) => isGeneralAssignmentGroup(g));
  const customGroups = groups ? sortRecipientGroups(groups) : [];
  /** Real PB id when present; otherwise sentinel resolved on publish. */
  const allStudentsGroupId = generalGroup?.id ?? GENERAL_ASSIGNMENT_GROUP_ID;

  useEffect(() => {
    if (mode !== 'create' || groupsLoading) return;
    setValue('groupId', allStudentsGroupId, { shouldValidate: true });
  }, [mode, groupsLoading, allStudentsGroupId, setValue]);

  useEffect(() => {
    if (mode !== 'edit' || !existing || prefilled) return;
    setValue('title', existing.title);
    setValue('description', existing.description);
    setValue('groupId', existing.groupId);
    setBlocks(
      [...existing.contentBlocks]
        .sort((a, b) => a.order - b.order)
        .map((b) => ({
          id: b.id,
          type: b.type,
          order: b.order,
          text: b.text,
          url: b.url,
          previewUrl:
            (b.type === 'image' || b.type === 'video') &&
            b.url &&
            !b.url.startsWith('pbfile:')
              ? b.url
              : undefined,
          filename: b.filename,
          mimeType: b.mimeType,
        })),
    );
    setPrefilled(true);
  }, [mode, existing, prefilled, setValue]);

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        title: data.title,
        description: data.description,
        groupId: data.groupId,
        contentBlocks: blocks.map((b, index) => ({
          type: b.type,
          order: index,
          text: b.text,
          url: b.url,
          filename: b.filename,
          mimeType: b.mimeType,
        })),
      };
      if (mode === 'edit' && editId) {
        return api.assignments.updateAssignment(editId, payload, user.id);
      }
      return api.assignments.createAssignment(payload, user.id);
    },
    onSuccess: (assignment) => {
      queryClient.setQueryData(['assignment', assignment.id], assignment);
      queryClient.setQueriesData<Assignment[]>(
        { queryKey: ['assignments'] },
        (prev) => {
          if (!prev) return prev;
          const idx = prev.findIndex((a) => a.id === assignment.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = assignment;
            return next;
          }
          return [assignment, ...prev];
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment', assignment.id] });
      navigate(`/assignments/${assignment.id}`);
    },
  });

  const uploadFileForBlock = async (
    blockId: string,
    file: File,
    type: AssignmentContentType,
  ) => {
    if (!isOnline) return;

    const mimeType =
      file.type ||
      (type === 'image'
        ? /\.png$/i.test(file.name)
          ? 'image/png'
          : /\.webp$/i.test(file.name)
            ? 'image/webp'
            : /\.gif$/i.test(file.name)
              ? 'image/gif'
              : 'image/jpeg'
        : file.type);

    const validation = validateAssignmentContentFile(
      { filename: file.name, mimeType, size: file.size },
      type,
    );
    if (!validation.valid) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, error: validation.message } : b)),
      );
      return;
    }

    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, uploading: true, error: undefined } : b)),
    );

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await api.assignments.uploadAssignmentFile(
        { filename: file.name, mimeType, size: file.size, dataUrl },
        user.id,
        type,
      );
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                url: uploaded.url,
                // pbfile: нельзя показать в <img>/<video> — оставляем data URL для превью
                previewUrl:
                  type === 'image' || type === 'video' ? dataUrl : undefined,
                filename: uploaded.filename,
                mimeType: uploaded.mimeType || mimeType,
                uploading: false,
              }
            : b,
        ),
      );
    } catch (e) {
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                uploading: false,
                error: e instanceof ApiError ? e.message : 'Не удалось загрузить файл',
              }
            : b,
        ),
      );
    }
  };

  const handleAddTextBlock = () => {
    setBlocks((prev) => [...prev, { id: uid(), type: 'text', order: prev.length }]);
  };

  const handleAddFileBlock = async (
    type: Exclude<AssignmentContentType, 'text'>,
    file: File,
  ) => {
    const blockId = uid();
    setBlocks((prev) => [
      ...prev,
      { id: blockId, type, order: prev.length, uploading: true },
    ]);
    await uploadFileForBlock(blockId, file, type);
  };

  const handleReplaceFile = async (blockId: string, file: File) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || block.type === 'text') return;
    await uploadFileForBlock(blockId, file, block.type);
  };

  if (!canAccess) {
    return <Navigate to="/assignments" replace />;
  }

  if (groupsError || (mode === 'edit' && existingError)) {
    return (
      <div className="page-container">
        <ErrorState
          onRetry={() => {
            void refetch();
            if (mode === 'edit') void refetchExisting();
          }}
        />
      </div>
    );
  }

  if (mode === 'edit' && (existingLoading || !prefilled)) {
    return (
      <div className="page-container max-w-lg">
        <Skeleton className="h-64" />
      </div>
    );
  }

  const blocksValid =
    blocks.length > 0 &&
    blocks.every((b) => {
      if (b.type === 'text') return !!b.text?.trim();
      return !!b.url && !b.uploading;
    });

  const goNext = async () => {
    const ok = await trigger(['title', 'description', 'groupId']);
    if (ok) setStep(2);
  };

  const onPublish = handleSubmit((data) => {
    setSubmitError('');
    if (!blocksValid) {
      setSubmitError('Добавьте и заполните хотя бы один блок материала');
      return;
    }
    saveMutation.mutate(data);
  });

  const fallbackTo =
    mode === 'edit' && editId ? `/assignments/${editId}` : '/assignments';
  const pageTitle = mode === 'edit' ? 'Редактирование задания' : 'Новое задание';
  const submitLabel = mode === 'edit' ? 'Сохранить' : 'Опубликовать';

  return (
    <div className="page-container max-w-lg">
      <BackLink
        label={mode === 'edit' ? 'К заданию' : 'К заданиям'}
        fallbackTo={fallbackTo}
      />
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-h1">{pageTitle}</h1>
        <p className="text-caption text-text-muted" aria-live="polite">
          Шаг {step} / 2
        </p>
      </div>

      <div
        className="mb-4 flex gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={2}
        aria-valuenow={step}
        aria-label="Прогресс создания задания"
      >
        <span
          className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-brand' : 'bg-surface-elevated'}`}
        />
        <span
          className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-brand' : 'bg-surface-elevated'}`}
        />
      </div>

      {!isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="alert">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      <form onSubmit={onPublish} className="space-y-4">
        {step === 1 && (
          <Card className="space-y-4">
            <Input label="Название" error={errors.title?.message} {...register('title')} />
            <div>
              <label htmlFor="description" className="mb-1 block text-label">
                Описание
              </label>
              <textarea
                id="description"
                rows={3}
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
                {...register('description')}
              />
              {errors.description && (
                <p className="mt-1 text-caption text-danger">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="groupId" className="mb-1 block text-label">
                Получатели
              </label>
              {groupsLoading ? (
                <Skeleton className="h-11" />
              ) : (
                <>
                  <select
                    id="groupId"
                    className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
                    {...register('groupId')}
                  >
                    <option value={allStudentsGroupId}>{GENERAL_ASSIGNMENT_GROUP_LABEL}</option>
                    {customGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.memberIds.length} уч.)
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-caption text-text-muted">
                    По умолчанию — все ученики. Можно выбрать созданную группу.
                  </p>
                </>
              )}
              {errors.groupId && (
                <p className="mt-1 text-caption text-danger">{errors.groupId.message}</p>
              )}
            </div>

            <Button type="button" fullWidth onClick={() => void goNext()} disabled={groupsLoading}>
              Далее
            </Button>
          </Card>
        )}

        {step === 2 && (
          <>
            <Card className="space-y-2">
              <p className="text-label uppercase tracking-wide text-text-muted">Сводка</p>
              <p className="text-body-sm font-medium">{getValues('title') || '—'}</p>
              <p className="text-caption text-text-secondary line-clamp-2">
                {getValues('description') || '—'}
              </p>
            </Card>

            <Card>
              <h2 className="mb-3 text-label uppercase tracking-wide">Материалы</h2>
              <AssignmentContentEditor
                blocks={blocks}
                onAddTextBlock={handleAddTextBlock}
                onAddFileBlock={(type, file) => void handleAddFileBlock(type, file)}
                onRemoveBlock={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
                onTextChange={(id, text) =>
                  setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)))
                }
                onReplaceFile={(id, file) => void handleReplaceFile(id, file)}
                disabled={!isOnline || saveMutation.isPending}
              />
            </Card>

            {submitError && (
              <p className="text-caption text-danger" role="alert">
                {submitError}
              </p>
            )}
            {saveMutation.error instanceof ApiError && (
              <p className="text-caption text-danger" role="alert">
                {saveMutation.error.message}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={saveMutation.isPending}
              >
                Назад
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={saveMutation.isPending}
                disabled={!isOnline || !blocksValid}
              >
                {submitLabel}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default function CreateAssignmentPage() {
  return <AssignmentFormPage mode="create" />;
}
