import { Download, X } from 'lucide-react';
import { Button } from './Button';

interface PwaInstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
  installing?: boolean;
}

export function PwaInstallBanner({ onInstall, onDismiss, installing }: PwaInstallBannerProps) {
  return (
    <div
      role="region"
      aria-label="Установка приложения"
      className="border-t border-border bg-surface-elevated px-4 py-3 shadow-md"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">Установить приложение</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Быстрый доступ с главного экрана телефона
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={onInstall} loading={installing}>
              Установить
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Не сейчас
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="focus-ring min-h-11 min-w-11 shrink-0 rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
