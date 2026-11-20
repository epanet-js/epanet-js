import { useMemo } from "react";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { localizeDecimal } from "@epanet-js/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { useSensorParameterLabel } from "src/hooks/use-sensor-parameter-label";
import { groupErrors, type ImportOutcome } from "src/components/import-outcome";
import { assetsDerivedAtom } from "src/state/derived-branch-state";
import type { ImportError } from "src/lib/operational-data-io/import-result";
import type { ParseSensorDataResult } from "src/lib/sensor-data/parse-sensor-data-file";

export const MAX_PREVIEW_ROWS = 15;

export const SENSOR_DATA_IMPORT_KEYS = "sensorData.import";

const HEADER_CELL =
  "sticky top-0 h-9 bg-panel text-left px-3 py-2 font-medium text-subtle truncate";

const BODY_CELL = "px-3 py-1.5 text-default truncate";

export const useSensorImportOutcome = (
  result: ParseSensorDataResult | null,
  timingWarnings: ImportError[],
): ImportOutcome | null => {
  const translate = useTranslate();
  return useMemo((): ImportOutcome | null => {
    if (!result) return null;
    const issues = [
      ...groupErrors(result.errors),
      ...groupErrors(timingWarnings),
    ];
    const stats = {
      added: result.sensors.length,
      updated: 0,
      identical: 0,
      notModified: 0,
      ignored: result.ignored,
    };

    if (result.sensors.length === 0) {
      return {
        status: "failed",
        message: translate(`${SENSOR_DATA_IMPORT_KEYS}.nothingToImport`),
        stats,
        issues,
      };
    }
    if (issues.length > 0) {
      return {
        status: "warning",
        message: translate(
          result.errors.length > 0
            ? `${SENSOR_DATA_IMPORT_KEYS}.issuesFound`
            : `${SENSOR_DATA_IMPORT_KEYS}.readyWithWarnings`,
        ),
        stats,
        issues,
      };
    }
    return {
      status: "success",
      message: translate(`${SENSOR_DATA_IMPORT_KEYS}.readyToImport`),
      stats,
    };
  }, [result, timingWarnings, translate]);
};

export const SensorPreview = ({
  result,
}: {
  result: ParseSensorDataResult;
}) => {
  const translate = useTranslate();
  const assets = useAtomValue(assetsDerivedAtom);
  const parameterLabel = useSensorParameterLabel();

  const preview = result.sensors.slice(0, MAX_PREVIEW_ROWS);
  const remaining = result.sensors.length - preview.length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {preview.length > 0 && (
        <div className="min-h-0 border rounded-base overflow-auto overscroll-none scroll-shadows [--scroll-shadow-top:calc(var(--spacing)*9)]">
          <table className="w-full table-fixed text-size-base">
            <colgroup>
              <col />
              <col className="w-32" />
              <col />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr>
                <th className={HEADER_CELL}>
                  {translate("sensorData.import.preview.sensor")}
                </th>
                <th className={HEADER_CELL}>
                  {translate("sensorData.import.preview.parameter")}
                </th>
                <th className={HEADER_CELL}>
                  {translate("sensorData.import.preview.asset")}
                </th>
                <th className={clsx(HEADER_CELL, "text-right")}>
                  {translate("sensorData.import.preview.readings")}
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((sensor) => {
                const asset = assets.get(sensor.assetId);
                const assetType = asset ? translate(asset.type) : "";
                const parameter = asset
                  ? parameterLabel(sensor.parameter, asset.type)
                  : sensor.parameter;
                return (
                  <tr key={sensor.name} className="border-t border">
                    <td className={BODY_CELL} title={sensor.name}>
                      {sensor.name}
                    </td>
                    <td className={BODY_CELL} title={parameter}>
                      {parameter}
                    </td>
                    <td
                      className={BODY_CELL}
                      title={
                        asset ? `${asset.label} (${assetType})` : undefined
                      }
                    >
                      {asset?.label}
                      {asset && (
                        <span className="text-subtle"> ({assetType})</span>
                      )}
                    </td>
                    <td className={clsx(BODY_CELL, "text-right tabular-nums")}>
                      {localizeDecimal(sensor.readings.length)}
                    </td>
                  </tr>
                );
              })}
              {remaining > 0 && (
                <tr className="border-t border">
                  <td
                    colSpan={4}
                    className={clsx(BODY_CELL, "text-subtle italic")}
                  >
                    {translate(
                      "sensorData.import.preview.previewMore",
                      localizeDecimal(remaining),
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
