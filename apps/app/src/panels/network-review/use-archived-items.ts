import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "src/lib/network-review";

export type ArchivableCheck =
  | CheckType.proximityAnomalies
  | CheckType.crossingPipes;
import { archivedNetworkReviewItemsAtom } from "src/state/network-review";

// Items a user has judged acceptable. Kept for the session and cleared when a
// new model loads, via resetAppState.
export const useArchivedItems = (checkType: ArchivableCheck) => {
  const [archivedItems, setArchivedItems] = useAtom(
    archivedNetworkReviewItemsAtom,
  );
  const userTracking = useUserTracking();

  const ids = archivedItems[checkType];
  const archivedIds = useMemo(() => new Set(ids ?? []), [ids]);

  const isArchived = useCallback(
    (itemId: string) => archivedIds.has(itemId),
    [archivedIds],
  );

  const onArchive = useCallback(
    (itemId: string) => {
      setArchivedItems((previous) => {
        const current = previous[checkType] ?? [];
        if (current.includes(itemId)) return previous;

        return { ...previous, [checkType]: [...current, itemId] };
      });

      userTracking.capture({
        name: `networkReview.${checkType}.archived`,
      });
    },
    [checkType, setArchivedItems, userTracking],
  );

  const onRestore = useCallback(
    (itemId: string) => {
      setArchivedItems((previous) => {
        const current = previous[checkType] ?? [];
        if (!current.includes(itemId)) return previous;

        return {
          ...previous,
          [checkType]: current.filter((id) => id !== itemId),
        };
      });

      userTracking.capture({
        name: `networkReview.${checkType}.restored`,
      });
    },
    [checkType, setArchivedItems, userTracking],
  );

  return useMemo(
    () => ({ isArchived, onArchive, onRestore }),
    [isArchived, onArchive, onRestore],
  );
};
