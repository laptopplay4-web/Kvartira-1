import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { canNavigateBack } from '@/utils/backNavigation';

export function useBackNavigation(fallbackTo: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    if (canNavigateBack()) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  }, [navigate, fallbackTo]);
}
