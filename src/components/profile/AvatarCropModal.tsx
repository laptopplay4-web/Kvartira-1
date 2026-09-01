import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';

import {
  clampCropState,
  cropImageToDataUrl,
  getCropZoomBounds,
  getInitialCropState,
  zoomCropAtPoint,
  type AvatarCropState,
} from '@/services/profile/avatar';

interface AvatarCropModalProps {
  open: boolean;
  image: HTMLImageElement | null;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
  applying?: boolean;
}

interface PointerPoint {
  x: number;
  y: number;
}

function getViewportSize() {
  if (typeof window === 'undefined') return 300;
  return Math.min(window.innerWidth - 48, 320);
}

function getDistance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCenter(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function AvatarCropModal({
  open,
  image,
  onClose,
  onApply,
  applying,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<AvatarCropState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(
    null,
  );
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const [cropHole, setCropHole] = useState({ cx: 0, cy: 0, r: 0 });

  const syncCropHole = useCallback(() => {
    const el = cropAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCropHole({
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      r: rect.width / 2,
    });
  }, []);

  const zoomBounds = useMemo(() => {
    if (!image) return null;
    return getCropZoomBounds(image.naturalWidth, image.naturalHeight, viewportSize);
  }, [image, viewportSize]);

  useLayoutEffect(() => {
    if (!open) return;
    setViewportSize(getViewportSize());
    const onResize = () => setViewportSize(getViewportSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && !applying && onClose();
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose, applying]);

  useEffect(() => {
    if (!open || !image) {
      setCrop(null);
      setPreviewUrl(null);
      pointersRef.current.clear();
      dragRef.current = null;
      pinchRef.current = null;
      return;
    }
    const initial = getInitialCropState(image.naturalWidth, image.naturalHeight, viewportSize);
    setCrop(initial);
    setPreviewUrl(cropImageToDataUrl(image, initial, viewportSize));
  }, [open, image, viewportSize]);

  useLayoutEffect(() => {
    if (!open || !image || !crop) {
      setCropHole({ cx: 0, cy: 0, r: 0 });
      return;
    }
    syncCropHole();
    window.addEventListener('resize', syncCropHole);
    return () => window.removeEventListener('resize', syncCropHole);
  }, [open, image, crop, viewportSize, syncCropHole]);

  const updateCrop = useCallback(
    (next: AvatarCropState) => {
      if (!image) return;
      const clamped = clampCropState(next, image.naturalWidth, image.naturalHeight, viewportSize);
      setCrop(clamped);
      setPreviewUrl(cropImageToDataUrl(image, clamped, viewportSize));
    },
    [image, viewportSize],
  );

  const getLocalPoint = (event: React.PointerEvent<HTMLDivElement>): PointerPoint => {
    const rect = cropAreaRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handleZoom = useCallback(
    (value: number, focalX = viewportSize / 2, focalY = viewportSize / 2) => {
      if (!crop || !zoomBounds) return;
      const nextScale = Math.min(zoomBounds.maxScale, Math.max(zoomBounds.minScale, value));
      updateCrop(zoomCropAtPoint(crop, nextScale, focalX, focalY));
    },
    [crop, updateCrop, viewportSize, zoomBounds],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!crop || applying) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, getLocalPoint(event));

    if (pointersRef.current.size === 2) {
      const points = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: getDistance(points[0]!, points[1]!),
        scale: crop.scale,
      };
      dragRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      pinchRef.current = null;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: crop.offsetX,
        offsetY: crop.offsetY,
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!crop || !pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, getLocalPoint(event));

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = [...pointersRef.current.values()];
      const distance = getDistance(points[0]!, points[1]!);
      const center = getCenter(points[0]!, points[1]!);
      const nextScale = pinchRef.current.scale * (distance / pinchRef.current.distance);
      handleZoom(nextScale, center.x, center.y);
      return;
    }

    if (pointersRef.current.size === 1 && dragRef.current) {
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      updateCrop({
        ...crop,
        offsetX: dragRef.current.offsetX + dx,
        offsetY: dragRef.current.offsetY + dy,
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.entries()][0];
      if (remaining && crop) {
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          offsetX: crop.offsetX,
          offsetY: crop.offsetY,
        };
      }
    } else {
      dragRef.current = null;
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!crop || !zoomBounds || !cropAreaRef.current) return;
    event.preventDefault();
    const rect = cropAreaRef.current.getBoundingClientRect();
    const focalX = event.clientX - rect.left;
    const focalY = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? -zoomBounds.minScale * 0.08 : zoomBounds.minScale * 0.08;
    handleZoom(crop.scale + delta, focalX, focalY);
  };

  if (!open) return null;

  const screenMask =
    cropHole.r > 0
      ? `radial-gradient(circle ${cropHole.r}px at ${cropHole.cx}px ${cropHole.cy}px, transparent ${cropHole.r - 1}px, black ${cropHole.r}px)`
      : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0a0a]" role="dialog" aria-modal aria-label="Кадрирование фото">
      {screenMask && (
        <div
          className="pointer-events-none fixed inset-0 z-[65] bg-black/70"
          style={{
            WebkitMaskImage: screenMask,
            maskImage: screenMask,
          }}
          aria-hidden
        />
      )}

      <header className="relative z-[70] flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          disabled={applying}
          className="min-h-11 min-w-11 rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
        >
          Отмена
        </button>
        <span className="text-sm font-semibold text-text-primary">Фото профиля</span>
        <button
          type="button"
          onClick={() => previewUrl && onApply(previewUrl)}
          disabled={!previewUrl || applying}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-semibold text-brand transition-colors hover:text-brand-hover disabled:opacity-50"
        >
          {applying ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Сохранение" /> : 'Готово'}
        </button>
      </header>

      <div className="relative z-[60] flex flex-1 flex-col items-center justify-center px-6 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {image && crop && zoomBounds ? (
          <>
            <p className="relative z-[70] mb-4 text-center text-caption text-text-muted">
              Сведите или разведите пальцы для масштаба
            </p>
            <div
              ref={cropAreaRef}
              className="relative touch-none select-none overflow-hidden rounded-full ring-2 ring-white/90 ring-offset-2 ring-offset-[#0a0a0a]"
              style={{ width: viewportSize, height: viewportSize, touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              role="img"
              aria-label="Перетащите и масштабируйте фото"
            >
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: image.naturalWidth * crop.scale,
                  height: image.naturalHeight * crop.scale,
                  transform: `translate(${crop.offsetX}px, ${crop.offsetY}px)`,
                }}
              />
            </div>
          </>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-brand" aria-label="Загрузка" />
        )}
      </div>
    </div>
  );
}
