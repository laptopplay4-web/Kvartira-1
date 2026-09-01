import type { HTMLAttributes } from 'react';
import { cn } from '@/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const paddingMap = { sm: 'p-3', md: 'p-4', lg: 'p-6' };

export function Card({
  className,
  interactive,
  padding = 'md',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-surface',
        paddingMap[padding],
        interactive &&
          'cursor-pointer transition-all hover:border-border hover:bg-surface-elevated active:scale-[0.99] focus-ring',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
