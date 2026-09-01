export const MESSAGE_MAX_LENGTH = 4000;
export const MESSAGE_PAGE_SIZE = 50;
export const LAST_MESSAGE_PREVIEW_LENGTH = 60;

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export const TYPING_DEBOUNCE_MS = 300;
export const TYPING_TIMEOUT_MS = 5000;
export const TYPING_THROTTLE_MS = 2000;

export const DRAFT_STORAGE_PREFIX = 'chatDraft:';

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;
export const ALLOWED_AUDIO_MIMES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'] as const;
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

export const MESSAGE_SEARCH_MIN_LENGTH = 2;
export const MESSAGE_SEARCH_DEBOUNCE_MS = 300;
