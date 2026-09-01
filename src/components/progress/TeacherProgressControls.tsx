import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus } from 'lucide-react';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import type { ProgressGoal, SkillWithProgress } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SkillProgressBar } from '@/components/progress/SkillProgressBar';

interface CreateGoalModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  requesterId: string;
}

export function CreateGoalModal({ open, onClose, studentId, requesterId }: CreateGoalModalProps) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.progress.createGoal(
        {
          studentId,
          title,
          description: description || undefined,
          targetDate: targetDate || undefined,
        },
        requesterId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      setTitle('');
      setDescription('');
      setTargetDate('');
      setError('');
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать цель');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return;
    setError('');
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Новая цель">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isOnline && (
          <p className="text-body-sm text-warning" role="alert">
            {OFFLINE_NETWORK_MESSAGE}
          </p>
        )}
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div>
          <label className="mb-1.5 block text-label text-text-secondary">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring"
          />
        </div>
        <Input
          label="Срок (необязательно)"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        {error && (
          <p className="text-body-sm text-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={!isOnline || mutation.isPending}>
          {mutation.isPending ? 'Сохранение…' : 'Создать цель'}
        </Button>
      </form>
    </Modal>
  );
}

interface GoalManageActionsProps {
  goal: ProgressGoal;
  requesterId: string;
}

export function GoalManageActions({ goal, requesterId }: GoalManageActionsProps) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const completeMutation = useMutation({
    mutationFn: () => api.progress.updateGoal(goal.id, { status: 'completed' }, requesterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['progress'] }),
  });

  if (goal.status !== 'active') return null;

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11 shrink-0"
      disabled={!isOnline || completeMutation.isPending}
      onClick={() => completeMutation.mutate()}
    >
      <Check className="h-4 w-4" aria-hidden />
      Выполнено
    </Button>
  );
}

interface SkillManageRowProps {
  skill: SkillWithProgress;
  studentId: string;
  requesterId: string;
}

export function SkillManageRow({ skill, studentId, requesterId }: SkillManageRowProps) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(skill.level);
  const [note, setNote] = useState(skill.note ?? '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.progress.updateSkillProgress(
        { studentId, skillId: skill.id, level, note: note || undefined },
        requesterId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      setError('');
      setOpen(false);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    },
  });

  return (
    <>
      <div className="space-y-2">
        <SkillProgressBar
          name={skill.name}
          description={skill.description}
          level={skill.level}
          maxLevel={skill.maxLevel}
          note={skill.note}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => {
            setLevel(skill.level);
            setNote(skill.note ?? '');
            setError('');
            setOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Изменить уровень
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={skill.name}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isOnline) return;
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {!isOnline && (
            <p className="text-body-sm text-warning" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          <div>
            <label htmlFor={`skill-level-${skill.id}`} className="mb-2 block text-label text-text-secondary">
              Уровень: {level}%
            </label>
            <input
              id={`skill-level-${skill.id}`}
              type="range"
              min={0}
              max={skill.maxLevel}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-label text-text-secondary">Заметка</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-body focus-ring"
            />
          </div>
          {error && (
            <p className="text-body-sm text-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={!isOnline || mutation.isPending}>
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </form>
      </Modal>
    </>
  );
}

interface AddGoalButtonProps {
  onClick: () => void;
}

export function AddGoalButton({ onClick }: AddGoalButtonProps) {
  return (
    <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onClick}>
      <Plus className="h-4 w-4" aria-hidden />
      Добавить цель
    </Button>
  );
}
