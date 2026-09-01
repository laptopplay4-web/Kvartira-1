import { useEffect } from 'react';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface AvatarPhotoViewerProps {
  open: boolean;
  src?: string;
  alt: string;
  onClose: () => void;
}

export function AvatarPhotoViewer({ open, src, alt, onClose }: AvatarPhotoViewerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      role="dialog"
      aria-modal
      aria-label="Просмотр фото профиля"
      onClick={onClose}
    >
      <div className="flex shrink-0 justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть" className="text-white">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center p-6" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-h-full max-w-full rounded-2xl object-contain" />
      </div>
    </div>
  );
}
