import { cn } from '@/utils';
import {
  MEDIA_IMAGE_GRID_GAP_CLASS,
  getMediaImageGridLayout,
} from '@/services/media/imageGrid';

export interface MediaImageGridItem {
  id: string;
  url?: string;
  alt?: string;
}

interface MediaImageGridProps {
  images: MediaImageGridItem[];
  onImageClick?: (image: MediaImageGridItem, index: number) => void;
  className?: string;
  /** Larger single-photo height (assignments / support). Default = chat VK size. */
  size?: 'chat' | 'page';
}

/**
 * VK-like photo block: 1 = large; 2+ = tiled grid without surface/brand fill behind tiles.
 */
export function MediaImageGrid({
  images,
  onImageClick,
  className,
  size = 'chat',
}: MediaImageGridProps) {
  if (!images.length) return null;

  const layout = getMediaImageGridLayout(images.length);
  const singleMaxH =
    size === 'page' ? 'max-h-[min(70vh,32rem)]' : 'max-h-[min(55vh,26rem)]';

  if (layout === 'single') {
    const img = images[0]!;
    return (
      <div className={cn('min-w-0 max-w-full', className)}>
        <MediaTile
          image={img}
          index={0}
          onImageClick={onImageClick}
          imgClassName={cn('w-full object-cover', singleMaxH)}
          buttonClassName="block w-full"
        />
      </div>
    );
  }

  if (layout === 'triple') {
    const [a, b, c] = images;
    return (
      <div
        className={cn(
          'grid min-w-0 max-w-full grid-cols-2 grid-rows-2',
          MEDIA_IMAGE_GRID_GAP_CLASS,
          size === 'chat' ? 'aspect-[4/5] max-h-[min(55vh,26rem)]' : 'aspect-[4/5] max-h-[min(70vh,32rem)]',
          className,
        )}
      >
        <MediaTile
          image={a!}
          index={0}
          onImageClick={onImageClick}
          buttonClassName="row-span-2 h-full min-h-0"
          imgClassName="h-full w-full object-cover"
        />
        <MediaTile
          image={b!}
          index={1}
          onImageClick={onImageClick}
          buttonClassName="h-full min-h-0"
          imgClassName="h-full w-full object-cover"
        />
        <MediaTile
          image={c!}
          index={2}
          onImageClick={onImageClick}
          buttonClassName="h-full min-h-0"
          imgClassName="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid min-w-0 max-w-full grid-cols-2',
        MEDIA_IMAGE_GRID_GAP_CLASS,
        className,
      )}
    >
      {images.map((img, i) => (
        <MediaTile
          key={img.id}
          image={img}
          index={i}
          onImageClick={onImageClick}
          buttonClassName="aspect-square min-h-0"
          imgClassName="h-full w-full object-cover"
        />
      ))}
    </div>
  );
}

function MediaTile({
  image,
  index,
  onImageClick,
  buttonClassName,
  imgClassName,
}: {
  image: MediaImageGridItem;
  index: number;
  onImageClick?: (image: MediaImageGridItem, index: number) => void;
  buttonClassName?: string;
  imgClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onImageClick?.(image, index)}
      className={cn('overflow-hidden focus-ring', buttonClassName)}
      aria-label="Открыть фото"
    >
      {image.url ? (
        <img src={image.url} alt={image.alt ?? ''} className={imgClassName} loading="lazy" />
      ) : (
        <div className="flex h-full min-h-24 w-full items-center justify-center">
          <span className="text-caption text-text-muted">Фото</span>
        </div>
      )}
    </button>
  );
}