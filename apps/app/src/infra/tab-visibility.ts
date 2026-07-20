// Synchronous tab-visibility tracking. Browsers throttle timers and pause
// rendering in background tabs, so any async measurement that spans a hidden
// period is deferred and unreliable — callers use this to skip reporting it.

// Timestamp of when the tab was last hidden. Set synchronously by the DOM
// listener so it's up-to-date before any async continuation runs.
export let lastHiddenAt: number | null = null;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lastHiddenAt = performance.now();
  });
}

// True if the tab is hidden now, or was hidden at any point since `startedAt` —
// i.e. an operation that started at `startedAt` may have been suspended.
export const wasSuspendedSince = (startedAt: number): boolean =>
  (typeof document !== "undefined" && document.hidden) ||
  (lastHiddenAt !== null && lastHiddenAt > startedAt);
