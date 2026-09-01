import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { MessageAttachment } from '@/types';

interface ImageViewerProps {
  images: MessageAttachment[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function ImageViewer({ images, initialIndex, open, onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(images.length - 1, i + 1));
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose, images.length]);

  if (!open || images.length === 0) return null;
  const current = images[index];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal aria-label="Просмотр изображения">
      <div className="flex shrink-0 items-center justify-between p-4">
        <span className="truncate text-sm text-white/80">{current?.filename}</span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть" className="text-white">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-4">
        {images.length > 1 && index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex((i) => i - 1)}
            className="absolute left-2 text-white"
            aria-label="Предыдущее"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {current?.url && (
          <img src={current.url} alt={current.filename} className="max-h-full max-w-full object-contain" />
        )}
        {images.length > 1 && index < images.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex((i) => i + 1)}
            className="absolute right-2 text-white"
            aria-label="Следующее"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>
  );
}
