import PocketBase from 'pocketbase';
import type { User } from '@/types';
import { userToPbRecord } from '@/services/api/pocketbase/mappers';

const DEFAULT_PB_URL = 'http://localhost:8090';

let pbInstance: PocketBase | null = null;

export function getPbUrl(): string {
  const url = import.meta.env.VITE_API_URL ?? DEFAULT_PB_URL;
  return url.replace(/\/$/, '');
}

export function getPocketBase(): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(getPbUrl());
    pbInstance.autoCancellation(false);
  }
  return pbInstance;
}

export function setPocketBaseAuth(token: string, user: User): void {
  const pb = getPocketBase();
  pb.authStore.save(token, userToPbRecord(user));
}

export function clearPocketBaseAuth(): void {
  getPocketBase().authStore.clear();
}

export function isPocketBaseMode(): boolean {
  return (import.meta.env.VITE_API_MODE ?? 'mock') === 'pocketbase';
}
