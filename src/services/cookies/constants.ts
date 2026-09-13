/** localStorage key for the full consent object (JSON). */
export const COOKIE_CONSENT_STORAGE_KEY = 'kvartira-cookie-consent';

/**
 * Bump when the consent model changes — old plain `"1"` values are ignored
 * so the banner is shown again with the new categories.
 */
export const COOKIE_CONSENT_VERSION = '2';

export const COOKIE_CONSENT_TITLE = 'Мы используем cookie';

export const COOKIE_CONSENT_BODY =
  'Мы используем файлы cookie и похожие технологии, чтобы сайт работал корректно, запоминать вход и настройки. Вы можете принять все cookie, отклонить необязательные или выбрать категории в настройках.';

export const COOKIE_CONSENT_LABELS = {
  acceptAll: 'Принять все',
  rejectOptional: 'Отклонить необязательные',
  settings: 'Настройки',
  saveSettings: 'Сохранить',
  essential: 'Технические',
  essentialHint: 'Нужны для входа, безопасности и базовой работы сайта. Всегда включены.',
  analytics: 'Аналитические',
  analyticsHint: 'Помогают понимать, как пользуются сайтом (например, Яндекс.Метрика, Google Analytics).',
  marketing: 'Маркетинговые',
  marketingHint: 'Используются для рекламы и персонализированных предложений.',
  privacyLink: 'политике конфиденциальности',
} as const;
