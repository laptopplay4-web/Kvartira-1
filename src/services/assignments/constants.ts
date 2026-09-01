export const MAX_CONTENT_BLOCKS_PER_ASSIGNMENT = 20;

export const ASSIGNMENT_CONTENT_LABELS = {
  voice: 'MP3',
  text: 'Текст',
  pdf: 'PDF',
  video: 'Видео',
} as const;

export const ASSIGNMENT_CONTENT_ACCEPT: Record<
  keyof typeof ASSIGNMENT_CONTENT_LABELS,
  string | undefined
> = {
  voice: 'audio/mpeg,audio/mp3,.mp3',
  text: undefined,
  pdf: 'application/pdf,.pdf',
  video: 'video/*',
};
