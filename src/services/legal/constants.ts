import type { ConsentPurpose, LegalDocumentType } from '@/types';

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  privacy_policy: 'Политика конфиденциальности',
  personal_data: 'Обработка персональных данных',
  terms_of_service: 'Пользовательское соглашение',
  school_rules: 'Правила школы',
};

/** Short label shown next to each checkbox on the registration form. */
export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  service: 'Оказание услуг школы',
  communication: 'Уведомления и рассылки',
  publication: 'Публикация фото и видео',
  minor_guardian: 'Согласие законного представителя',
};

/** Plain-language explanation of what each purpose actually covers. */
export const CONSENT_PURPOSE_DESCRIPTIONS: Record<ConsentPurpose, string> = {
  service:
    'Запись на занятия, расписание, домашние задания, чат с преподавателем. Без этого пользоваться приложением нельзя.',
  communication:
    'Напоминания о занятиях, новости школы и приглашения на мероприятия. Можно отключить в любой момент.',
  publication:
    'Размещение фото и видео с занятий и концертов, а также имени ученика на сайте и в соцсетях школы.',
  minor_guardian:
    'Если ученику меньше 18 лет, согласие даёт законный представитель — родитель или опекун.',
};

/** Purposes without which the account cannot function. */
export const REQUIRED_CONSENT_PURPOSES: ConsentPurpose[] = ['service'];

/** Legacy purposes kept for old DB rows; no longer offered in the app. */
export const OPTIONAL_CONSENT_PURPOSES: ConsentPurpose[] = [];

/** Age below which a legal representative must give consent. */
export const CONSENT_ADULT_AGE = 18;

export function isRequiredConsentPurpose(purpose: ConsentPurpose | undefined): boolean {
  return purpose !== undefined && REQUIRED_CONSENT_PURPOSES.includes(purpose);
}

/**
 * Withdrawing service consent means processing must stop entirely, so there is
 * no "account without consent" state — the honest outcome is deletion.
 */
export const REVOKE_SERVICE_CONSENT_MESSAGE =
  'Это согласие нельзя отозвать отдельно — без него аккаунт не работает. Удалите аккаунт в настройках профиля.';
