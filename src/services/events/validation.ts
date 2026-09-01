import type { CompetitionApplication, EventType, PublicSchoolInfo } from '@/types';
import type { CreateEventInput, UpdateEventInput, UpdateSchoolSettingsInput } from '@/services/api/types';

export function normalizeEventInput(
  input: CreateEventInput | UpdateEventInput,
): Partial<CreateEventInput> {
  return {
    ...input,
    title: input.title?.trim(),
    description: input.description?.trim(),
    date: input.date?.trim(),
    startTime: input.startTime?.trim(),
    endTime: input.endTime?.trim() || undefined,
    location: input.location?.trim(),
    imageUrl: input.imageUrl?.trim() || undefined,
    invitedUserIds: input.invitedUserIds?.filter(Boolean),
  };
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_LOCATION = 200;
const MAX_IMAGE_URL = 500;
const MAX_SCHOOL_NAME = 80;
const MAX_TAGLINE = 120;
const MAX_ABOUT = 2000;
const MAX_CONTACT = 120;

const ADMIN_EVENT_TYPES: EventType[] = ['concert', 'masterclass', 'competition', 'invited'];

export function validateEventInput(input: Partial<CreateEventInput>): string | null {
  const title = input.title?.trim();
  if (!title) return 'Укажите название';
  if (title.length > MAX_TITLE) return `Название не длиннее ${MAX_TITLE} символов`;

  const description = input.description?.trim();
  if (!description) return 'Укажите описание';
  if (description.length > MAX_DESCRIPTION) {
    return `Описание не длиннее ${MAX_DESCRIPTION} символов`;
  }

  if (!input.type || !ADMIN_EVENT_TYPES.includes(input.type)) {
    return 'Выберите тип мероприятия';
  }

  const date = input.date?.trim();
  if (!date) return 'Укажите дату';

  const startTime = input.startTime?.trim();
  if (!startTime) return 'Укажите время начала';

  const location = input.location?.trim();
  if (!location) return 'Укажите место';
  if (location.length > MAX_LOCATION) return `Место не длиннее ${MAX_LOCATION} символов`;

  if (input.endTime?.trim() && input.endTime.trim() <= startTime) {
    return 'Время окончания должно быть позже начала';
  }

  if (input.maxParticipants != null) {
    if (!Number.isInteger(input.maxParticipants) || input.maxParticipants < 1) {
      return 'Лимит участников — целое число от 1';
    }
  }

  const imageUrl = input.imageUrl?.trim();
  if (imageUrl && imageUrl.length > MAX_IMAGE_URL) {
    return `Ссылка на изображение не длиннее ${MAX_IMAGE_URL} символов`;
  }

  if (input.type === 'invited') {
    const invited = input.invitedUserIds?.filter(Boolean) ?? [];
    if (invited.length === 0) return 'Укажите приглашённых пользователей';
  }

  return null;
}

export function validateSchoolSettingsInput(
  input: Partial<UpdateSchoolSettingsInput>,
  current: PublicSchoolInfo,
): string | null {
  const name = (input.name ?? current.name).trim();
  if (!name) return 'Укажите название школы';
  if (name.length > MAX_SCHOOL_NAME) return `Название не длиннее ${MAX_SCHOOL_NAME} символов`;

  const tagline = (input.tagline ?? current.tagline).trim();
  if (!tagline) return 'Укажите слоган';
  if (tagline.length > MAX_TAGLINE) return `Слоган не длиннее ${MAX_TAGLINE} символов`;

  const about = (input.about ?? current.about).trim();
  if (!about) return 'Укажите описание';
  if (about.length > MAX_ABOUT) return `Описание не длиннее ${MAX_ABOUT} символов`;

  const contacts = { ...current.contacts, ...input.contacts };
  for (const [label, value] of [
    ['Телефон', contacts.phone],
    ['Email', contacts.email],
    ['Адрес', contacts.address],
    ['Часы работы', contacts.workingHours],
  ] as const) {
    const trimmed = value?.trim();
    if (!trimmed) return `Укажите ${label.toLowerCase()}`;
    if (trimmed.length > MAX_CONTACT) {
      return `${label} не длиннее ${MAX_CONTACT} символов`;
    }
  }

  return null;
}

const MAX_PIECE_TITLE = 120;
const MAX_COMPOSER = 80;
const MAX_CATEGORY = 60;
const MAX_NOTES = 500;
const MIN_DURATION = 1;
const MAX_DURATION = 30;

export function validateCompetitionApplication(
  input: Partial<CompetitionApplication>,
): string | null {
  const pieceTitle = input.pieceTitle?.trim();
  if (!pieceTitle) return 'Укажите название произведения';
  if (pieceTitle.length > MAX_PIECE_TITLE) {
    return `Название не длиннее ${MAX_PIECE_TITLE} символов`;
  }

  const composer = input.composer?.trim();
  if (!composer) return 'Укажите композитора';
  if (composer.length > MAX_COMPOSER) {
    return `Имя композитора не длиннее ${MAX_COMPOSER} символов`;
  }

  const duration = input.durationMinutes;
  if (duration == null || Number.isNaN(duration)) return 'Укажите продолжительность';
  if (duration < MIN_DURATION || duration > MAX_DURATION) {
    return `Продолжительность от ${MIN_DURATION} до ${MAX_DURATION} минут`;
  }

  const category = input.category?.trim();
  if (category && category.length > MAX_CATEGORY) {
    return `Категория не длиннее ${MAX_CATEGORY} символов`;
  }

  const notes = input.notes?.trim();
  if (notes && notes.length > MAX_NOTES) {
    return `Комментарий не длиннее ${MAX_NOTES} символов`;
  }

  return null;
}

export function normalizeCompetitionApplication(
  input: CompetitionApplication,
): CompetitionApplication {
  return {
    pieceTitle: input.pieceTitle.trim(),
    composer: input.composer.trim(),
    durationMinutes: input.durationMinutes,
    category: input.category?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };
}
