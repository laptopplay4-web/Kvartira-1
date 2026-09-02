import { Card } from '@/components/ui/Card';
import { useImageTextContrast } from '@/hooks/useImageTextContrast';
import { cn } from '@/utils';

interface HomeEventCardProps {
  title: string;
  subtitle: string;
  imageUrl?: string;
  interactive?: boolean;
}

export function HomeEventCard({
  title,
  subtitle,
  imageUrl,
  interactive = true,
}: HomeEventCardProps) {
  const contrast = useImageTextContrast(imageUrl);
  const isOnDark = contrast === 'on-dark';

  if (!imageUrl) {
    return (
      <Card interactive={interactive}>
        <p className="text-h3">{title}</p>
        <p className="mt-1 text-body-sm text-text-secondary">{subtitle}</p>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        'relative min-h-36 overflow-hidden rounded-xl border border-border-subtle',
        interactive &&
          'cursor-pointer transition-all hover:border-border active:scale-[0.99] focus-ring',
      )}
    >
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className={cn(
          'absolute inset-0',
          isOnDark
            ? 'bg-gradient-to-t from-black/80 via-black/45 to-black/10'
            : 'bg-gradient-to-t from-white/95 via-white/55 to-white/15',
        )}
      />
      <div className="relative flex min-h-36 flex-col justify-end p-4">
        <p
          className={cn(
            'text-h3 drop-shadow-sm',
            isOnDark ? 'text-white' : 'text-text-primary',
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            'mt-1 text-body-sm drop-shadow-sm',
            isOnDark ? 'text-white/85' : 'text-text-secondary',
          )}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
