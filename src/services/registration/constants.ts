/**
 * Demo/mock invite token.
 *
 * Он лежит в репозитории, поэтому публично известен. PocketBase отклоняет его
 * (`kvartiraInvite.js`), пока в окружении сервера не выставлен `KVARTIRA_DEV=1`.
 * `getRegistrationInvite` автоматически заменяет seed на случайный токен —
 * QR со стенда всегда открывает форму регистрации; на боевом стенде при смене
 * кода используйте «Новый QR» в `/admin/registration-qr`.
 */
export const SEED_REGISTRATION_INVITE_TOKEN =
  'kvartira-school-invite-7f3a9c2e1b8d4e6f0a5c9d2e8b1f4a7c';

export const REGISTRATION_INVITE_QUERY_PARAM = 'invite';

export const REGISTRATION_INVITE_STORAGE_KEY = 'kvartira-registration-invite';

/** Header для PocketBase create (поле не в схеме users). */
export const REGISTRATION_INVITE_HEADER = 'X-Registration-Invite';

export const REGISTRATION_INVITE_TOKEN_HEX_LENGTH = 64;

export const INVALID_REGISTRATION_INVITE_MESSAGE =
  'Регистрация доступна только по QR-коду в школе. Отсканируйте код на стенде.';

export const MISSING_REGISTRATION_INVITE_MESSAGE = INVALID_REGISTRATION_INVITE_MESSAGE;
