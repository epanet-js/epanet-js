import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Run an async compute lazily and cache its result by input identity.
 *
 * - While `active` is false, the hook does not run the compute. The previously
 *   resolved `data` (if any) is preserved, so collapsing/expanding a section
 *   does not retrigger work.
 * - When `active` is true, the hook compares `args` against the inputs that
 *   produced the cached `data` (element-wise identity). If they match, no
 *   work runs. Otherwise it invokes `compute(...args)`, flips `isLoading`,
 *   and stores the resolved value.
 * - Stale resolutions (from a superseded compute) are discarded.
 *
 * Type parameters:
 * - `Args`: tuple of inputs that `compute` accepts.
 * - `T`: the type produced by `compute`.
 */
export function useAsyncCompute<Args extends readonly unknown[], T>(
  compute: (...args: Args) => Promise<T>,
  args: Args,
  active: boolean = true,
): { data: T | null; isLoading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Stabilize `args` reference by element-wise identity so reference
  // equality can be used as the cache key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableArgs = useMemo(() => args, args);
  const computedArgsRef = useRef<Args | null>(null);

  useEffect(() => {
    if (!active) return;
    if (computedArgsRef.current === stableArgs) return;

    let cancelled = false;
    setIsLoading(true);
    compute(...stableArgs).then(
      (result) => {
        if (cancelled) return;
        computedArgsRef.current = stableArgs;
        setData(result);
        setIsLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setIsLoading(false);
        // eslint-disable-next-line no-console
        console.error("useAsyncCompute failed:", err);
      },
    );
    return () => {
      cancelled = true;
    };
    // `compute` intentionally omitted: cache identity is driven by `stableArgs`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stableArgs]);

  return { data, isLoading };
}
