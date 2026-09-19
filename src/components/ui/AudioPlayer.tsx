import '@videojs/react/audio/skin.css';
import '@videojs/react/i18n/locales/ru/register';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type Ref,
} from 'react';
import { Download } from 'lucide-react';
import { I18nProvider } from '@videojs/react/i18n';
import {
  Audio as VideoJsAudio,
  AudioPlayer as VideoJsAudioPlayer,
  AudioSkin,
} from '@videojs/react/audio';
import { cn } from '@/utils';
import { downloadFromUrl } from '@/utils/files';

/** Brand-aligned Video.js audio skin tokens (same as VideoPlayer). */
const SKIN_THEME = {
  '--media-accent-color': 'var(--color-brand, #00796b)',
  '--media-accent-text-color': 'var(--color-brand-contrast, #ffffff)',
  '--media-border-radius': 'var(--radius-md, 0.75rem)',
  '--media-font-family': "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
  '--media-scale-unit': '1rem',
  colorScheme: 'light',
} as CSSProperties;

export interface AudioPlayerHandle {
  pause: () => void;
  play: () => Promise<void>;
  getElement: () => HTMLAudioElement | null;
}

export interface AudioPlayerProps {
  src: string;
  /** MIME type when known (mpeg / webm / ogg / mp4). */
  mimeType?: string;
  title?: string;
  downloadUrl?: string;
  downloadFilename?: string;
  variant?: 'compact' | 'default';
  isOwn?: boolean;
  className?: string;
  /** No card fill/border — media sits on parent (chat bubble / page). */
  bare?: boolean;
  /** Default true — hide in chat */
  showVolume?: boolean;
  /** Default true — hide for chat voice (top bar) and chat MP3 */
  showSpeed?: boolean;
  /** Controlled playback rate (e.g. chat voice top bar) */
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  /** Called when user starts playback (before/on play) — exclusive voice claim */
  onPlayRequest?: () => void;
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
 * Video.js `timeFeature` ignores `timeupdate` while store `seeking` is true.
 * Some browsers latch `seeking` without a matching `seeked` after play/buffer —
 * dispatching `seeked` re-syncs the store so elapsed time and the scrubber move.
 */
function resyncVideoJsTimeStore(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.dispatchEvent(new Event('seeked'));
}

/**
 * App-wide progressive audio player — Video.js v10 React audio preset
 * (`@videojs/react/audio` + default skin: elapsed | slider | remaining),
 * themed to brand tokens. Keeps chat/ДЗ flags: volume/speed/seek hide,
 * exclusive play handle, download.
 */
export function AudioPlayer({
  src,
  mimeType,
  title,
  downloadUrl,
  downloadFilename,
  variant = 'default',
  isOwn,
  className,
  bare = false,
  showVolume = true,
  showSpeed = true,
  playbackRate,
  onPlaybackRateChange,
  onPlayingChange,
  onPlayRequest,
  playerRef,
}: AudioPlayerProps) {
  return (
    <I18nProvider locale="ru">
      <VideoJsAudioPlayer key={src} title={title}>
        <AudioPlayerChrome
          src={src}
          mimeType={mimeType}
          title={title}
          downloadUrl={downloadUrl}
          downloadFilename={downloadFilename}
          variant={variant}
          isOwn={isOwn}
          className={className}
          bare={bare}
          showVolume={showVolume}
          showSpeed={showSpeed}
          playbackRate={playbackRate}
          onPlaybackRateChange={onPlaybackRateChange}
          onPlayingChange={onPlayingChange}
          onPlayRequest={onPlayRequest}
          playerRef={playerRef}
        />
      </VideoJsAudioPlayer>
    </I18nProvider>
  );
}

function AudioPlayerChrome({
  src,
  mimeType,
  title,
  downloadUrl,
  downloadFilename,
  variant = 'default',
  isOwn,
  className,
  bare = false,
  showVolume = true,
  showSpeed = true,
  playbackRate,
  onPlaybackRateChange,
  onPlayingChange,
  onPlayRequest,
  playerRef,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const type = resolveAudioMimeType(src, mimeType);
  const isCompact = variant === 'compact';
  const showDownload = Boolean(downloadUrl);
  const hideSeek = isCompact;

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
        resyncVideoJsTimeStore(audio);
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

    const onPlaying = () => resyncVideoJsTimeStore(audio);
    const onLoadedMetadata = () => resyncVideoJsTimeStore(audio);

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [src]);

  return (
    <div
      className={cn(
        'kv-audio-player transition-colors',
        bare
          ? 'bg-transparent'
          : cn(
              'rounded-xl border backdrop-blur-sm',
              isCompact ? 'px-2 py-1.5' : 'px-2.5 py-2',
              isOwn
                ? 'border-brand/30 bg-brand/10'
                : 'border-border-subtle bg-surface-elevated/80',
            ),
        className,
      )}
      data-testid="audio-player"
    >
      {title ? (
        <p
          className={cn(
            'mb-1.5 truncate px-0.5 font-medium',
            isCompact ? 'text-caption' : 'text-body-sm',
          )}
        >
          {title}
        </p>
      ) : null}

      <div className="relative min-w-0">
        <AudioSkin
          className="kv-audio-skin w-full"
          style={SKIN_THEME}
          data-hide-volume={showVolume ? undefined : ''}
          data-hide-speed={showSpeed ? undefined : ''}
          data-hide-seek={hideSeek ? '' : undefined}
          data-elapsed-only=""
        >
          <VideoJsAudio
            ref={audioRef}
            src={src}
            preload="metadata"
            aria-label={title || 'Аудио'}
            onPlay={() => {
              onPlayRequest?.();
              onPlayingChange?.(true);
              resyncVideoJsTimeStore(audioRef.current);
            }}
            onPause={() => onPlayingChange?.(false)}
            onEnded={() => onPlayingChange?.(false)}
            onRateChange={() => {
              const rate = audioRef.current?.playbackRate;
              if (rate != null && Number.isFinite(rate)) onPlaybackRateChange?.(rate);
            }}
          >
            {type ? <source src={src} type={type} /> : null}
          </VideoJsAudio>
        </AudioSkin>

        {showDownload && downloadUrl ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void downloadFromUrl(downloadUrl, downloadFilename || 'audio.mp3').catch(() => {
                /* keep in-app */
              });
            }}
            className="absolute right-1 top-1 z-10 flex min-h-9 min-w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-brand focus-ring"
            aria-label="Скачать аудио"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
