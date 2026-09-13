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

type ModalSize = 'sm' | 'md' | 'lg';

const MODAL_SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-[var(--popup-max-sm)]',
  md: 'max-w-[var(--popup-max-md)]',
  lg: 'max-w-[var(--popup-max-lg)]',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky action row — always visible below the scrollable body. */
  footer?: ReactNode;
  className?: string;
  /** Desktop reading width. Default md (28rem). */
  size?: ModalSize;
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
  footer,
  className,
  size = 'md',
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
        fullscreen ? 'items-stretch' : 'items-end p-0 sm:items-center sm:p-6',
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
          'relative z-10 flex min-h-0 min-w-0 flex-col outline-none motion-safe:animate-scale-in',
          fullscreen
            ? 'h-full w-full overflow-x-hidden bg-surface/90 backdrop-blur-xl'
            : [
                'glass-popup w-full p-6 sm:rounded-2xl rounded-t-2xl',
                MODAL_SIZE_CLASS[size],
                'max-h-[90dvh] sm:max-h-[min(90dvh,var(--popup-max-h))]',
                'overflow-hidden',
              ],
          className,
        )}
      >
        <div
          className={cn(
            'mb-4 flex shrink-0 items-center justify-between gap-3',
            fullscreen && 'border-b border-border px-4 py-3',
          )}
        >
          <h2 id={titleId} className="min-w-0 flex-1 break-words text-h2">
            {title}
          </h2>
          {dismissible && (
            <IconButton label="Закрыть" onClick={onClose} size="sm" className="shrink-0">
              <X className="h-5 w-5" aria-hidden />
            </IconButton>
          )}
        </div>
        <div
          className={cn(
            'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain break-words scrollbar-none [overflow-wrap:anywhere]',
            fullscreen && 'px-4 pb-4',
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="mt-4 shrink-0 border-t border-border/60 pt-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
