import { useLayoutEffect, useRef } from 'react';

/**
 * FLIP reorder for chat list rows — smooth rise when a conversation bumps to top.
 * Uses WAAPI; no-op when reduced motion is preferred.
 */
export function useConversationListFlip(orderKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTopsRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const items = root.querySelectorAll<HTMLElement>('[data-flip-id]');
    const nextTops = new Map<string, number>();

    items.forEach((el) => {
      const id = el.dataset.flipId;
      if (!id) return;
      const top = el.getBoundingClientRect().top;
      nextTops.set(id, top);
      if (reduceMotion) return;
      const prev = prevTopsRef.current.get(id);
      if (prev == null) return;
      const dy = prev - top;
      if (Math.abs(dy) < 2) return;
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
        { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    });

    prevTopsRef.current = nextTops;
  }, [orderKey]);

  return containerRef;
}
