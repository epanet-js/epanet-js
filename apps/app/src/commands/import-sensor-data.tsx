import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { sensorsAtom } from "src/state/sensor-data";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";

export const useImportSensorData = () => {
  const setSensors = useSetAtom(sensorsAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return useCallback(
    (
      sensors: ImportedSensor[],
      {
        skippedCount,
        hasTimingWarning,
      }: { skippedCount: number; hasTimingWarning: boolean },
    ) => {
      setSensors(sensors);

      userTracking.capture({
        name: "sensorData.imported",
        sensorsCount: sensors.length,
        skippedCount,
        parameterCounts: countByParameter(sensors),
        hasTimingWarning,
      });

      notify({
        variant: "success",
        title: translate("sensorData.import.toast.title"),
        description:
          skippedCount > 0
            ? translate(
                "sensorData.import.toast.importedAndSkipped",
                sensors.length,
                String(skippedCount),
              )
            : translate("sensorData.import.toast.imported", sensors.length),
        Icon: SuccessIcon,
        duration: 3000,
      });
    },
    [setSensors, userTracking, translate],
  );
};

const countByParameter = (sensors: ImportedSensor[]) => {
  const counts: Record<string, number> = {};
  for (const { parameter } of sensors) {
    counts[parameter] = (counts[parameter] ?? 0) + 1;
  }
  return counts;
};
