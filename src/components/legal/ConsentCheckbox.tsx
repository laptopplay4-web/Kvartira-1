import { Link } from 'react-router-dom';
import type { LegalDocument } from '@/types';
import { CONSENT_PURPOSE_DESCRIPTIONS } from '@/services/legal/constants';
import { cn } from '@/utils';

interface ConsentCheckboxProps {
  document: LegalDocument;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  /** Override link/label text (e.g. оферта). */
  title?: string;
  /** Highlight when submit attempted without accepting. */
  invalid?: boolean;
}

/**
 * One consent = one purpose = one checkbox, never pre-filled (152-ФЗ, ст. 9 ч. 1
 * in the wording effective 01.09.2025).
 */
export function ConsentCheckbox({
  document,
  checked,
  onChange,
  required = false,
  title,
  invalid = false,
}: ConsentCheckboxProps) {
  const description = document.purpose
    ? CONSENT_PURPOSE_DESCRIPTIONS[document.purpose]
    : undefined;
  const label = title?.trim() || document.title;

  return (
    <label
      data-invalid={invalid || undefined}
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-surface-elevated/60 p-3 text-body-sm transition-colors',
        invalid ? 'border-danger' : 'border-border-subtle',
      )}
    >
      <input
        type="checkbox"
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 rounded text-brand focus-ring',
          invalid ? 'border-danger' : 'border-border-subtle',
        )}
        checked={checked}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block">
          <Link
            to={`/legal/${document.id}`}
            className="text-brand hover:underline"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </Link>
          {required ? (
            <span className="ml-1 text-text-muted">— обязательно</span>
          ) : (
            <span className="ml-1 text-text-muted">— по желанию</span>
          )}
        </span>
        {description && (
          <span className="mt-1 block text-caption text-text-muted">{description}</span>
        )}
      </span>
    </label>
  );
}
