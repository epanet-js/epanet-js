import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { defaultDataTablePanels } from "./data-tables/create-panel";
import { createNetworkReviewPanel } from "./network-review/create-panel";
import type { Panel } from "./panel";

export const defaultDataTables = (): Panel[] => [...defaultDataTablePanels()];

export const useDefaultPanels = () => {
  const partialDataTables = useFeatureFlag("FLAG_PARTIAL_DATA_TABLES");

  return useCallback(
    (): Panel[] => [
      ...(partialDataTables ? [] : defaultDataTables()),
      createNetworkReviewPanel(),
    ],
    [partialDataTables],
  );
};
