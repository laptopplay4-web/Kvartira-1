import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import {
  COOKIE_CONSENT_BODY,
  COOKIE_CONSENT_LABELS,
  COOKIE_CONSENT_TITLE,
} from '@/services/cookies/constants';
import { cn } from '@/utils';

interface CookieConsentBannerProps {
  open: boolean;
  settingsOpen: boolean;
  draft: { essential: true; analytics: boolean; marketing: boolean };
  onAcceptAll: () => void;
  onRejectOptional: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  onAnalyticsChange: (value: boolean) => void;
  onMarketingChange: (value: boolean) => void;
  onSaveSettings: () => void;
}

/**
 * Fixed bottom GDPR cookie banner: accept all / reject optional / per-category settings.
 * Uses design-system tokens (light + dark via CSS variables).
 */
export function CookieConsentBanner({
  open,
  settingsOpen,
  draft,
  onAcceptAll,
  onRejectOptional,
  onOpenSettings,
  onCloseSettings,
  onAnalyticsChange,
  onMarketingChange,
  onSaveSettings,
}: CookieConsentBannerProps) {
  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-toast p-2 sm:p-2.5 pb-[max(0.5rem,var(--spacing-safe-bottom))]"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
    >
      <div
        className={cn(
          'pointer-events-auto mx-auto w-full max-w-md',
          'rounded-xl border border-border/80 bg-surface/90 shadow-md',
          'backdrop-blur-xl supports-[backdrop-filter]:bg-surface/75',
          'motion-safe:animate-fade-in',
        )}
      >
        <div className="space-y-2 p-2.5 sm:p-3">
          <div className="space-y-1">
            <h2 id="cookie-consent-title" className="text-sm font-medium text-text-primary">
              {COOKIE_CONSENT_TITLE}
            </h2>
            <p id="cookie-consent-body" className="text-caption leading-snug text-text-secondary">
              {COOKIE_CONSENT_BODY}{' '}
              Подробнее — в{' '}
              <Link to="/legal/legal-privacy" className="text-brand hover:underline">
                {COOKIE_CONSENT_LABELS.privacyLink}
              </Link>
              .
            </p>
          </div>

          {/* Category settings accordion */}
          {settingsOpen && (
            <div
              className="space-y-2 rounded-lg border border-border-subtle bg-surface-elevated/70 p-2"
              role="region"
              aria-label="Настройки cookie"
            >
              <CategoryRow
                id="cookie-essential"
                title={COOKIE_CONSENT_LABELS.essential}
                hint={COOKIE_CONSENT_LABELS.essentialHint}
                checked
                disabled
                onChange={() => {
                  /* essential always on */
                }}
              />
              <CategoryRow
                id="cookie-analytics"
                title={COOKIE_CONSENT_LABELS.analytics}
                hint={COOKIE_CONSENT_LABELS.analyticsHint}
                checked={draft.analytics}
                onChange={onAnalyticsChange}
              />
              <CategoryRow
                id="cookie-marketing"
                title={COOKIE_CONSENT_LABELS.marketing}
                hint={COOKIE_CONSENT_LABELS.marketingHint}
                checked={draft.marketing}
                onChange={onMarketingChange}
              />
            </div>
          )}

          {/* Actions: stacked on mobile, row on desktop */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="min-h-9 w-full sm:w-auto sm:min-w-[7rem]"
              onClick={settingsOpen ? onSaveSettings : onAcceptAll}
            >
              {settingsOpen
                ? COOKIE_CONSENT_LABELS.saveSettings
                : COOKIE_CONSENT_LABELS.acceptAll}
            </Button>
            {!settingsOpen && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-9 w-full sm:w-auto"
                onClick={onRejectOptional}
              >
                {COOKIE_CONSENT_LABELS.rejectOptional}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 w-full sm:ml-auto sm:w-auto"
              onClick={settingsOpen ? onCloseSettings : onOpenSettings}
            >
              {settingsOpen ? 'Скрыть настройки' : COOKIE_CONSENT_LABELS.settings}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  id,
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-caption font-medium text-text-primary">
          {title}
        </label>
        <p className="mt-0.5 text-[0.65rem] leading-snug text-text-muted">{hint}</p>
      </div>
      <Toggle id={id} label={title} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}
