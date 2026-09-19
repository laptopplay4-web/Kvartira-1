import type { PublicContactInfo, SchoolDirectionsVideo, SchoolSocialLinks } from '@/types';
import {
  ALLOWED_DIRECTIONS_VIDEO_MIMES,
  EMPTY_SCHOOL_SOCIAL_LINKS,
  MAX_DIRECTIONS_VIDEO_SIZE,
  MAX_SCHOOL_LINK_LENGTH,
  SCHOOL_SOCIAL_LINK_KEYS,
  SCHOOL_SOCIAL_LINK_LABELS,
} from '@/services/school/constants';
import type { RegistrationInviteSecret } from '@/services/registration/invite';
import { extractRegistrationInviteFromContacts } from '@/services/registration/invite';

const URL_PATTERN = /^https?:\/\/.+/i;

/** PB json fields sometimes arrive as strings. */
export function coerceJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Добавляет https:// если пользователь ввёл vk.com/... без схемы. */
export function normalizeSchoolLinkUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (URL_PATTERN.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[^\s]+/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function normalizeSchoolSocialLinks(
  input?: Partial<SchoolSocialLinks> | null | unknown,
): SchoolSocialLinks {
  const result = { ...EMPTY_SCHOOL_SOCIAL_LINKS };
  const obj = coerceJsonObject(input) ?? (input && typeof input === 'object' ? (input as Record<string, unknown>) : null);
  if (!obj) return result;
  for (const key of SCHOOL_SOCIAL_LINK_KEYS) {
    const value = obj[key];
    result[key] = typeof value === 'string' ? normalizeSchoolLinkUrl(value) : '';
  }
  return result;
}

export function mergeSchoolSocialLinks(
  current: SchoolSocialLinks,
  patch?: Partial<SchoolSocialLinks>,
): SchoolSocialLinks {
  return normalizeSchoolSocialLinks({ ...current, ...patch });
}

export function validateSchoolSocialLinks(links: SchoolSocialLinks): string | null {
  for (const key of SCHOOL_SOCIAL_LINK_KEYS) {
    const value = normalizeSchoolLinkUrl(links[key] ?? '');
    if (!value) continue;
    if (value.length > MAX_SCHOOL_LINK_LENGTH) {
      return `${SCHOOL_SOCIAL_LINK_LABELS[key]} — не длиннее ${MAX_SCHOOL_LINK_LENGTH} символов`;
    }
    if (!URL_PATTERN.test(value)) {
      return `${SCHOOL_SOCIAL_LINK_LABELS[key]} — укажите ссылку вида https://…`;
    }
  }
  return null;
}

export function validateSchoolDirectionsVideoFile(input: {
  filename: string;
  mimeType: string;
  size: number;
}): string | null {
  if (!input.filename?.trim()) return 'Укажите файл видео';
  if (input.size <= 0) return 'Файл пустой';
  if (input.size > MAX_DIRECTIONS_VIDEO_SIZE) {
    return 'Видео не больше 100 МБ';
  }
  const mimeOk = (ALLOWED_DIRECTIONS_VIDEO_MIMES as readonly string[]).includes(input.mimeType);
  const extOk = /\.(mp4|webm|mov)$/i.test(input.filename);
  if (!mimeOk && !extOk) {
    return 'Допустимы MP4, WebM или MOV';
  }
  return null;
}

export function hasAnySchoolSocialLink(links: SchoolSocialLinks | undefined): boolean {
  if (!links) return false;
  return SCHOOL_SOCIAL_LINK_KEYS.some((key) => !!links[key]?.trim());
}

export function parseSchoolDirectionsVideo(value: unknown): SchoolDirectionsVideo | undefined {
  const obj = coerceJsonObject(value);
  if (!obj) return undefined;
  if (typeof obj.url !== 'string' || !obj.url.trim()) return undefined;
  return {
    url: obj.url.trim(),
    filename: typeof obj.filename === 'string' ? obj.filename : 'video.mp4',
    mimeType: typeof obj.mimeType === 'string' ? obj.mimeType : 'video/mp4',
    size: typeof obj.size === 'number' ? obj.size : 0,
  };
}

/**
 * PB payload: socialLinks + directionsVideo + registrationInvite живут внутри contacts JSON,
 * чтобы работать даже без отдельных полей коллекции (миграция не применена).
 * registrationInvite не попадает в PublicSchoolInfo — только admin API / PB hook.
 */
export function buildSchoolContactsPayload(input: {
  contacts: PublicContactInfo;
  socialLinks: SchoolSocialLinks;
  directionsVideo?: SchoolDirectionsVideo;
  registrationInvite?: RegistrationInviteSecret | null;
  /** Preserve YCLIENTS admin mappings inside contacts JSON. */
  yclientsMappings?: unknown;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    phone: input.contacts.phone,
    email: input.contacts.email,
    address: input.contacts.address,
    workingHours: input.contacts.workingHours,
    socialLinks: normalizeSchoolSocialLinks(input.socialLinks),
    directionsVideo: input.directionsVideo ?? null,
  };
  if (input.registrationInvite?.token) {
    payload.registrationInvite = {
      token: input.registrationInvite.token,
      rotatedAt: input.registrationInvite.rotatedAt,
    };
  }
  if (input.yclientsMappings != null) {
    payload.yclientsMappings = input.yclientsMappings;
  }
  return payload;
}

export function extractSchoolExtrasFromContacts(contactsRaw: unknown): {
  socialLinks: SchoolSocialLinks;
  directionsVideo?: SchoolDirectionsVideo;
  registrationInvite: RegistrationInviteSecret | null;
} {
  const obj = coerceJsonObject(contactsRaw);
  const socialLinks = normalizeSchoolSocialLinks(obj?.socialLinks);
  const directionsVideo = parseSchoolDirectionsVideo(obj?.directionsVideo);
  const registrationInvite = extractRegistrationInviteFromContacts(contactsRaw);
  return directionsVideo
    ? { socialLinks, directionsVideo, registrationInvite }
    : { socialLinks, registrationInvite };
}
