/** VAPID public key for PushManager.subscribe (base64url). */
export const VAPID_PUBLIC_KEY_ENV = 'VITE_VAPID_PUBLIC_KEY';

/** Max wait for an existing SW registration (`.ready` never resolves if none). */
export const SERVICE_WORKER_READY_TIMEOUT_MS = 4_000;

export const PUSH_PERMISSION_DENIED_MESSAGE =
  'Разрешите уведомления в настройках браузера, чтобы получать push.';

export const PUSH_UNSUPPORTED_MESSAGE =
  'Push-уведомления недоступны в этом браузере. Внутри приложения уведомления работают.';

export const PUSH_NOT_CONFIGURED_MESSAGE =
  'Push на сервере ещё не настроен (VAPID). Настройка сохранена — на телефон заработает после настройки.';

export const PUSH_SW_UNAVAILABLE_MESSAGE =
  'Service Worker ещё не готов. Обновите страницу или установите приложение как PWA.';
