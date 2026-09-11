import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils';

/* eslint-disable-next-line react-refresh/only-export-components -- shared with IconButton-style consumers */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    'transition-[transform,background-color,box-shadow,opacity,color] duration-[var(--duration-fast)]',
    'focus-ring disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.97]',
    'relative overflow-hidden',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-contrast shadow-sm hover:bg-brand-hover',
        secondary:
          'border border-border bg-surface-elevated text-text-primary hover:bg-surface-hover',
        tonal: 'bg-brand-muted text-brand hover:bg-brand/20',
        ghost: 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        destructive: 'border border-danger/30 bg-danger-muted text-danger hover:bg-danger/20',
      },
      size: {
        xs: 'h-8 gap-1.5 px-2.5 text-xs',
        sm: 'h-9 gap-1.5 px-3 text-sm',
        md: 'h-11 gap-2 px-5 text-sm',
        lg: 'h-13 gap-2 px-6 text-base',
        icon: 'h-11 w-11 p-0',
        'icon-sm': 'h-9 w-9 p-0',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, fullWidth, loading, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
