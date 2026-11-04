import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { customerPointsVisibleAtom } from "src/state/map-symbology";
import { USelection } from "src/selection";
import { runZoneContentsQuery } from "src/lib/spatial-query/zone-contents";

type Source = "toolbar" | "context-menu";

export const useSelectZoneContents = () => {
  const userTracking = useUserTracking();
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const customerPointsVisible = useAtomValue(customerPointsVisibleAtom);

  return useCallback(
    async ({ source }: { source: Source }) => {
      const zoneIds = [...USelection.getZoneIds(selection)];
      try {
        const { assetIds, customerPointIds } = await runZoneContentsQuery(
          hydraulicModel,
          zoneIds,
          customerPointsVisible,
        );
        userTracking.capture({
          name: "zone.contentsSelected",
          source,
          zoneCount: zoneIds.length,
          count: assetIds.length + customerPointIds.length,
        });
        setSelection(USelection.fromIds(assetIds, customerPointIds));
      } catch (error) {
        captureError(error as Error);
      }
    },
    [
      selection,
      hydraulicModel,
      customerPointsVisible,
      userTracking,
      setSelection,
    ],
  );
};
