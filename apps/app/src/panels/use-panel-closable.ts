import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { PlacedPanel } from "src/state/panels";

export const useIsPanelClosable = () => {
  const partialDataTables = useFeatureFlag("FLAG_PARTIAL_DATA_TABLES");

  return useCallback(
    (panel: Pick<PlacedPanel, "closable">) =>
      panel.closable || partialDataTables,
    [partialDataTables],
  );
};
