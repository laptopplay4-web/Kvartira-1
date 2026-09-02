import { getPocketBase, isPocketBaseMode } from '@/services/api/pocketbase/client';
import {
  PHONE_STORAGE_REGEX,
  digitsToStoredPhone,
  phoneFromSyntheticEmail,
  storedPhoneToDisplay,
} from '@/utils/phone';

const LOGIN_PHONE_PREFIX = 'kvartira-login-phone:';
const PB_AUTH_STORAGE_KEY = 'pocketbase_auth';

function isValidStoredPhone(phone: string | null | undefined): phone is string {
  return !!phone && PHONE_STORAGE_REGEX.test(phone);
}

export { phoneFromSyntheticEmail };

export function readPbAuthPhone(userId: string): string {
  try {
    const raw = localStorage.getItem(PB_AUTH_STORAGE_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw) as {
      record?: { id?: string; phone?: string; email?: string };
    };
    if (data.record?.id !== userId) return '';
    if (isValidStoredPhone(data.record.phone)) return data.record.phone;
    return phoneFromSyntheticEmail(data.record.email);
  } catch {
    return '';
  }
}

export function readPbAuthPhoneFromStore(userId: string): string {
  if (!isPocketBaseMode()) return '';
  try {
    const pb = getPocketBase();
    if (pb.authStore.record?.id !== userId) return '';
    const record = pb.authStore.record as { phone?: string; email?: string };
    if (isValidStoredPhone(record.phone)) return record.phone;
    return phoneFromSyntheticEmail(record.email);
  } catch {
    return '';
  }
}

export function persistLoginPhone(userId: string, phone: string): void {
  const stored = digitsToStoredPhone(phone);
  if (!PHONE_STORAGE_REGEX.test(stored)) return;
  try {
    localStorage.setItem(`${LOGIN_PHONE_PREFIX}${userId}`, stored);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedLoginPhone(userId: string): string {
  try {
    const value = localStorage.getItem(`${LOGIN_PHONE_PREFIX}${userId}`);
    return value && PHONE_STORAGE_REGEX.test(value) ? value : '';
  } catch {
    return '';
  }
}

export function clearPersistedLoginPhone(userId: string): void {
  try {
    localStorage.removeItem(`${LOGIN_PHONE_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}

export function resolveOwnPhoneNumber(
  userId: string,
  ...candidates: (string | null | undefined)[]
): string {
  for (const candidate of candidates) {
    if (isValidStoredPhone(candidate)) return candidate;
  }
  const persisted = readPersistedLoginPhone(userId);
  if (persisted) return persisted;
  const pbStore = readPbAuthPhoneFromStore(userId);
  if (pbStore) return pbStore;
  return readPbAuthPhone(userId);
}

export function formatOwnPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '—';
  const display = storedPhoneToDisplay(phone);
  return display || '—';
}
