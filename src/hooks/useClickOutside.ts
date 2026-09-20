/**
 * useClickOutside
 * Reusable outside-click + Escape + focus-trap handling for floating overlays.
 *
 * Attach the returned ref to a wrapper that contains BOTH the trigger and the
 * dropdown. While `open` is true:
 *  - A pointer press outside the wrapper closes the overlay (via onClose).
 *  - Escape closes the overlay and returns focus to the trigger element.
 *  - Tab focus is trapped inside the wrapper so keyboard users stay in context.
 * Listeners are attached only while open and are removed on unmount.
 */
import { useEffect, useRef, type RefObject } from 'react';

interface UseClickOutsideOptions {
  open: boolean;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}

export const useClickOutside = <T extends HTMLElement = HTMLDivElement>(
  options: UseClickOutsideOptions
): RefObject<T | null> => {
  const { open, onClose, returnFocusTo } = options;
  const ref = useRef<T | null>(null);

  // Keep the latest onClose without re-binding the listeners on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const root = ref.current;
      if (!root) return;
      const target = event.target as Node | null;
      // Ignore interactions originating inside the wrapper (trigger + dropdown).
      if (target && root.contains(target)) return;
      onCloseRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        returnFocusTo?.current?.focus();
      }
    };

    // Trap Tab focus inside the wrapper while the overlay is open.
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!root.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleTab);
    };
  }, [open, returnFocusTo]);

  return ref;
};
