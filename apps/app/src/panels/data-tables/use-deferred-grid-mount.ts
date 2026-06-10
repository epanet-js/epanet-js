import { useEffect, useState } from "react";

// Building the TanStack row model is synchronous and, for large tables, blocks
// the main thread. In the model-object (FLAG_DATA_TABLES_PERFORMANCE) path the
// rows are available immediately, so without this the whole build runs in the
// same commit as a data-table tab switch and freezes the UI. Deferring the
// first grid render by a frame lets the tab switch paint first (a spinner shows
// meanwhile), matching the legacy path's async-build behaviour.
//
// When disabled (legacy path) it returns ready immediately, so the legacy
// spinner/async-build timing is unchanged.
export function useDeferredGridMount(enabled: boolean): boolean {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (ready) return;
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return ready;
}
