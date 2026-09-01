import { useCallback, useEffect, useState } from 'react';
import { DRAFT_STORAGE_PREFIX } from '@/services/chat/constants';

export function useChatDraft(conversationId: string | undefined) {
  const storageKey = conversationId ? `${DRAFT_STORAGE_PREFIX}${conversationId}` : null;

  const [draft, setDraftState] = useState(() => {
    if (!storageKey) return '';
    try {
      return localStorage.getItem(storageKey) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!storageKey) {
      setDraftState('');
      return;
    }
    try {
      setDraftState(localStorage.getItem(storageKey) ?? '');
    } catch {
      setDraftState('');
    }
  }, [storageKey]);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      if (!storageKey) return;
      try {
        if (value.trim()) {
          localStorage.setItem(storageKey, value);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    setDraftState('');
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  return { draft, setDraft, clearDraft };
}
