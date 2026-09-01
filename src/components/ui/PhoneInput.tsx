import { forwardRef, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import {
  digitsToStoredPhone,
  extractPhoneDigits,
  PHONE_DISPLAY_PLACEHOLDER,
  storedPhoneToDisplay,
} from '@/utils/phone';

interface PhoneInputProps {
  label?: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  disabled?: boolean;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, hint, value, onChange, onBlur, name, id, disabled }, ref) => {
    const displayValue = storedPhoneToDisplay(value);

    const applyDigits = useCallback(
      (raw: string) => {
        const digits = extractPhoneDigits(raw);
        onChange(digitsToStoredPhone(digits));
      },
      [onChange],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      applyDigits(e.target.value);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      applyDigits(e.clipboardData.getData('text'));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const allowed = [
        'Backspace',
        'Delete',
        'Tab',
        'Escape',
        'Enter',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ];
      if (allowed.includes(e.key)) return;

      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    };

    return (
      <Input
        ref={ref}
        id={id}
        name={name}
        label={label}
        error={error}
        hint={hint}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={PHONE_DISPLAY_PLACEHOLDER}
        value={displayValue}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        disabled={disabled}
      />
    );
  },
);
PhoneInput.displayName = 'PhoneInput';
