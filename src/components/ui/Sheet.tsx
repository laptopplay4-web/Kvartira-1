import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils';

const EXIT_MS = 180;

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current == null) return;
      const endY = e.changedTouches[0]?.clientY ?? startY.current;
      if (endY - startY.current > 80) onClose();
      startY.current = null;
    },
    [onClose],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-sheet flex items-end justify-center"
      role="dialog"
      aria-modal
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className={cn(
          'absolute inset-0 glass-scrim',
          leaving ? 'animate-fade-out' : 'animate-fade-in',
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={cn(
          'glass-popup relative z-10 w-full max-w-lg rounded-t-2xl rounded-b-none pb-[var(--spacing-safe-bottom)] sm:mx-3 sm:mb-3 sm:rounded-2xl',
          leaving ? 'animate-sheet-out' : 'animate-sheet-in',
          className,
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center pt-3" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-white/25" />
        </div>
        {title && (
          <h2 id={titleId} className="px-5 pb-2 pt-3 text-h3">
            {title}
          </h2>
        )}
        <div className="px-2 pb-2 pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
