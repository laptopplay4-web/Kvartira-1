import {
  ALLOWED_AVATAR_MIMES,
  AVATAR_CROP_VIEWPORT,
  AVATAR_JPEG_QUALITY,
  AVATAR_MAX_ZOOM_MULTIPLIER,
  AVATAR_OUTPUT_SIZE,
  MAX_AVATAR_FILE_SIZE,
} from './constants';

export interface AvatarUploadInput {
  filename: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  originalDataUrl?: string;
  updateThumbnailOnly?: boolean;
}

export function getAvatarFullPhotoUrl(
  user: Pick<{ avatarUrl?: string; avatarOriginalUrl?: string }, 'avatarUrl' | 'avatarOriginalUrl'>,
): string | undefined {
  return user.avatarOriginalUrl ?? user.avatarUrl;
}

export function hasAvatarPhoto(
  user: Pick<{ avatarUrl?: string; avatarOriginalUrl?: string }, 'avatarUrl' | 'avatarOriginalUrl'>,
): boolean {
  return !!(user.avatarUrl || user.avatarOriginalUrl);
}

export interface AvatarCropState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface AvatarCropZoomBounds {
  minScale: number;
  maxScale: number;
}

export function getCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize = AVATAR_CROP_VIEWPORT,
): number {
  return Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
}

export function getCropZoomBounds(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize = AVATAR_CROP_VIEWPORT,
): AvatarCropZoomBounds {
  const minScale = getCoverScale(naturalWidth, naturalHeight, viewportSize);
  return {
    minScale,
    maxScale: minScale * AVATAR_MAX_ZOOM_MULTIPLIER,
  };
}

export function zoomCropAtPoint(
  state: AvatarCropState,
  nextScale: number,
  focalX: number,
  focalY: number,
): AvatarCropState {
  const ratio = nextScale / state.scale;
  return {
    scale: nextScale,
    offsetX: focalX - (focalX - state.offsetX) * ratio,
    offsetY: focalY - (focalY - state.offsetY) * ratio,
  };
}

export function validateAvatarUpload(
  input: Pick<AvatarUploadInput, 'filename' | 'mimeType' | 'size'>,
): { valid: true } | { valid: false; message: string } {
  if (!input.filename.trim()) {
    return { valid: false, message: 'Не удалось загрузить файл' };
  }

  if (!(ALLOWED_AVATAR_MIMES as readonly string[]).includes(input.mimeType)) {
    return { valid: false, message: 'Допустимы JPEG, PNG или WebP' };
  }

  if (input.size > MAX_AVATAR_FILE_SIZE) {
    return { valid: false, message: 'Файл слишком большой (макс. 5 МБ)' };
  }

  return { valid: true };
}

export function getInitialCropState(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize = AVATAR_CROP_VIEWPORT,
): AvatarCropState {
  const scale = getCoverScale(naturalWidth, naturalHeight, viewportSize);
  const scaledW = naturalWidth * scale;
  const scaledH = naturalHeight * scale;
  return {
    scale,
    offsetX: (viewportSize - scaledW) / 2,
    offsetY: (viewportSize - scaledH) / 2,
  };
}

export function clampCropState(
  state: AvatarCropState,
  naturalWidth: number,
  naturalHeight: number,
  viewportSize = AVATAR_CROP_VIEWPORT,
): AvatarCropState {
  const { minScale, maxScale } = getCropZoomBounds(naturalWidth, naturalHeight, viewportSize);
  const scale = Math.min(maxScale, Math.max(minScale, state.scale));
  const scaledW = naturalWidth * scale;
  const scaledH = naturalHeight * scale;

  const minOffsetX = Math.min(0, viewportSize - scaledW);
  const minOffsetY = Math.min(0, viewportSize - scaledH);

  return {
    scale,
    offsetX: Math.min(0, Math.max(minOffsetX, state.offsetX)),
    offsetY: Math.min(0, Math.max(minOffsetY, state.offsetY)),
  };
}

export function cropImageToDataUrl(
  image: HTMLImageElement,
  state: AvatarCropState,
  viewportSize = AVATAR_CROP_VIEWPORT,
  outputSize = AVATAR_OUTPUT_SIZE,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');

  const srcX = -state.offsetX / state.scale;
  const srcY = -state.offsetY / state.scale;
  const srcSize = viewportSize / state.scale;

  ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);
  return canvas.toDataURL('image/jpeg', AVATAR_JPEG_QUALITY);
}

export async function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = src;
  });
}

export function dataUrlToAvatarUploadInput(dataUrl: string): AvatarUploadInput {
  return {
    filename: 'avatar.jpg',
    mimeType: 'image/jpeg',
    size: Math.ceil((dataUrl.length * 3) / 4),
    dataUrl,
    updateThumbnailOnly: true,
  };
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    reader.readAsDataURL(file);
  });
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const dataUrl = await readFileAsDataUrl(file);

  return loadImageFromSrc(dataUrl);
}

export function fileToAvatarUploadInput(
  file: File,
  croppedDataUrl: string,
  originalDataUrl: string,
): AvatarUploadInput {
  return {
    filename: file.name,
    mimeType: 'image/jpeg',
    size: Math.ceil((croppedDataUrl.length * 3) / 4),
    dataUrl: croppedDataUrl,
    originalDataUrl,
  };
}
