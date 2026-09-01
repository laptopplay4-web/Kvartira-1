import type { EventType } from '@/types';

export const PUBLIC_EVENT_TYPE_LABELS: Record<Exclude<EventType, 'invited'>, string> = {
  concert: 'Концерт',
  masterclass: 'Мастер-класс',
  competition: 'Конкурс',
};
