import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { getDecimals } from "@epanet-js/project-settings";
import { QuickGraphChart, type QuickGraphSeries } from "src/components/graphs";
import { useStatusValueLabels } from "src/hooks/use-status-value-labels";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import {
  QUICK_GRAPH_PROPERTIES,
  seriesTimeRange,
  sensorReadingsStyle,
} from "src/lib/asset-graph";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";
import { assetsDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";

export const SensorPreviewGraph = ({ sensor }: { sensor: ImportedSensor }) => {
  const assets = useAtomValue(assetsDerivedAtom);
  const { formatting, units } = useAtomValue(projectSettingsAtom);
  const translateUnit = useTranslateUnit();
  const assetType = assets.get(sensor.assetId)?.type ?? "junction";
  const isStatus = sensor.parameter === "status";
  const valueLabels = useStatusValueLabels(assetType, isStatus);

  const quantityKey = isStatus
    ? undefined
    : QUICK_GRAPH_PROPERTIES[assetType].find(
        ({ value }) => value === sensor.parameter,
      )?.quantityKey;
  const decimals = quantityKey ? getDecimals(formatting, quantityKey) : 0;
  const unit = quantityKey ? units[quantityKey] : null;

  const series = useMemo<QuickGraphSeries[]>(
    () => [
      {
        label: null,
        values: sensor.readings,
        times: sensor.times,
        style: sensorReadingsStyle(sensor.readings.length),
      },
    ],
    [sensor],
  );
  const timeRange = useMemo(() => seriesTimeRange(series), [series]);

  return (
    <section className="flex flex-col gap-2 flex-1 basis-0 min-h-0">
      <h3 className="text-size-base font-semibold truncate">
        {sensor.name}
        {unit && (
          <span className="font-normal text-subtle">
            {" "}
            ({translateUnit(unit)})
          </span>
        )}
      </h3>
      <div className="relative flex-1 min-h-0">
        <QuickGraphChart
          series={series}
          timeRange={timeRange}
          decimals={decimals}
          valueLabels={valueLabels}
        />
      </div>
    </section>
  );
};
