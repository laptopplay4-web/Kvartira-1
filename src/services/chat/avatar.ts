import {
  ALLOWED_CHAT_AVATAR_MIMES,
  CHAT_AVATAR_JPEG_QUALITY,
  CHAT_AVATAR_OUTPUT_SIZE,
  MAX_CHAT_AVATAR_FILE_SIZE,
} from '@/services/chat/constants';
import { loadImageFromSrc, readFileAsDataUrl } from '@/services/profile/avatar';

const EXT_TO_MIME: Record<string, (typeof ALLOWED_CHAT_AVATAR_MIMES)[number]> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Normalize aliases from mobile/desktop pickers (`image/jpg`, empty type, …). */
export function inferChatAvatarMimeType(filename: string, mimeType: string): string {
  const raw = (mimeType || '').trim().toLowerCase();
  const normalized =
    raw === 'image/jpg' || raw === 'image/pjpeg'
      ? 'image/jpeg'
      : raw === 'image/x-png'
        ? 'image/png'
        : raw;

  if (normalized && (ALLOWED_CHAT_AVATAR_MIMES as readonly string[]).includes(normalized)) {
    return normalized;
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];

  if (normalized.startsWith('image/')) return normalized;
  return normalized;
}

function isLikelyImageMime(mimeType: string): boolean {
  if (!mimeType) return true; // mobile often omits type — try decode
  if ((ALLOWED_CHAT_AVATAR_MIMES as readonly string[]).includes(mimeType)) return true;
  return mimeType.startsWith('image/') && !mimeType.includes('svg');
}

/** Center-cover crop → square JPEG suitable for chat list / PB storage. */
export async function prepareChatAvatarFromFile(file: File): Promise<string> {
  if (file.size > MAX_CHAT_AVATAR_FILE_SIZE) {
    throw new Error('Размер файла — не более 5 МБ');
  }

  const mimeType = inferChatAvatarMimeType(file.name, file.type);
  if (!isLikelyImageMime(mimeType)) {
    throw new Error('Допустимы JPEG, PNG, WebP или GIF');
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImageFromSrc(dataUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('empty');
    }

    const size = CHAT_AVATAR_OUTPUT_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен');

    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    ctx.drawImage(image, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
    return canvas.toDataURL('image/jpeg', CHAT_AVATAR_JPEG_QUALITY);
  } catch (error) {
    if (error instanceof Error && error.message === 'Canvas недоступен') throw error;
    throw new Error('Не удалось прочитать изображение. Выберите JPEG, PNG или WebP');
  }
}
