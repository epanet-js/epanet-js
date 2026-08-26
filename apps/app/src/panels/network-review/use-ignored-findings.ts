import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "src/lib/network-review";

export type IgnorableCheck =
  | CheckType.proximityAnomalies
  | CheckType.crossingPipes;
import { ignoredFindingsAtom } from "src/state/network-review";

// Findings a user has judged acceptable. Kept for the session and cleared when a
// new model loads, via resetAppState.
export const useIgnoredFindings = (checkType: IgnorableCheck) => {
  const [ignoredFindings, setIgnoredFindings] = useAtom(ignoredFindingsAtom);
  const userTracking = useUserTracking();

  const ids = ignoredFindings[checkType];
  const ignoredIds = useMemo(() => new Set(ids ?? []), [ids]);

  const isIgnored = useCallback(
    (findingId: string) => ignoredIds.has(findingId),
    [ignoredIds],
  );

  const onIgnore = useCallback(
    (findingId: string) => {
      setIgnoredFindings((previous) => {
        const current = previous[checkType] ?? [];
        if (current.includes(findingId)) return previous;

        return { ...previous, [checkType]: [...current, findingId] };
      });

      userTracking.capture({
        name: `networkReview.${checkType}.ignored`,
      });
    },
    [checkType, setIgnoredFindings, userTracking],
  );

  const onRestore = useCallback(
    (findingId: string) => {
      setIgnoredFindings((previous) => {
        const current = previous[checkType] ?? [];
        if (!current.includes(findingId)) return previous;

        return {
          ...previous,
          [checkType]: current.filter((id) => id !== findingId),
        };
      });

      userTracking.capture({
        name: `networkReview.${checkType}.restored`,
      });
    },
    [checkType, setIgnoredFindings, userTracking],
  );

  return useMemo(
    () => ({ isIgnored, onIgnore, onRestore }),
    [isIgnored, onIgnore, onRestore],
  );
};
