'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Call `handler` when the user clicks outside `ref` or presses Escape,
 * but only while `enabled` is true (e.g. a panel is open).
 *
 * `mousedown` is used rather than `click` so a click that starts inside an
 * option and ends outside still counts as "inside", and so the handler runs
 * before a focused control's own click logic.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return undefined;

    function onPointerDown(event: MouseEvent): void {
      const node = ref.current;
      if (node !== null && event.target instanceof Node && !node.contains(event.target)) {
        handler();
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        handler();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, handler, enabled]);
}
