import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Download, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/utils';
import {
  formatAudioDuration,
  formatPlaybackSpeedLabel,
  getNextPlaybackSpeed,
  seekRatioFromPointer,
} from '@/services/audio/helpers';

export interface AudioPlayerProps {
  src: string;
  title?: string;
  downloadUrl?: string;
  downloadFilename?: string;
  variant?: 'compact' | 'default';
  isOwn?: boolean;
  className?: string;
}

export function AudioPlayer({
  src,
  title,
  downloadUrl,
  downloadFilename,
  variant = 'default',
  isOwn,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [seeking, setSeeking] = useState(false);

  const effectiveVolume = muted ? 0 : volume;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    audio.volume = effectiveVolume;
  }, [speed, effectiveVolume]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [playing]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration)) return;
      const nextTime = ratio * audio.duration;
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [],
  );

  const handleProgressPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const track = progressRef.current;
      if (!track) return;
      seekToRatio(seekRatioFromPointer(event.clientX, track.getBoundingClientRect()));
    },
    [seekToRatio],
  );

  const handleProgressKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration)) return;
      const step = event.shiftKey ? 10 : 5;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + step);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - step);
      }
    },
    [],
  );

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = formatAudioDuration(currentTime);
  const displayDuration = formatAudioDuration(duration);
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'rounded-xl border backdrop-blur-sm transition-colors',
        isCompact ? 'px-2.5 py-2' : 'px-3 py-3',
        isOwn
          ? 'border-brand/30 bg-brand/10'
          : 'border-border-subtle bg-surface-elevated/80',
        className,
      )}
      data-testid="audio-player"
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast shadow-sm transition-transform focus-ring active:scale-95',
            isCompact ? 'h-10 w-10' : 'h-11 w-11',
          )}
          aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        >
          {playing ? (
            <Pause className={cn(isCompact ? 'h-4 w-4' : 'h-5 w-5')} aria-hidden />
          ) : (
            <Play className={cn(isCompact ? 'h-4 w-4' : 'h-5 w-5', 'ml-0.5')} aria-hidden />
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          {title && (
            <p className={cn('truncate font-medium', isCompact ? 'text-caption' : 'text-body-sm')}>
              {title}
            </p>
          )}

          <div
            ref={progressRef}
            role="slider"
            tabIndex={0}
            aria-label="Прогресс воспроизведения"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${displayTime} из ${displayDuration}`}
            className={cn(
              'group relative cursor-pointer rounded-pill focus-ring',
              isCompact ? 'h-1.5' : 'h-2',
            )}
            onPointerDown={(event) => {
              setSeeking(true);
              event.currentTarget.setPointerCapture(event.pointerId);
              handleProgressPointer(event);
            }}
            onPointerMove={(event) => {
              if (seeking) handleProgressPointer(event);
            }}
            onPointerUp={(event) => {
              setSeeking(false);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => setSeeking(false)}
            onKeyDown={handleProgressKeyDown}
          >
            <div className="absolute inset-0 rounded-pill bg-border-subtle/80" />
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-gradient-to-r from-brand to-brand-hover transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-opacity',
                isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5',
                seeking || progressPercent > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
              style={{ left: `calc(${progressPercent}% - ${isCompact ? 6 : 7}px)` }}
              aria-hidden
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-caption tabular-nums text-text-muted">
            <span>{displayTime}</span>
            <span>{displayDuration}</span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'mt-2 flex flex-wrap items-center gap-2',
          isCompact ? 'pl-[2.875rem]' : 'pl-[3.375rem]',
        )}
      >
        <button
          type="button"
          onClick={() => setSpeed(getNextPlaybackSpeed(speed))}
          className="min-h-9 rounded-pill border border-border-subtle bg-surface px-2.5 text-caption font-medium text-text-secondary transition-colors hover:border-brand/40 hover:text-text-primary focus-ring"
          aria-label={`Скорость воспроизведения ${formatPlaybackSpeedLabel(speed)}`}
        >
          {formatPlaybackSpeedLabel(speed)}
        </button>

        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setShowVolume((value) => !value)}
            className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-ring"
            aria-label={muted || volume === 0 ? 'Включить звук' : 'Громкость'}
            aria-expanded={showVolume}
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-4 w-4" aria-hidden />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden />
            )}
          </button>
          {showVolume && (
            <div className="ml-1 flex items-center gap-2 rounded-pill border border-border-subtle bg-surface px-2 py-1">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={effectiveVolume}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVolume(next);
                  setMuted(next === 0);
                }}
                className="h-1.5 w-20 cursor-pointer accent-brand"
                aria-label="Уровень громкости"
              />
              <button
                type="button"
                onClick={() => setMuted((value) => !value)}
                className="text-caption text-text-muted hover:text-text-primary focus-ring"
              >
                {muted ? 'Вкл.' : 'Выкл.'}
              </button>
            </div>
          )}
        </div>

        {downloadUrl && (
          <a
            href={downloadUrl}
            download={downloadFilename}
            className="ml-auto flex min-h-9 min-w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-brand focus-ring"
            aria-label="Скачать аудио"
          >
            <Download className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (audio && Number.isFinite(audio.duration)) setDuration(audio.duration);
        }}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (audio) setCurrentTime(audio.currentTime);
        }}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="sr-only"
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}
