import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { zonesAtom } from "src/state/zones";

export const useOpenZonesImport = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const zones = useAtomValue(zonesAtom);
  const userTracking = useUserTracking();

  const openImportDialog = useCallback(() => {
    setDialogState({ type: "importZones" });
  }, [setDialogState]);

  const openZonesImport = useCallback(
    ({ source }: { source: string }) => {
      userTracking.capture({
        name: "importZones.started",
        source,
      });

      const hasExistingZones = zones.size > 0;

      if (hasExistingZones) {
        setDialogState({
          type: "importZonesWarning",
          onContinue: openImportDialog,
        });
      } else {
        openImportDialog();
      }
    },
    [setDialogState, zones, userTracking, openImportDialog],
  );

  return openZonesImport;
};
