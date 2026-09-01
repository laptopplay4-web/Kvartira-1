import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { MESSAGE_SEARCH_DEBOUNCE_MS, MESSAGE_SEARCH_MIN_LENGTH } from '@/services/chat/constants';

export function useSearchMessages(userId: string, query: string) {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), MESSAGE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ['chat-search', userId, debounced],
    queryFn: () => api.chat.searchMessages(userId, debounced),
    enabled: !!userId && debounced.trim().length >= MESSAGE_SEARCH_MIN_LENGTH,
  });
}
