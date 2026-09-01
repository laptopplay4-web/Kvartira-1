export const PWA_INSTALL_DISMISS_KEY = 'pwaInstallDismissedAt';

/** Не показывать повторно 7 дней после явного отказа (PROJECT_SPEC §19). */
export const PWA_INSTALL_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Задержка перед показом — ненавязчивый prompt. */
export const PWA_INSTALL_SHOW_DELAY_MS = 3000;
