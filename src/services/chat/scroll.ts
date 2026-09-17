/** Near-bottom threshold for chat “stick” / new-message indicator (px). */
export const CHAT_NEAR_BOTTOM_PX = 80;

export function getDistanceFromBottom(
  el: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight;
}

export function isNearBottom(
  el: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  threshold = CHAT_NEAR_BOTTOM_PX,
): boolean {
  return getDistanceFromBottom(el) <= threshold;
}

/**
 * Pin a scroll container to the end. Prefer direct scrollTop over scrollIntoView —
 * the latter can miss flex layouts that finalize height after the first paint.
 */
export function scrollElementToBottom(
  el: HTMLElement,
  behavior: ScrollBehavior = 'instant',
): void {
  if (behavior === 'smooth') {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    return;
  }
  el.scrollTop = el.scrollHeight;
}
