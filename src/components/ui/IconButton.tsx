import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils';

const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center rounded-xl',
    'transition-[transform,background-color,color,opacity] duration-[var(--duration-fast)]',
    'focus-ring disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.97]',
  ].join(' '),
  {
    variants: {
      variant: {
        ghost: 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        secondary:
          'border border-border bg-surface-elevated text-text-primary hover:bg-surface-hover',
        tonal: 'bg-brand-muted text-brand hover:bg-brand/20',
        destructive: 'bg-danger-muted text-danger hover:bg-danger/20',
      },
      size: {
        sm: 'h-9 w-9',
        md: 'h-11 w-11',
        lg: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  label: string;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, label, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled || loading}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';
