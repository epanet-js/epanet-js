import { useMemo } from "react";
import { listConverters, type RegisteredConverter } from "src/lib/converters";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePermissions } from "src/hooks/use-permissions";

export const useAvailableConverters = (): RegisteredConverter[] => {
  const isSynergiOn = useFeatureFlag("FLAG_SYNERGI");
  const { canImportSynergi } = usePermissions();
  const isEnabled = isSynergiOn && canImportSynergi;

  return useMemo(() => (isEnabled ? listConverters() : []), [isEnabled]);
};
