import { cn } from '@/utils';

const LOGO_SRC = '/assets/logo.png';

const sizeClasses = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
} as const;

export type LogoSize = keyof typeof sizeClasses;

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="Квартира — школа музыки и вокала"
      className={cn(sizeClasses[size], 'shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
