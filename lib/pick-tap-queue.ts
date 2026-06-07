import type { MutableRefObject } from "react";

function drainTapQueue(
  queueRef: MutableRefObject<Array<() => void>>,
  flushScheduledRef: MutableRefObject<boolean>,
): void {
  flushScheduledRef.current = false;
  const queue = queueRef.current.splice(0);
  for (const handler of queue) handler();
  if (queueRef.current.length > 0) {
    flushScheduledRef.current = true;
    queueMicrotask(() => drainTapQueue(queueRef, flushScheduledRef));
  }
}

/** Serialize pick taps that fire in the same frame (e.g. duplicate pointer/click). */
export function enqueuePickTap(
  queueRef: MutableRefObject<Array<() => void>>,
  flushScheduledRef: MutableRefObject<boolean>,
  handler: () => void,
): void {
  queueRef.current.push(handler);
  if (flushScheduledRef.current) return;
  flushScheduledRef.current = true;
  queueMicrotask(() => drainTapQueue(queueRef, flushScheduledRef));
}
