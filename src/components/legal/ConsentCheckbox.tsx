import { Link } from 'react-router-dom';
import type { LegalDocument } from '@/types';
import { CONSENT_PURPOSE_DESCRIPTIONS } from '@/services/legal/constants';

interface ConsentCheckboxProps {
  document: LegalDocument;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
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
}: ConsentCheckboxProps) {
  const description = document.purpose
    ? CONSENT_PURPOSE_DESCRIPTIONS[document.purpose]
    : undefined;

  return (
    <label className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-elevated/60 p-3 text-body-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-subtle text-brand focus-ring"
        checked={checked}
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
            {document.title}
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
