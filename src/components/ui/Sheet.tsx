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

type SheetSize = 'sm' | 'md' | 'lg';

const SHEET_SIZE_CLASS: Record<SheetSize, string> = {
  sm: 'max-w-[var(--popup-max-sm)]',
  md: 'max-w-[var(--popup-max-md)]',
  lg: 'max-w-[var(--popup-max-lg)]',
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Sticky action row — always visible below the scrollable body. */
  footer?: ReactNode;
  className?: string;
  /** Desktop reading width. Default md. */
  size?: SheetSize;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  size = 'md',
}: SheetProps) {
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
      className="fixed inset-0 z-sheet flex items-end justify-center p-0 sm:items-center sm:p-6"
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
          'glass-popup relative z-10 flex max-h-[90dvh] w-full min-h-0 flex-col overflow-hidden',
          'rounded-t-2xl rounded-b-none pb-[var(--spacing-safe-bottom)] sm:max-h-[min(90dvh,var(--popup-max-h))] sm:rounded-2xl sm:pb-0',
          SHEET_SIZE_CLASS[size],
          leaving ? 'animate-sheet-out' : 'animate-sheet-in',
          className,
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex shrink-0 justify-center pt-3 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-white/25" />
        </div>
        {title && (
          <h2
            id={titleId}
            className="min-w-0 shrink-0 break-words px-5 pb-2 pt-3 text-h3 [overflow-wrap:anywhere] sm:pt-5"
          >
            {title}
          </h2>
        )}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain break-words px-2 pb-2 pt-1 scrollbar-none [overflow-wrap:anywhere] sm:px-3">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border/60 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
