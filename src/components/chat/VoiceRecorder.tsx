import { useEffect, useRef, useState } from 'react';
import { Lock, Mic, Trash2 } from 'lucide-react';
import { cn } from '@/utils';
import { IconButton } from '@/components/ui/IconButton';

interface VoiceRecorderProps {
  disabled?: boolean;
  onRecorded: (file: File) => void;
  onError?: (message: string) => void;
  /** When true, expands to full-width recording bar (replaces text field area). */
  onActiveChange?: (active: boolean) => void;
}

type Phase = 'idle' | 'holding' | 'locked';

const LOCK_THRESHOLD_Y = -56;
const CANCEL_THRESHOLD_X = -72;

export function VoiceRecorder({ disabled, onRecorded, onError, onActiveChange }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const phaseRef = useRef<Phase>('idle');
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const startXY = useRef({ x: 0, y: 0 });
  const lockedRef = useRef(false);
  const cancelRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
    onActiveChange?.(next !== 'idle');
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupStream = () => {
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
  };

  const finishRecording = (send: boolean) => {
    stopTimer();
    const recorder = mediaRef.current;
    const done = () => {
      cleanupStream();
      setPhaseBoth('idle');
      setElapsed(0);
    };
    if (!recorder) {
      done();
      return;
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];
      done();
      if (send && blob.size > 0) {
        const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
        onRecorded(new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' }));
      }
    };
    if (recorder.state !== 'inactive') recorder.stop();
    else done();
  };

  const startRecording = async (clientX: number, clientY: number, pointerId: number) => {
    if (disabled || phaseRef.current !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRef.current = recorder;
      recorder.start(200);
      startRef.current = Date.now();
      startXY.current = { x: clientX, y: clientY };
      pointerIdRef.current = pointerId;
      lockedRef.current = false;
      cancelRef.current = false;
      setPhaseBoth('holding');
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 250);
    } catch {
      onError?.('Нет доступа к микрофону');
    }
  };

  useEffect(
    () => () => {
      stopTimer();
      cleanupStream();
    },
    [],
  );

  const formatElapsed = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  if (phase === 'locked') {
    return (
      <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-xl bg-danger-muted px-3 text-danger">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
        <span className="tabular-nums text-body-sm font-medium">{formatElapsed}</span>
        <span className="flex-1 text-caption">Запись…</span>
        <IconButton
          label="Отменить запись"
          onClick={() => {
            cancelRef.current = true;
            finishRecording(false);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
        <IconButton label="Отправить голосовое" variant="tonal" onClick={() => finishRecording(true)}>
          <Mic className="h-4 w-4" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className={cn('relative shrink-0', phase === 'holding' && 'flex flex-1 items-center gap-2')}>
      {phase === 'holding' && (
        <>
          <Lock
            className="pointer-events-none absolute -top-9 left-1/2 h-5 w-5 -translate-x-1/2 text-text-muted"
            aria-hidden
          />
          <span className="tabular-nums text-body-sm font-medium text-danger">{formatElapsed}</span>
          <span className="flex-1 text-caption text-danger">‹ отмена · вверх замок</span>
        </>
      )}
      <button
        type="button"
        disabled={disabled && phase === 'idle'}
        aria-label="Голосовое сообщение"
        className={cn(
          'flex min-h-[44px] min-w-[44px] touch-none items-center justify-center rounded-xl focus-ring',
          phase === 'holding' ? 'bg-danger text-white' : 'text-text-secondary hover:bg-surface-hover',
          disabled && phase === 'idle' && 'opacity-50',
        )}
        onPointerDown={(e) => {
          if (phaseRef.current !== 'idle') return;
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          void startRecording(e.clientX, e.clientY, e.pointerId);
        }}
        onPointerMove={(e) => {
          if (phaseRef.current !== 'holding' || pointerIdRef.current !== e.pointerId) return;
          const dx = e.clientX - startXY.current.x;
          const dy = e.clientY - startXY.current.y;
          cancelRef.current = dx <= CANCEL_THRESHOLD_X;
          if (dy <= LOCK_THRESHOLD_Y) {
            lockedRef.current = true;
            setPhaseBoth('locked');
          }
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          pointerIdRef.current = null;
          if (lockedRef.current || phaseRef.current === 'locked') return;
          finishRecording(!cancelRef.current);
        }}
        onPointerCancel={() => {
          pointerIdRef.current = null;
          if (!lockedRef.current) finishRecording(false);
        }}
      >
        <Mic className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
