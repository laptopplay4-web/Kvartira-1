export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_JPEG_QUALITY = 0.85;
export const AVATAR_CROP_VIEWPORT = 280;
/** Максимальный зум относительно масштаба «заполнить круг» */
export const AVATAR_MAX_ZOOM_MULTIPLIER = 3;

export const ALLOWED_AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Avoid rendering huge legacy data URLs or unresolved pbfile refs in <img>. */
export const MAX_DISPLAY_AVATAR_DATA_URL_LENGTH = 100_000;

export function isDisplayableAvatarSrc(src?: string): boolean {
  if (!src) return false;
  if (src.startsWith('pbfile:')) return false;
  if (src.startsWith('data:') && src.length > MAX_DISPLAY_AVATAR_DATA_URL_LENGTH) return false;
  return true;
}
