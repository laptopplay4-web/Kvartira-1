import type { SchoolSocialLinks } from '@/types';

export const EMPTY_SCHOOL_SOCIAL_LINKS: SchoolSocialLinks = {
  vk: '',
  telegram: '',
  youtube: '',
  website: '',
  twoGis: '',
  yandexMaps: '',
};

export const SCHOOL_SOCIAL_LINK_LABELS: Record<keyof SchoolSocialLinks, string> = {
  vk: 'ВКонтакте',
  telegram: 'Telegram',
  youtube: 'YouTube',
  website: 'Сайт школы',
  twoGis: '2ГИС',
  yandexMaps: 'Яндекс Карты',
};

export const SCHOOL_SOCIAL_LINK_KEYS = Object.keys(
  SCHOOL_SOCIAL_LINK_LABELS,
) as (keyof SchoolSocialLinks)[];

export const MAX_SCHOOL_LINK_LENGTH = 500;
export const MAX_DIRECTIONS_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
export const ALLOWED_DIRECTIONS_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
