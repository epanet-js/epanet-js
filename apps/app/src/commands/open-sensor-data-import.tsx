import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { sensorsAtom } from "src/state/sensor-data";
import { useUserTracking } from "src/infra/user-tracking";
import { usePermissions } from "src/hooks/use-permissions";
import { useStartUpgrade } from "src/hooks/use-paywall";

export const useOpenSensorDataImport = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const sensors = useAtomValue(sensorsAtom);
  const userTracking = useUserTracking();
  const { canImportSensorData } = usePermissions();
  const startUpgrade = useStartUpgrade();

  return useCallback(
    ({ source }: { source: string }) => {
      if (!canImportSensorData) {
        startUpgrade("sensorData");
        return;
      }

      userTracking.capture({ name: "sensorData.importStarted", source });

      const openImportDialog = () =>
        setDialogState({ type: "importSensorData" });

      if (sensors.length > 0) {
        setDialogState({
          type: "importSensorDataWarning",
          onContinue: openImportDialog,
        });
      } else {
        openImportDialog();
      }
    },
    [setDialogState, sensors, userTracking, canImportSensorData, startUpgrade],
  );
};
