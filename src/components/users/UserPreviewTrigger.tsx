import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';

import { useUserPreview } from '@/components/users/UserPreviewProvider';
import { cn, formatUserName } from '@/utils';
import type { User } from '@/types';

type UserPreviewTriggerProps = {
  user?: User | null;
  userId?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Use `span` when nested inside another interactive element (e.g. chat list row). */
  as?: 'button' | 'span';
  'aria-label'?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'onClick'>;

export function UserPreviewTrigger({
  user,
  userId,
  children,
  className,
  disabled,
  as = 'button',
  'aria-label': ariaLabel,
  ...rest
}: UserPreviewTriggerProps) {
  const { openUserPreview } = useUserPreview();
  const targetId = user?.id ?? userId;
  const label =
    ariaLabel ??
    (user ? `Профиль: ${formatUserName(user)}` : targetId ? 'Открыть профиль' : undefined);

  if (!targetId) {
    return <>{children}</>;
  }

  const open = () => {
    if (disabled) return;
    if (user) openUserPreview(user);
    else openUserPreview(targetId);
  };

  const onActivate = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    open();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    onActivate(event);
  };

  const sharedClassName = cn(
    'rounded-xl text-left transition-opacity focus-ring',
    'hover:opacity-90 active:opacity-80',
    disabled && 'pointer-events-none opacity-50',
    className,
  );

  if (as === 'span') {
    return (
      <span
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={sharedClassName}
        onClick={onActivate}
        onKeyDown={onKeyDown}
        {...rest}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={sharedClassName}
      onClick={onActivate}
      {...rest}
    >
      {children}
    </button>
  );
}
