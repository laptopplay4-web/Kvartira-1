import { useSyncExternalStore } from 'react';

export const OFFLINE_NETWORK_MESSAGE =
  'Нет подключения к интернету. Проверьте соединение и попробуйте снова.';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
