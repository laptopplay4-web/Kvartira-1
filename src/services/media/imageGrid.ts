/**
 * VK-style photo grid layout helpers for chat / assignments / support.
 * Single photo -> large; 2+ -> compact tiled block with hairline gaps.
 */

export type MediaImageGridLayout = 'single' | 'pair' | 'triple' | 'quad' | 'many';

export function getMediaImageGridLayout(count: number): MediaImageGridLayout {
  if (count <= 0) return 'single';
  if (count === 1) return 'single';
  if (count === 2) return 'pair';
  if (count === 3) return 'triple';
  if (count === 4) return 'quad';
  return 'many';
}

/** Tailwind gap between tiles — VK uses ~2px. */
export const MEDIA_IMAGE_GRID_GAP_CLASS = 'gap-0.5';