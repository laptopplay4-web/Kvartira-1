import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadFromUrl } from '@/utils/files';
import type { MessageAttachment } from '@/types';

interface ImageViewerProps {
  images: MessageAttachment[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  /** Chat: false (download via long-press menu). Assignments may enable. */
  showDownload?: boolean;
}

export function ImageViewer({
  images,
  initialIndex,
  open,
  onClose,
  showDownload = false,
}: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const skipCloseRef = useRef(false);

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

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(images.length - 1, i + 1));

  const handleDownload = async () => {
    if (!current?.url || downloading) return;
    setDownloading(true);
    try {
      await downloadFromUrl(current.url, current.filename || 'image.jpg');
    } catch {
      /* keep in-app; never open image URL in a new tab */
    } finally {
      setDownloading(false);
    }
  };

  const handleBackdropClick = () => {
    if (skipCloseRef.current) {
      skipCloseRef.current = false;
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="Просмотр изображения"
      onClick={handleBackdropClick}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const end = e.changedTouches[0]?.clientX ?? start;
        const dx = end - start;
        if (Math.abs(dx) < 48) return;
        skipCloseRef.current = true;
        if (dx < 0) goNext();
        else goPrev();
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-sm text-white/80">
          {images.length > 1 ? `${index + 1} / ${images.length}` : null}
        </span>
        <div className="flex items-center gap-1">
          {showDownload ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={downloading}
              aria-label="Скачать"
              className="text-white"
            >
              {downloading ? (
                <span className="h-5 w-5 animate-pulse rounded-full bg-white/30" aria-hidden />
              ) : (
                <Download className="h-5 w-5" />
              )}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть" className="text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-4">
        {images.length > 1 && index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-2 text-white"
            aria-label="Предыдущее"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {current?.url && (
          <img
            src={current.url}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {images.length > 1 && index < images.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
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
