import { useMemo } from "react";
import { listConverters, type RegisteredConverter } from "src/lib/converters";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useAvailableConverters = (): RegisteredConverter[] => {
  const isSynergiOn = useFeatureFlag("FLAG_SYNERGI");

  return useMemo(() => (isSynergiOn ? listConverters() : []), [isSynergiOn]);
};
