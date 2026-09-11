import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** false — без крестика, Escape и клика по фону (блокирующие диалоги). */
  dismissible?: boolean;
  /** Full-bleed overlay (crop / lightbox). */
  variant?: 'default' | 'fullscreen';
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  dismissible = true,
  variant = 'default',
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        previouslyFocused.current = document.activeElement as HTMLElement | null;
      }
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = getFocusable(panel);
    (focusables[0] ?? panel).focus();
  }, [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = getFocusable(panelRef.current);
      if (focusables.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose, open],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  const fullscreen = variant === 'fullscreen';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-modal flex justify-center',
        fullscreen ? 'items-stretch' : 'items-end sm:items-center',
      )}
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 glass-scrim motion-safe:animate-fade-in"
        onClick={dismissible ? onClose : undefined}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 outline-none motion-safe:animate-scale-in',
          fullscreen
            ? 'flex h-full w-full flex-col bg-surface/90 backdrop-blur-xl'
            : 'glass-popup max-h-[90dvh] w-full max-w-md overflow-y-auto p-6 sm:rounded-2xl rounded-t-2xl sm:mx-4',
          className,
        )}
      >
        <div
          className={cn(
            'mb-4 flex items-center justify-between gap-3',
            fullscreen && 'border-b border-border px-4 py-3',
          )}
        >
          <h2 id={titleId} className="text-h2">
            {title}
          </h2>
          {dismissible && (
            <IconButton label="Закрыть" onClick={onClose} size="sm">
              <X className="h-5 w-5" aria-hidden />
            </IconButton>
          )}
        </div>
        <div className={cn(fullscreen && 'min-h-0 flex-1 overflow-y-auto px-4 pb-4')}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
