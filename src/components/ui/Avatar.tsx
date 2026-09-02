import { cn, getInitials } from '@/utils';
import { isDisplayableAvatarSrc } from '@/services/profile/constants';

interface AvatarProps {
  src?: string;
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' };

export function Avatar({ src, firstName, lastName, size = 'md', className }: AvatarProps) {
  const initials = getInitials(firstName, lastName);
  const photoSrc = isDisplayableAvatarSrc(src) ? src : undefined;
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-muted font-semibold text-brand',
        sizes[size],
        className,
      )}
      aria-label={`${firstName} ${lastName}`}
    >
      {photoSrc ? (
        <img src={photoSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  );
}
