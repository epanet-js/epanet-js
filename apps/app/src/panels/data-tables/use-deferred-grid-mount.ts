import { useEffect, useState } from "react";

export function useDeferredGridMount(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return ready;
}
