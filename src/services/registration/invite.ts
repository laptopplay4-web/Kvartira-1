import {
  REGISTRATION_INVITE_QUERY_PARAM,
  REGISTRATION_INVITE_STORAGE_KEY,
  REGISTRATION_INVITE_TOKEN_HEX_LENGTH,
  SEED_REGISTRATION_INVITE_TOKEN,
} from '@/services/registration/constants';

export interface RegistrationInviteSecret {
  token: string;
  rotatedAt: string;
}

export interface RegistrationInviteInfo {
  token: string;
  registerUrl: string;
  rotatedAt: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
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

export function createSeedRegistrationInvite(
  rotatedAt = new Date().toISOString(),
): RegistrationInviteSecret {
  return {
    token: SEED_REGISTRATION_INVITE_TOKEN,
    rotatedAt,
  };
}

export function generateRegistrationInviteToken(): string {
  const bytes = new Uint8Array(REGISTRATION_INVITE_TOKEN_HEX_LENGTH / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createRotatedRegistrationInvite(
  rotatedAt = new Date().toISOString(),
): RegistrationInviteSecret {
  return {
    token: generateRegistrationInviteToken(),
    rotatedAt,
  };
}

/** Constant-time compare for equal-length strings. */
export function inviteTokensEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isRegistrationInviteTokenFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (trimmed.length < 32 || trimmed.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

export function normalizeRegistrationInviteToken(token: string | null | undefined): string {
  return typeof token === 'string' ? token.trim() : '';
}

export function parseRegistrationInvite(value: unknown): RegistrationInviteSecret | null {
  const obj = asObject(value);
  if (!obj) return null;
  const token = typeof obj.token === 'string' ? obj.token.trim() : '';
  if (!token) return null;
  const rotatedAt =
    typeof obj.rotatedAt === 'string' && obj.rotatedAt.trim()
      ? obj.rotatedAt.trim()
      : new Date(0).toISOString();
  return { token, rotatedAt };
}

export function extractRegistrationInviteFromContacts(
  contactsRaw: unknown,
): RegistrationInviteSecret | null {
  const obj = asObject(contactsRaw);
  if (!obj) return null;
  return parseRegistrationInvite(obj.registrationInvite);
}

export function buildRegistrationInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '') || 'http://localhost';
  const url = new URL('/register', `${base}/`);
  url.searchParams.set(REGISTRATION_INVITE_QUERY_PARAM, token);
  return url.toString();
}

export function resolveAppOrigin(fallback = 'http://localhost'): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return fallback;
}

export function toRegistrationInviteInfo(
  invite: RegistrationInviteSecret,
  origin?: string,
): RegistrationInviteInfo {
  const appOrigin = origin ?? resolveAppOrigin();
  return {
    token: invite.token,
    rotatedAt: invite.rotatedAt,
    registerUrl: buildRegistrationInviteUrl(appOrigin, invite.token),
  };
}

export function readInviteTokenFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const token = params.get(REGISTRATION_INVITE_QUERY_PARAM);
    return token?.trim() || null;
  } catch {
    return null;
  }
}

export function persistRegistrationInviteToken(token: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const normalized = normalizeRegistrationInviteToken(token);
  if (!normalized) return;
  sessionStorage.setItem(REGISTRATION_INVITE_STORAGE_KEY, normalized);
}

export function loadPersistedRegistrationInviteToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(REGISTRATION_INVITE_STORAGE_KEY);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

export function clearPersistedRegistrationInviteToken(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(REGISTRATION_INVITE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function resolveRegistrationInviteToken(options: {
  search?: string;
  persisted?: string | null;
}): string | null {
  const fromUrl = options.search ? readInviteTokenFromSearch(options.search) : null;
  if (fromUrl) return fromUrl;
  if (options.persisted) return options.persisted;
  return loadPersistedRegistrationInviteToken();
}
