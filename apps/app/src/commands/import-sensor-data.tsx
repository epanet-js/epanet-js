import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { sensorsAtom } from "src/state/sensor-data";
import { panelsAtom } from "src/state/panels";
import { splitsAtom } from "src/state/layout";
import type { Panel } from "src/panels/panel";
import { createSensorsPanel } from "src/panels/sensors/create-panel";
import { useActivatePanel } from "./activate-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";

export const useImportSensorData = () => {
  const previousSensors = useAtomValue(sensorsAtom);
  const setSensors = useSetAtom(sensorsAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const panels = useAtomValue(panelsAtom);
  const setPanels = useSetAtom(panelsAtom);
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();

  return useCallback(
    (
      sensors: ImportedSensor[],
      {
        skippedCount,
        hasTimingWarning,
        files,
      }: {
        skippedCount: number;
        hasTimingWarning: boolean;
        files?: {
          filesCount: number;
          zipCount: number;
          issueCodes: string[];
        };
      },
    ) => {
      setSensors(sensors);

      const existing = panels.find(isAllSensorsPanel);
      const panel = existing ?? createSensorsPanel();
      if (!existing) {
        setPanels((prev) => [...prev, panel]);
        userTracking.capture({
          name: "dataTables.opened",
          source: "auto",
          tables: ["sensors"],
        });
      }
      setSplits((splits) => ({ ...splits, bottomOpen: true }));
      activatePanel(panel.id);

      userTracking.capture({
        name: "sensorData.imported",
        sensorsCount: sensors.length,
        replacedCount: previousSensors.length,
        skippedCount,
        parameterCounts: countByParameter(sensors),
        hasTimingWarning,
        ...files,
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
    [
      previousSensors,
      setSensors,
      userTracking,
      translate,
      panels,
      setPanels,
      setSplits,
      activatePanel,
    ],
  );
};

const countByParameter = (sensors: ImportedSensor[]) => {
  const counts: Record<string, number> = {};
  for (const { parameter } of sensors) {
    counts[parameter] = (counts[parameter] ?? 0) + 1;
  }
  return counts;
};

const isAllSensorsPanel = (panel: Panel) =>
  panel.type === "sensors" && !panel.assetIds;
