import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils';

interface AvatarPhotoViewerProps {
  open: boolean;
  src?: string;
  alt: string;
  onClose: () => void;
}

export function AvatarPhotoViewer({ open, src, alt, onClose }: AvatarPhotoViewerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', handler, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !src || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-lightbox flex flex-col bg-black',
        'motion-safe:animate-fade-in',
      )}
      role="dialog"
      aria-modal
      aria-label="Просмотр фото профиля"
      onClick={onClose}
    >
      <div className="flex shrink-0 justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <IconButton
          label="Закрыть"
          onClick={onClose}
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>
      <div
        className="flex flex-1 items-center justify-center p-4 motion-safe:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
    </div>,
    document.body,
  );
}
