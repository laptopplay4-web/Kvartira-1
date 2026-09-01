import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, FileText, Mic, Paperclip, X } from 'lucide-react';
import { useCurrentUser } from '@/stores/authStore';
import { useOnlineStatus, OFFLINE_NETWORK_MESSAGE } from '@/hooks/useOnlineStatus';
import { api } from '@/services/api';
import { ApiError } from '@/services/api/types';
import { canSubmitAssignment, canReviewAssignment } from '@/services/assignments/access';
import { getAcceptForResponseType, validateAssignmentFeedbackAudio, validateAssignmentResponseFile } from '@/services/assignments/validation';
import { readFileAsDataUrl } from '@/utils/files';
import { Button } from '@/components/ui/Button';
import { AudioPlayer } from '@/components/ui/AudioPlayer';
import { Card } from '@/components/ui/Card';
import { AssignmentStatusBadge } from '@/components/ui/AssignmentStatusBadge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatFullDate } from '@/utils/dates';
import { formatUserName } from '@/utils';

const RESPONSE_TYPE_LABELS = {
  text: 'Текст',
  audio: 'Аудио',
  video: 'Видео',
  image: 'Изображение',
  file: 'Файл',
} as const;

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [submitText, setSubmitText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [feedbackAudio, setFeedbackAudio] = useState<{
    url: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [feedbackAudioUploading, setFeedbackAudioUploading] = useState(false);
  const [feedbackAudioError, setFeedbackAudioError] = useState('');
  const [attachment, setAttachment] = useState<{
    url: string;
    filename: string;
    mimeType: string;
  } | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedbackAudioInputRef = useRef<HTMLInputElement>(null);

  const { data: assignment, isLoading, error, refetch } = useQuery({
    queryKey: ['assignment', id, user.id],
    queryFn: () => api.assignments.getAssignment(id!, user.id),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.getAllUsers(),
    enabled: user.role !== 'student',
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.lessons.getTeachers(),
    enabled: user.role === 'student',
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.assignments.submitAssignment(
        id!,
        {
          text: submitText || undefined,
          attachmentUrl: attachment?.url,
          attachmentFilename: attachment?.filename,
          attachmentMimeType: attachment?.mimeType,
        },
        user.id,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      api.assignments.reviewAssignment(
        id!,
        {
          text: reviewText.trim() || undefined,
          rating: 4,
          audioUrl: feedbackAudio?.url,
          audioFilename: feedbackAudio?.filename,
          audioMimeType: feedbackAudio?.mimeType,
        },
        user.id,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="page-container">
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const teacher =
    user.role === 'student'
      ? teachers?.find((u) => u.id === assignment.teacherId)
      : users?.find((u) => u.id === assignment.teacherId);
  const student = users?.find((u) => u.id === assignment.studentId);
  const canSubmit = canSubmitAssignment(user, assignment);
  const canReview = canReviewAssignment(user, assignment);
  const needsFile = assignment.responseType !== 'text';
  const canSendSubmit =
    isOnline &&
    !attachmentUploading &&
    (assignment.responseType === 'text' ? submitText.trim().length > 0 : !!attachment);
  const canSendReview =
    isOnline &&
    !feedbackAudioUploading &&
    (reviewText.trim().length > 0 || !!feedbackAudio);

  const handleResponseFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !isOnline) return;
    setAttachmentError('');

    const validation = validateAssignmentResponseFile(
      { filename: file.name, mimeType: file.type, size: file.size },
      assignment.responseType,
    );
    if (!validation.valid) {
      setAttachmentError(validation.message);
      return;
    }

    setAttachmentUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await api.assignments.uploadAssignmentFile(
        { filename: file.name, mimeType: file.type, size: file.size, dataUrl },
        user.id,
        'submission',
        assignment.responseType,
      );
      setAttachment({
        url: uploaded.url,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
      });
    } catch (e) {
      setAttachmentError(e instanceof ApiError ? e.message : 'Не удалось загрузить файл');
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleFeedbackAudioFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !isOnline) return;
    setFeedbackAudioError('');

    const validation = validateAssignmentFeedbackAudio({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
    if (!validation.valid) {
      setFeedbackAudioError(validation.message);
      return;
    }

    setFeedbackAudioUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await api.assignments.uploadAssignmentFile(
        { filename: file.name, mimeType: file.type, size: file.size, dataUrl },
        user.id,
        'feedback',
      );
      setFeedbackAudio({
        url: uploaded.url,
        filename: uploaded.filename,
        mimeType: uploaded.mimeType,
      });
    } catch (e) {
      setFeedbackAudioError(e instanceof ApiError ? e.message : 'Не удалось загрузить аудио');
    } finally {
      setFeedbackAudioUploading(false);
    }
  };

  return (
    <div className="page-container max-w-lg">
      <button
        type="button"
        onClick={() => navigate('/assignments')}
        className="mb-4 flex min-h-11 items-center gap-1 rounded text-sm text-text-secondary hover:text-brand focus-ring"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        К заданиям
      </button>

      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-h1">{assignment.title}</h1>
        <AssignmentStatusBadge assignment={assignment} />
      </div>

      <Card className="mb-4">
        <p className="text-body-sm text-text-secondary">{assignment.description}</p>
        <dl className="mt-4 space-y-2 text-body-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Срок</dt>
            <dd>{formatFullDate(assignment.dueDate)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Тип ответа</dt>
            <dd>{RESPONSE_TYPE_LABELS[assignment.responseType]}</dd>
          </div>
          {user.role !== 'student' && student && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Ученик</dt>
              <dd>{formatUserName(student)}</dd>
            </div>
          )}
          {user.role === 'student' && teacher && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Преподаватель</dt>
              <dd>{formatUserName(teacher)}</dd>
            </div>
          )}
        </dl>
      </Card>

      {assignment.materials.length > 0 && (
        <section className="mb-4" aria-labelledby="materials-heading">
          <h2 id="materials-heading" className="mb-2 text-label uppercase tracking-wide">
            Материалы
          </h2>
          <ul className="space-y-2">
            {assignment.materials.map((material) => (
              <li key={material.id}>
                <a href={material.url} target="_blank" rel="noopener noreferrer">
                  <Card padding="sm" className="flex items-center gap-2 hover:border-brand/30">
                    <FileText className="h-4 w-4 text-brand" aria-hidden />
                    <span className="text-sm">{material.filename}</span>
                  </Card>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {assignment.submission && (
        <section className="mb-4" aria-labelledby="submission-heading">
          <h2 id="submission-heading" className="mb-2 text-label uppercase tracking-wide">
            Ответ ученика
          </h2>
          <Card>
            {assignment.submission.text && (
              <p className="text-body-sm whitespace-pre-wrap">{assignment.submission.text}</p>
            )}
            {assignment.submission.attachmentUrl && (
              <div className={assignment.submission.text ? 'mt-3' : ''}>
                {assignment.responseType === 'image' ? (
                  <img
                    src={assignment.submission.attachmentUrl}
                    alt={assignment.submission.attachmentFilename ?? 'Ответ'}
                    className="max-h-64 rounded-lg"
                  />
                ) : assignment.responseType === 'audio' ? (
                  <AudioPlayer
                    src={assignment.submission.attachmentUrl}
                    title={assignment.submission.attachmentFilename ?? 'Аудиоответ'}
                    downloadUrl={assignment.submission.attachmentUrl}
                    downloadFilename={assignment.submission.attachmentFilename}
                  />
                ) : assignment.responseType === 'video' ? (
                  <video controls src={assignment.submission.attachmentUrl} className="max-h-64 w-full rounded-lg">
                    <track kind="captions" />
                  </video>
                ) : (
                  <a
                    href={assignment.submission.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand hover:underline"
                  >
                    {assignment.submission.attachmentFilename ?? 'Скачать файл'}
                  </a>
                )}
              </div>
            )}
            <p className="mt-2 text-caption text-text-muted">
              Отправлено {formatFullDate(assignment.submission.submittedAt)}
            </p>
          </Card>
        </section>
      )}

      {assignment.feedback && (
        <section className="mb-4" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="mb-2 text-label uppercase tracking-wide">
            Обратная связь
          </h2>
          <Card className="border-success/20 bg-success-muted/30">
            {assignment.feedback.text && (
              <p className="text-body-sm whitespace-pre-wrap">{assignment.feedback.text}</p>
            )}
            {assignment.feedback.audioUrl && (
              <div className={assignment.feedback.text ? 'mt-3' : ''}>
                <AudioPlayer
                  src={assignment.feedback.audioUrl}
                  title={assignment.feedback.audioFilename ?? 'Аудиокомментарий'}
                  downloadUrl={assignment.feedback.audioUrl}
                  downloadFilename={assignment.feedback.audioFilename}
                />
              </div>
            )}
            {assignment.feedback.rating != null && (
              <p className="mt-2 text-caption text-text-muted">Оценка: {assignment.feedback.rating}/5</p>
            )}
          </Card>
        </section>
      )}

      {canSubmit && (
        <section className="mb-4" aria-labelledby="submit-heading">
          <h2 id="submit-heading" className="mb-2 text-label uppercase tracking-wide">
            Ваш ответ
          </h2>
          {!isOnline && (
            <p className="mb-2 text-body-sm text-warning" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          {(assignment.responseType === 'text' || assignment.responseType === 'file') && (
            <textarea
              value={submitText}
              onChange={(e) => setSubmitText(e.target.value)}
              rows={4}
              placeholder={
                assignment.responseType === 'text'
                  ? 'Опишите выполненную работу…'
                  : 'Комментарий к файлу (необязательно)…'
              }
              className="mb-3 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
              disabled={!isOnline}
            />
          )}
          {needsFile && (
            <div className="mb-3 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={getAcceptForResponseType(assignment.responseType)}
                className="sr-only"
                disabled={!isOnline || attachmentUploading}
                onChange={(e) => void handleResponseFile(e.target.files)}
              />
              {!attachment ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!isOnline || attachmentUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                  {attachmentUploading ? 'Загрузка…' : 'Выбрать файл'}
                </Button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{attachment.filename}</span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="min-h-11 min-w-11 rounded p-2 text-text-muted hover:text-danger focus-ring"
                    aria-label="Удалить файл"
                    disabled={!isOnline}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              {attachmentError && (
                <p className="text-caption text-danger" role="alert">
                  {attachmentError}
                </p>
              )}
            </div>
          )}
          <Button
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={!canSendSubmit}
          >
            Отправить
          </Button>
        </section>
      )}

      {canReview && (
        <section aria-labelledby="review-heading">
          <h2 id="review-heading" className="mb-2 text-label uppercase tracking-wide">
            Проверка
          </h2>
          {!isOnline && (
            <p className="mb-2 text-body-sm text-warning" role="alert">
              {OFFLINE_NETWORK_MESSAGE}
            </p>
          )}
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            placeholder="Комментарий для ученика…"
            className="mb-3 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-body-sm focus-ring"
            disabled={!isOnline}
          />
          <div className="mb-3 space-y-2">
            <input
              ref={feedbackAudioInputRef}
              type="file"
              accept="audio/*"
              className="sr-only"
              disabled={!isOnline || feedbackAudioUploading}
              onChange={(e) => void handleFeedbackAudioFile(e.target.files)}
            />
            {!feedbackAudio ? (
              <Button
                type="button"
                variant="secondary"
                disabled={!isOnline || feedbackAudioUploading}
                onClick={() => feedbackAudioInputRef.current?.click()}
              >
                <Mic className="h-4 w-4" aria-hidden />
                {feedbackAudioUploading ? 'Загрузка…' : 'Аудиокомментарий'}
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border border-border-subtle px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{feedbackAudio.filename}</span>
                  <button
                    type="button"
                    onClick={() => setFeedbackAudio(null)}
                    className="min-h-11 min-w-11 rounded p-2 text-text-muted hover:text-danger focus-ring"
                    aria-label="Удалить аудио"
                    disabled={!isOnline}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <AudioPlayer
                  src={feedbackAudio.url}
                  title={feedbackAudio.filename}
                  downloadUrl={feedbackAudio.url}
                  downloadFilename={feedbackAudio.filename}
                />
              </div>
            )}
            {feedbackAudioError && (
              <p className="text-caption text-danger" role="alert">
                {feedbackAudioError}
              </p>
            )}
          </div>
          <Button
            onClick={() => reviewMutation.mutate()}
            loading={reviewMutation.isPending}
            disabled={!canSendReview}
          >
            Отправить отзыв
          </Button>
        </section>
      )}
    </div>
  );
}
