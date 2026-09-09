import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { defaultPanels } from "./default-panels";
import type { Panel } from "./panel";

// The dock starts empty under partial data tables and the user picks what to
// open. The flag cannot be read where `panelsAtom` is seeded, so it is resolved
// here and the seed is handed to `resetAppState`.
export const useDefaultPanels = () => {
  const partialDataTables = useFeatureFlag("FLAG_PARTIAL_DATA_TABLES");

  return useCallback(
    (): Panel[] => (partialDataTables ? [] : defaultPanels()),
    [partialDataTables],
  );
};
