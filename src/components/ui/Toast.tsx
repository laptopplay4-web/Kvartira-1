import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils';
import { IconButton } from './IconButton';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'tone' | 'durationMs'>> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  pushToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-info/30 bg-info-muted/55',
  success: 'border-success/30 bg-success-muted/55',
  warning: 'border-warning/30 bg-warning-muted/55',
  danger: 'border-danger/30 bg-danger-muted/55',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? 'info',
        durationMs: input.durationMs ?? 3500,
      };
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => dismiss(id), item.durationMs);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+0.75rem)] z-toast flex flex-col items-center gap-2 px-4 md:bottom-6"
            aria-live="polite"
          >
            {items.map((item) => (
              <div
                key={item.id}
                role="status"
                className={cn(
                  'pointer-events-auto flex w-full max-w-md items-start gap-3 glass-popup px-4 py-3 text-text-primary animate-slide-up-in',
                  TONE_CLASS[item.tone],
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-caption text-text-secondary">{item.description}</p>
                  )}
                </div>
                <IconButton label="Закрыть" size="sm" onClick={() => dismiss(item.id)}>
                  <X className="h-4 w-4" aria-hidden />
                </IconButton>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/* eslint-disable-next-line react-refresh/only-export-components -- hook pairs with ToastProvider */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      pushToast: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}
