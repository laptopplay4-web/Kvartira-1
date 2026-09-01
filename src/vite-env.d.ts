/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE: 'mock' | 'pocketbase' | 'rest';
  /** PocketBase / REST API base URL (no trailing slash) */
  readonly VITE_API_URL?: string;
  /** VAPID public key (base64url) for Web Push subscribe */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
