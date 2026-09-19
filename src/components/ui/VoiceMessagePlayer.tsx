import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/utils';
import {
  formatAudioDuration,
  seekRatioFromPointer,
} from '@/services/audio/helpers';
import {
  generateWaveformHeights,
  playedBarCount,
  VOICE_WAVEFORM_BAR_COUNT,
} from '@/services/audio/waveform';
import type { AudioPlayerHandle } from '@/components/ui/AudioPlayer';

export interface VoiceMessagePlayerProps {
  src: string;
  mimeType?: string;
  /** Stable id for deterministic waveform (attachment id). */
  seed: string;
  isOwn?: boolean;
  className?: string;
  playbackRate?: number;
  onPlayRequest?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  playerRef?: Ref<AudioPlayerHandle | null>;
}

function resolveAudioMimeType(src: string, mimeType?: string): string | undefined {
  if (mimeType?.startsWith('audio/')) return mimeType;
  const dataMatch = /^data:(audio\/[^;,]+)/i.exec(src);
  if (dataMatch) return dataMatch[1];
  if (/\.webm(?:$|\?)/i.test(src)) return 'audio/webm';
  if (/\.ogg(?:$|\?)/i.test(src)) return 'audio/ogg';
  if (/\.m4a(?:$|\?)/i.test(src) || /\.mp4(?:$|\?)/i.test(src)) return 'audio/mp4';
  if (/\.mp3(?:$|\?)/i.test(src)) return 'audio/mpeg';
  if (/\.wav(?:$|\?)/i.test(src)) return 'audio/wav';
  return undefined;
}

/**
 * VK-style voice note: round play · waveform scrubber · duration.
 * Soft colored bubble (not solid brand) so play / bars stay readable;
 * exclusive play via same AudioPlayerHandle as ChatVoicePlayback.
 */
export function VoiceMessagePlayer({
  src,
  mimeType,
  seed,
  isOwn = false,
  className,
  playbackRate,
  onPlayRequest,
  onPlayingChange,
  playerRef,
}: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const heights = useMemo(
    () => generateWaveformHeights(seed, VOICE_WAVEFORM_BAR_COUNT),
    [seed],
  );
  const type = resolveAudioMimeType(src, mimeType);
  const progress = duration > 0 ? currentTime / duration : 0;
  const played = playedBarCount(progress, heights.length);

  const displaySeconds =
    playing && duration > 0
      ? Math.max(0, duration - currentTime)
      : duration > 0
        ? duration
        : 0;

  useImperativeHandle(
    playerRef,
    () => ({
      pause: () => {
        audioRef.current?.pause();
      },
      play: async () => {
        const audio = audioRef.current;
        if (!audio) return;
        onPlayRequest?.();
        await audio.play();
      },
      getElement: () => audioRef.current,
    }),
    [onPlayRequest],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playbackRate == null || !Number.isFinite(playbackRate)) return;
    if (audio.playbackRate !== playbackRate) audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => {
      if (!scrubbingRef.current) setCurrentTime(audio.currentTime);
    };
    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => {
      setPlaying(true);
      onPlayingChange?.(true);
    };
    const onPause = () => {
      setPlaying(false);
      onPlayingChange?.(false);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      onPlayingChange?.(false);
    };

    audio.addEventListener('timeupdate', syncTime);
    audio.addEventListener('loadedmetadata', syncDuration);
    audio.addEventListener('durationchange', syncDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    syncDuration();

    return () => {
      audio.removeEventListener('timeupdate', syncTime);
      audio.removeEventListener('loadedmetadata', syncDuration);
      audio.removeEventListener('durationchange', syncDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src, onPlayingChange]);

  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const next = ratio * audio.duration;
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const onWavePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = waveRef.current;
    if (!el) return;
    event.preventDefault();
    scrubbingRef.current = true;
    el.setPointerCapture(event.pointerId);
    seekToRatio(seekRatioFromPointer(event.clientX, el.getBoundingClientRect()));
  };

  const onWavePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current || !waveRef.current) return;
    seekToRatio(seekRatioFromPointer(event.clientX, waveRef.current.getBoundingClientRect()));
  };

  const endScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    try {
      waveRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      onPlayRequest?.();
      try {
        await audio.play();
      } catch {
        /* autoplay / interrupted */
      }
    } else {
      audio.pause();
    }
  };

  return (
    <div
      className={cn(
        'flex max-w-[min(100%,20rem)] min-w-[12.5rem] select-none items-center gap-3 px-3 py-2 shadow-sm',
        /* Soft fill — never solid brand (play button / bars need contrast). */
        isOwn
          ? 'rounded-2xl rounded-br-md border border-brand/30 bg-brand-muted'
          : 'rounded-2xl rounded-bl-md border border-border-subtle bg-surface-elevated',
        className,
      )}
      data-testid="voice-message-player"
      data-own={isOwn ? '' : undefined}
    >
      <button
        type="button"
        onClick={() => {
          void togglePlay();
        }}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-ring',
          'bg-brand text-brand-contrast shadow-sm hover:bg-brand-hover active:scale-[0.97]',
          'motion-safe:transition-transform',
        )}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div
          ref={waveRef}
          role="slider"
          tabIndex={0}
          aria-label="Позиция в голосовом сообщении"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={formatAudioDuration(currentTime)}
          className="flex h-6 cursor-pointer touch-none items-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onPointerDown={onWavePointerDown}
          onPointerMove={onWavePointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onKeyDown={(event) => {
            const audio = audioRef.current;
            if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
            const step = Math.max(0.5, audio.duration * 0.05);
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              seekToRatio(Math.min(1, (audio.currentTime + step) / audio.duration));
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              seekToRatio(Math.max(0, (audio.currentTime - step) / audio.duration));
            } else if (event.key === 'Home') {
              event.preventDefault();
              seekToRatio(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              seekToRatio(1);
            }
          }}
        >
          {heights.map((height, index) => (
            <span
              key={index}
              className={cn(
                'w-0.5 shrink-0 rounded-full transition-colors duration-150',
                index < played
                  ? 'bg-brand'
                  : isOwn
                    ? 'bg-brand/35'
                    : 'bg-border-subtle',
              )}
              style={{ height: `${height}%` }}
              aria-hidden
            />
          ))}
        </div>
        <span
          className={cn(
            'text-[12.5px] leading-[14px] tabular-nums',
            isOwn ? 'text-brand/80' : 'text-text-secondary',
          )}
        >
          {formatAudioDuration(displaySeconds)}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        aria-hidden
      >
        {type ? <source src={src} type={type} /> : null}
      </audio>
    </div>
  );
}
