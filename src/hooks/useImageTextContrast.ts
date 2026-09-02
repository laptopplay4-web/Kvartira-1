import { useEffect, useState } from 'react';
import {
  detectImageTextContrast,
  type ImageTextContrast,
} from '@/services/images/contrast';

export function useImageTextContrast(imageUrl: string | undefined): ImageTextContrast {
  const [contrast, setContrast] = useState<ImageTextContrast>('on-dark');

  useEffect(() => {
    if (!imageUrl) {
      setContrast('on-dark');
      return;
    }

    let cancelled = false;

    detectImageTextContrast(imageUrl).then((result) => {
      if (!cancelled) setContrast(result);
    });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return contrast;
}
