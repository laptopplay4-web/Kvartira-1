import type { AvatarCropState } from '@/services/profile/avatar';
import { zoomCropAtPoint } from '@/services/profile/avatar';

export type EventImageCropState = AvatarCropState;

/** Соотношение миниатюры на карточке / Home / деталке. */
export const EVENT_IMAGE_ASPECT = 16 / 9;
export const EVENT_IMAGE_MAX_ZOOM = 3;
export const EVENT_IMAGE_JPEG_QUALITY = 0.85;
/** Ширина области кропа на экране (высота = width / 16*9). */
export const EVENT_IMAGE_CROP_MAX_WIDTH = 360;
export const EVENT_IMAGE_OUTPUT_WIDTH = 1280;
export const EVENT_IMAGE_OUTPUT_HEIGHT = Math.round(
  EVENT_IMAGE_OUTPUT_WIDTH / EVENT_IMAGE_ASPECT,
);

export const EVENT_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const EVENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export function getEventCropViewportSize(maxWidth = EVENT_IMAGE_CROP_MAX_WIDTH): {
  width: number;
  height: number;
} {
  if (typeof window === 'undefined') {
    return { width: maxWidth, height: Math.round(maxWidth / EVENT_IMAGE_ASPECT) };
  }
  const chrome = 220;
  const width = Math.min(window.innerWidth - 32, maxWidth, window.innerHeight - chrome);
  return {
    width: Math.max(200, Math.floor(width)),
    height: Math.max(112, Math.round(Math.floor(width) / EVENT_IMAGE_ASPECT)),
  };
}

export function getRectCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  return Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
}

export function getEventCropZoomBounds(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { minScale: number; maxScale: number } {
  const minScale = getRectCoverScale(
    naturalWidth,
    naturalHeight,
    viewportWidth,
    viewportHeight,
  );
  return { minScale, maxScale: minScale * EVENT_IMAGE_MAX_ZOOM };
}

export function getInitialEventCropState(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): EventImageCropState {
  const scale = getRectCoverScale(naturalWidth, naturalHeight, viewportWidth, viewportHeight);
  const scaledW = naturalWidth * scale;
  const scaledH = naturalHeight * scale;
  return {
    scale,
    offsetX: (viewportWidth - scaledW) / 2,
    offsetY: (viewportHeight - scaledH) / 2,
  };
}

export function clampEventCropState(
  state: EventImageCropState,
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): EventImageCropState {
  const { minScale, maxScale } = getEventCropZoomBounds(
    naturalWidth,
    naturalHeight,
    viewportWidth,
    viewportHeight,
  );
  const scale = Math.min(maxScale, Math.max(minScale, state.scale));
  const scaledW = naturalWidth * scale;
  const scaledH = naturalHeight * scale;
  const minOffsetX = Math.min(0, viewportWidth - scaledW);
  const minOffsetY = Math.min(0, viewportHeight - scaledH);

  return {
    scale,
    offsetX: Math.min(0, Math.max(minOffsetX, state.offsetX)),
    offsetY: Math.min(0, Math.max(minOffsetY, state.offsetY)),
  };
}

export function zoomEventCropAtPoint(
  state: EventImageCropState,
  nextScale: number,
  focalX: number,
  focalY: number,
): EventImageCropState {
  return zoomCropAtPoint(state, nextScale, focalX, focalY);
}

export function cropEventImageToDataUrl(
  image: HTMLImageElement,
  state: EventImageCropState,
  viewportWidth: number,
  viewportHeight: number,
  outputWidth = EVENT_IMAGE_OUTPUT_WIDTH,
  outputHeight = EVENT_IMAGE_OUTPUT_HEIGHT,
  quality = EVENT_IMAGE_JPEG_QUALITY,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');

  const srcX = -state.offsetX / state.scale;
  const srcY = -state.offsetY / state.scale;
  const srcW = viewportWidth / state.scale;
  const srcH = viewportHeight / state.scale;

  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

export function validateEventImageFile(
  file: Pick<File, 'type' | 'size' | 'name'>,
): { valid: true } | { valid: false; message: string } {
  const mime = file.type || guessMimeFromName(file.name);
  if (!(EVENT_IMAGE_MIME as readonly string[]).includes(mime)) {
    return { valid: false, message: 'Допустимы JPEG, PNG, WebP или GIF' };
  }
  if (file.size > EVENT_IMAGE_MAX_BYTES) {
    return { valid: false, message: 'Файл не больше 8 МБ' };
  }
  return { valid: true };
}

function guessMimeFromName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return '';
}
