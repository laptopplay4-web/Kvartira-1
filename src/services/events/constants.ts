import type { EventType } from '@/types';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  concert: 'Концерт',
  masterclass: 'Мастер-класс',
  competition: 'Конкурс',
  invited: 'По приглашению',
};

export const COMPETITION_CATEGORY_OPTIONS = [
  'До 12 лет',
  '13–17 лет',
  '18–25 лет',
  'Взрослые',
] as const;
