import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BackLink } from '@/components/ui/BackLink';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { canCreateAssignment } from '@/services/assignments/access';
import { validateAssignmentContentFile } from '@/services/assignments/validation';
import {
  GENERAL_ASSIGNMENT_GROUP_ID,
  GENERAL_ASSIGNMENT_GROUP_LABEL,
  sortRecipientGroups,
} from '@/services/assignments/groups/helpers';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import type { AssignmentContentType } from '@/types';
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

export default function CreateAssignmentPage() {
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [submitError, setSubmitError] = useState('');
  const [blocks, setBlocks] = useState<PendingContentBlock[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      groupId: GENERAL_ASSIGNMENT_GROUP_ID,
    },
  });

  const { data: groups, isLoading: groupsLoading, error: groupsError, refetch } = useQuery({
    queryKey: ['assignment-groups', user.id],
    queryFn: () => api.assignmentGroups.getGroups(user.id),
    enabled: canCreateAssignment(user),
  });

  const customGroups = groups ? sortRecipientGroups(groups) : [];

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return api.assignments.createAssignment(
        {
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
        },
        user.id,
      );
    },
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      navigate(`/assignments/${assignment.id}`);
    },
  });

  const handleAddBlock = (type: AssignmentContentType) => {
    setBlocks((prev) => [...prev, { id: uid(), type, order: prev.length }]);
  };

  const handleFileSelected = async (blockId: string, file: File) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !isOnline) return;

    const validation = validateAssignmentContentFile(
      { filename: file.name, mimeType: file.type, size: file.size },
      block.type,
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
        { filename: file.name, mimeType: file.type, size: file.size, dataUrl },
        user.id,
        block.type,
      );
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                url: uploaded.url,
                filename: uploaded.filename,
                mimeType: uploaded.mimeType,
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

  if (!canCreateAssignment(user)) {
    return <Navigate to="/assignments" replace />;
  }

  if (groupsError) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const blocksValid =
    blocks.length > 0 &&
    blocks.every((b) => {
      if (b.type === 'text') return !!b.text?.trim();
      return !!b.url && !b.uploading;
    });

  return (
    <div className="page-container max-w-lg">
      <BackLink label="К заданиям" fallbackTo="/assignments" />
      <h1 className="mb-6 text-h1">Новое задание</h1>

      {!isOnline && (
        <p className="mb-4 text-body-sm text-warning" role="alert">
          {OFFLINE_NETWORK_MESSAGE}
        </p>
      )}

      <form
        onSubmit={handleSubmit((data) => {
          setSubmitError('');
          if (!blocksValid) {
            setSubmitError('Добавьте и заполните хотя бы один блок материала');
            return;
          }
          createMutation.mutate(data);
        })}
        className="space-y-4"
      >
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
              <select
                id="groupId"
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
                {...register('groupId')}
              >
                <option value={GENERAL_ASSIGNMENT_GROUP_ID}>{GENERAL_ASSIGNMENT_GROUP_LABEL}</option>
                {customGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberIds.length} уч.)
                  </option>
                ))}
              </select>
            )}
            {errors.groupId && (
              <p className="mt-1 text-caption text-danger">{errors.groupId.message}</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-label uppercase tracking-wide">Материалы</h2>
          <AssignmentContentEditor
            blocks={blocks}
            onAddBlock={handleAddBlock}
            onRemoveBlock={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
            onTextChange={(id, text) =>
              setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)))
            }
            onFileSelected={(id, file) => void handleFileSelected(id, file)}
            disabled={!isOnline || createMutation.isPending}
          />
        </Card>

        {submitError && (
          <p className="text-caption text-danger" role="alert">
            {submitError}
          </p>
        )}
        {createMutation.error instanceof ApiError && (
          <p className="text-caption text-danger" role="alert">
            {createMutation.error.message}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          loading={createMutation.isPending}
          disabled={!isOnline || !blocksValid}
        >
          Опубликовать
        </Button>
      </form>
    </div>
  );
}
