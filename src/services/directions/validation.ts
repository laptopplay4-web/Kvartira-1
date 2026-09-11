import type { Direction } from '@/types';
import {
  DIRECTION_DESCRIPTION_MAX,
  DIRECTION_ICON_MAX,
  DIRECTION_NAME_MAX,
  DIRECTION_NAME_MIN,
} from './constants';

export interface DirectionInputFields {
  name?: string;
  description?: string;
  icon?: string;
}

export function validateDirectionInput(data: DirectionInputFields): string | null {
  const name = data.name?.trim() ?? '';
  if (name.length < DIRECTION_NAME_MIN) {
    return `Название — минимум ${DIRECTION_NAME_MIN} символа`;
  }
  if (name.length > DIRECTION_NAME_MAX) {
    return `Название — максимум ${DIRECTION_NAME_MAX} символов`;
  }
  if (data.description !== undefined && data.description.length > DIRECTION_DESCRIPTION_MAX) {
    return `Описание — максимум ${DIRECTION_DESCRIPTION_MAX} символов`;
  }
  if (data.icon !== undefined && data.icon.length > DIRECTION_ICON_MAX) {
    return `Иконка — максимум ${DIRECTION_ICON_MAX} символов`;
  }
  return null;
}

export function normalizeDirectionInput(data: DirectionInputFields): {
  name: string;
  description?: string;
  icon?: string;
} {
  const name = data.name!.trim();
  const description = data.description?.trim();
  const icon = data.icon?.trim();
  return {
    name,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
  };
}

/** Минимум одно направление; все id должны существовать в каталоге. */
export function validateDirectionIdsSelection(
  directionIds: string[] | undefined,
  available: Pick<Direction, 'id'>[],
  options?: { required?: boolean },
): string | null {
  const required = options?.required !== false;
  const ids = [...new Set((directionIds ?? []).filter(Boolean))];
  if (required && ids.length === 0) {
    return 'Выберите хотя бы одно направление';
  }
  const allowed = new Set(available.map((d) => d.id));
  for (const id of ids) {
    if (!allowed.has(id)) {
      return 'Выбрано неизвестное направление';
    }
  }
  return null;
}

export function normalizeDirectionIds(directionIds: string[]): string[] {
  return [...new Set(directionIds.filter(Boolean))];
}
