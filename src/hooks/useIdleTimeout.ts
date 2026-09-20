import { useEffect, useRef } from 'react';

/**
 * Idle-timeout enforcement for the org security policy's
 * `sessionTimeoutMinutes`. Without this the setting was pure theatre: the value
 * was editable on SETUPS → Admin → Security, but nothing ever signed anyone out.
 *
 * Design notes:
 *  - Activity is recorded into a ref and a single interval does the comparing,
 *    so a busy user costs one timestamp write per event rather than a timer
 *    teardown/rebuild.
 *  - The last-activity stamp is shared through localStorage so that work in a
 *    second tab counts as activity in this one; otherwise a user reading a long
 *    report in another tab would be logged out mid-task.
 *  - Time is compared against the wall clock rather than accumulated ticks, so
 *    a laptop that was asleep past the timeout is signed out on wake instead of
 *    resuming as though no time had passed.
 *
 * `timeoutMinutes <= 0` disables the timeout entirely (the policy's documented
 * meaning of 0).
 */

const ACTIVITY_KEY = 'ss.lastActivityAt';
const CHECK_INTERVAL_MS = 15_000;
/** Coalesce bursts of events (scroll, mousemove) into one write per second. */
const WRITE_THROTTLE_MS = 1_000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel', 'focus',
];

const readSharedStamp = (): number => {
  try {
    const raw = window.localStorage.getItem(ACTIVITY_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const writeSharedStamp = (at: number): void => {
  try {
    window.localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // Private-browsing or a full quota: in-memory tracking still works, only
    // the cross-tab sharing is lost. Not worth failing over.
  }
};

export function useIdleTimeout(
  timeoutMinutes: number,
  onIdle: () => void,
  enabled = true,
): void {
  // Held in a ref so changing the callback identity each render does not
  // re-register listeners.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    firedRef.current = false;

    const now = Date.now();
    // Adopt another tab's more recent activity, but never a future timestamp
    // (a clock change could otherwise postpone the timeout indefinitely).
    const shared = readSharedStamp();
    lastActivityRef.current = shared > now ? now : Math.max(now, shared);
    writeSharedStamp(lastActivityRef.current);

    const recordActivity = () => {
      const at = Date.now();
      lastActivityRef.current = at;
      if (at - lastWriteRef.current >= WRITE_THROTTLE_MS) {
        lastWriteRef.current = at;
        writeSharedStamp(at);
      }
    };

    const onVisibility = () => {
      // Returning to the tab is activity; leaving it is not.
      if (document.visibilityState === 'visible') recordActivity();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return;
      const at = Number(e.newValue);
      if (Number.isFinite(at) && at > lastActivityRef.current && at <= Date.now()) {
        lastActivityRef.current = at;
      }
    };

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, recordActivity, { passive: true, capture: true }),
    );
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    const interval = window.setInterval(() => {
      if (firedRef.current) return;
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= timeoutMs) {
        firedRef.current = true;
        onIdleRef.current();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, recordActivity, { capture: true }),
      );
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [timeoutMinutes, enabled]);
}
