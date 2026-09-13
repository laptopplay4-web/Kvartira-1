export const MAX_CONTENT_BLOCKS_PER_ASSIGNMENT = 20;

export const ASSIGNMENT_CONTENT_LABELS = {
  voice: 'MP3',
  text: 'Текст',
  image: 'Фото',
  pdf: 'PDF',
  video: 'Видео',
} as const;

export const ASSIGNMENT_CONTENT_ACCEPT: Record<
  keyof typeof ASSIGNMENT_CONTENT_LABELS,
  string | undefined
> = {
  voice: 'audio/mpeg,audio/mp3,.mp3',
  text: undefined,
  image: 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif',
  pdf: 'application/pdf,.pdf',
  video: 'video/*',
};
