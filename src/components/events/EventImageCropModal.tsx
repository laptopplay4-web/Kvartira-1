import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  clampEventCropState,
  cropEventImageToDataUrl,
  getEventCropViewportSize,
  getEventCropZoomBounds,
  getInitialEventCropState,
  zoomEventCropAtPoint,
  type EventImageCropState,
} from '@/services/events/imageCrop';

interface EventImageCropModalProps {
  open: boolean;
  image: HTMLImageElement | null;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}

interface PointerPoint {
  x: number;
  y: number;
}

interface CropHole {
  left: number;
  top: number;
  width: number;
  height: number;
}

function getDistance(a: PointerPoint, b: PointerPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCenter(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function EventImageCropModal({
  open,
  image,
  onClose,
  onApply,
}: EventImageCropModalProps) {
  const [crop, setCrop] = useState<EventImageCropState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewport, setViewport] = useState(getEventCropViewportSize);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(
    null,
  );
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const [cropHole, setCropHole] = useState<CropHole>({ left: 0, top: 0, width: 0, height: 0 });

  const syncCropHole = useCallback(() => {
    const el = cropAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCropHole({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const zoomBounds = useMemo(() => {
    if (!image) return null;
    return getEventCropZoomBounds(
      image.naturalWidth,
      image.naturalHeight,
      viewport.width,
      viewport.height,
    );
  }, [image, viewport.height, viewport.width]);

  useLayoutEffect(() => {
    if (!open) return;
    setViewport(getEventCropViewportSize());
    const onResize = () => setViewport(getEventCropViewportSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', handler, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !image) {
      setCrop(null);
      setPreviewUrl(null);
      pointersRef.current.clear();
      dragRef.current = null;
      pinchRef.current = null;
      return;
    }
    const initial = getInitialEventCropState(
      image.naturalWidth,
      image.naturalHeight,
      viewport.width,
      viewport.height,
    );
    setCrop(initial);
    setPreviewUrl(
      cropEventImageToDataUrl(image, initial, viewport.width, viewport.height),
    );
  }, [open, image, viewport.height, viewport.width]);

  useLayoutEffect(() => {
    if (!open || !image || !crop) {
      setCropHole({ left: 0, top: 0, width: 0, height: 0 });
      return;
    }
    syncCropHole();
    window.addEventListener('resize', syncCropHole);
    return () => window.removeEventListener('resize', syncCropHole);
  }, [open, image, crop, viewport, syncCropHole]);

  const updateCrop = useCallback(
    (next: EventImageCropState) => {
      if (!image) return;
      const clamped = clampEventCropState(
        next,
        image.naturalWidth,
        image.naturalHeight,
        viewport.width,
        viewport.height,
      );
      setCrop(clamped);
      setPreviewUrl(
        cropEventImageToDataUrl(image, clamped, viewport.width, viewport.height),
      );
    },
    [image, viewport.height, viewport.width],
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
    (value: number, focalX = viewport.width / 2, focalY = viewport.height / 2) => {
      if (!crop || !zoomBounds) return;
      const nextScale = Math.min(zoomBounds.maxScale, Math.max(zoomBounds.minScale, value));
      updateCrop(zoomEventCropAtPoint(crop, nextScale, focalX, focalY));
    },
    [crop, updateCrop, viewport.height, viewport.width, zoomBounds],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
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

    if (pointersRef.current.size === 1 && crop) {
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        offsetX: crop.offsetX,
        offsetY: crop.offsetY,
      };
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

  if (!open || typeof document === 'undefined') return null;

  const hasHole = cropHole.width > 0 && cropHole.height > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-lightbox flex flex-col bg-black"
      role="dialog"
      aria-modal
      aria-label="Выбор миниатюры"
    >
      {hasHole && (
        <>
          <div
            className="pointer-events-none fixed left-0 right-0 top-0 z-[1] bg-black/75"
            style={{ height: Math.max(0, cropHole.top) }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1] bg-black/75"
            style={{
              height: Math.max(0, window.innerHeight - cropHole.top - cropHole.height),
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed left-0 z-[1] bg-black/75"
            style={{
              top: cropHole.top,
              width: Math.max(0, cropHole.left),
              height: cropHole.height,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed right-0 z-[1] bg-black/75"
            style={{
              top: cropHole.top,
              width: Math.max(0, window.innerWidth - cropHole.left - cropHole.width),
              height: cropHole.height,
            }}
            aria-hidden
          />
        </>
      )}

      <header className="relative z-[2] flex shrink-0 items-center justify-between px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
        >
          Отмена
        </Button>
        <span className="text-sm font-semibold text-white">Выбор миниатюры</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => previewUrl && onApply(previewUrl)}
          disabled={!previewUrl}
          className="min-h-11 min-w-11 font-semibold text-sky-400 hover:bg-white/10 hover:text-sky-300"
        >
          Готово
        </Button>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center px-4">
        {image && crop && zoomBounds ? (
          <div
            ref={cropAreaRef}
            className="relative touch-none select-none overflow-visible rounded-lg"
            style={{
              width: viewport.width,
              height: viewport.height,
              touchAction: 'none',
            }}
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
            <div
              className="pointer-events-none absolute inset-0 rounded-lg ring-[1.5px] ring-white/90"
              aria-hidden
            />
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-label="Загрузка" />
        )}
      </div>

      <footer className="relative z-[2] shrink-0 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <p className="text-center text-caption text-white/55">
          Перемещайте и масштабируйте фото внутри рамки 16:9
        </p>
      </footer>
    </div>,
    document.body,
  );
}
