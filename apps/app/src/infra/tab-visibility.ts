// Synchronous tracking of periods when the page wasn't being painted. Browsers
// throttle timers and pause rendering when a tab is hidden, minimized, or
// occluded, so any async measurement that spans such a period is deferred and unreliable

// Timestamp of when the tab was last hidden. Set synchronously by the DOM
// listener so it's up-to-date before any async continuation runs.
export let lastHiddenAt: number | null = null;

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) lastHiddenAt = performance.now();
  });
}

// requestAnimationFrame is the browser's "am I actually being painted?" signal:
// the frame callback stops firing whenever the page isn't rendered — hidden,
// minimized, or occluded.

// A gap between frames longer than this means painting stopped, not just a slow
// frame (a rendering page paints roughly every 16ms).
const MAX_FRAME_GAP_MS = 1000;

let lastFrameAt = typeof performance !== "undefined" ? performance.now() : 0;
let lastPaintResumedAt: number | null = null;

if (typeof requestAnimationFrame !== "undefined") {
  const tick = () => {
    const now = performance.now();
    if (now - lastFrameAt > MAX_FRAME_GAP_MS) lastPaintResumedAt = now;
    lastFrameAt = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// True if painting was interrupted at any point since `startedAt` — i.e. an
// operation that started at `startedAt` may have been deferred by the browser
// pausing rendering. Covers the tab being hidden, and the window being occluded
// (another Space) where visibilitychange never fires but rAF still stalls.
export const wasSuspendedSince = (startedAt: number): boolean =>
  (typeof document !== "undefined" && document.hidden) ||
  (lastHiddenAt !== null && lastHiddenAt > startedAt) ||
  performance.now() - lastFrameAt > MAX_FRAME_GAP_MS ||
  (lastPaintResumedAt !== null && lastPaintResumedAt > startedAt);
