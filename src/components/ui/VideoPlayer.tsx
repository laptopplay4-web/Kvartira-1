import '@videojs/react/video/skin.css';
import '@videojs/react/i18n/locales/ru/register';
import './VideoPlayer.css';

import { type CSSProperties } from 'react';
import { I18nProvider } from '@videojs/react/i18n';
import {
  Video as VideoJsMedia,
  VideoPlayer as VideoJsPlayer,
  VideoSkin,
} from '@videojs/react/video';
import { cn } from '@/utils';

/** Brand-aligned Video.js skin tokens (public CSS vars from packaged skin). */
const SKIN_THEME = {
  '--media-accent-color': 'var(--color-brand, #00796b)',
  '--media-accent-text-color': 'var(--color-brand-contrast, #ffffff)',
  '--media-border-radius': 'var(--radius-md, 0.75rem)',
  '--media-font-family': "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
  '--media-scale-unit': '1rem',
  '--media-object-fit': 'contain',
} as CSSProperties;

export interface VideoPlayerProps {
  src: string;
  /** MIME type when known (mp4 / webm / quicktime). */
  mimeType?: string;
  poster?: string;
  className?: string;
  'aria-label'?: string;
  preload?: 'none' | 'metadata' | 'auto';
}

function resolveMimeType(src: string, mimeType?: string): string | undefined {
  if (mimeType?.startsWith('video/')) return mimeType;
  const dataMatch = /^data:(video\/[^;,]+)/i.exec(src);
  if (dataMatch) return dataMatch[1];
  if (/\.webm(?:$|\?)/i.test(src)) return 'video/webm';
  if (/\.mov(?:$|\?)/i.test(src)) return 'video/quicktime';
  if (/\.mp4(?:$|\?)/i.test(src)) return 'video/mp4';
  return undefined;
}

/**
 * App-wide progressive video player — Video.js v10 React preset
 * (`@videojs/react/video` + default skin), themed to brand tokens.
 */
export function VideoPlayer({
  src,
  mimeType,
  poster,
  className,
  'aria-label': ariaLabel = 'Видео',
  preload = 'metadata',
}: VideoPlayerProps) {
  const type = resolveMimeType(src, mimeType);

  return (
    <I18nProvider locale="ru">
      <VideoJsPlayer key={src}>
        <VideoSkin
          className={cn(
            'kv-video-player aspect-video w-full overflow-hidden bg-black',
            className,
          )}
          style={SKIN_THEME}
        >
          <VideoJsMedia playsInline preload={preload} poster={poster} aria-label={ariaLabel}>
            {type ? <source src={src} type={type} /> : <source src={src} />}
          </VideoJsMedia>
        </VideoSkin>
      </VideoJsPlayer>
    </I18nProvider>
  );
}
