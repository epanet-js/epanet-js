import { useMemo } from "react";
import clsx from "clsx";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { isNodeType } from "../property-config";
import {
  useChartData,
  computePercentileSeries,
  buildTimeLabels,
} from "./use-chart-data";
import type { AssetSeries } from "./use-chart-data";

const MAX_LINES = 12;
const ROW_HEIGHT = 32;
const LABEL_COL_WIDTH = 120;
const VALUE_COL_WIDTH = 72;

interface TableRow {
  label: string;
  isPercentile: boolean;
  isLastPercentileBlock: boolean;
  values: (number | null)[];
  decimals: number;
}

function buildPercentileRows(
  group: AssetSeries[],
  timestepCount: number,
  decimals: number,
  prefix: string,
  isLastBlock: boolean,
): TableRow[] {
  const valid = group.filter((s) => s.timeSeries);
  if (valid.length === 0) return [];

  const percs = computePercentileSeries(
    valid.map((s) => s.timeSeries!.values),
    timestepCount,
  );

  return [
    {
      label: `${prefix}P10`,
      isPercentile: true,
      isLastPercentileBlock: false,
      values: percs.p10,
      decimals,
    },
    {
      label: `${prefix}P25`,
      isPercentile: true,
      isLastPercentileBlock: false,
      values: percs.p25,
      decimals,
    },
    {
      label: `${prefix}P50`,
      isPercentile: true,
      isLastPercentileBlock: false,
      values: percs.p50,
      decimals,
    },
    {
      label: `${prefix}P75`,
      isPercentile: true,
      isLastPercentileBlock: false,
      values: percs.p75,
      decimals,
    },
    {
      label: `${prefix}P90`,
      isPercentile: true,
      isLastPercentileBlock: isLastBlock,
      values: percs.p90,
      decimals,
    },
  ];
}

interface ChartTableStepProps {
  selectedAssetIds: number[];
  nodeProperty: string | null;
  linkProperty: string | null;
}

export function ChartTableStep({
  selectedAssetIds,
  nodeProperty,
  linkProperty,
}: ChartTableStepProps) {
  const translate = useTranslate();
  const {
    isLoading,
    hasSimulation,
    assetSeries,
    timestepCount,
    intervalSeconds,
    nodeSeries,
    linkSeries,
    nodeDecimals,
    linkDecimals,
    isMixed,
  } = useChartData(selectedAssetIds, nodeProperty, linkProperty);

  const showPercentiles = assetSeries.length > MAX_LINES;

  const timeLabels = useMemo(
    () => buildTimeLabels(timestepCount, intervalSeconds),
    [timestepCount, intervalSeconds],
  );

  const rows = useMemo((): TableRow[] => {
    const result: TableRow[] = [];

    if (showPercentiles) {
      if (isMixed) {
        const hasLinks = linkSeries.length > 0;
        result.push(
          ...buildPercentileRows(
            nodeSeries,
            timestepCount,
            nodeDecimals,
            "N ",
            !hasLinks,
          ),
        );
        if (hasLinks) {
          result.push(
            ...buildPercentileRows(
              linkSeries,
              timestepCount,
              linkDecimals,
              "L ",
              true,
            ),
          );
        }
      } else {
        const decimals = nodeSeries.length > 0 ? nodeDecimals : linkDecimals;
        result.push(
          ...buildPercentileRows(
            assetSeries,
            timestepCount,
            decimals,
            "",
            true,
          ),
        );
      }
    }

    assetSeries.forEach((s) => {
      const decimals = isNodeType(s.type) ? nodeDecimals : linkDecimals;
      result.push({
        label: s.label,
        isPercentile: false,
        isLastPercentileBlock: false,
        values: s.timeSeries
          ? Array.from(s.timeSeries.values)
          : Array(timestepCount).fill(null),
        decimals,
      });
    });

    return result;
  }, [
    assetSeries,
    nodeSeries,
    linkSeries,
    showPercentiles,
    isMixed,
    nodeDecimals,
    linkDecimals,
    timestepCount,
  ]);

  if (!hasSimulation) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        {translate("chartBuilder.label")}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-0">
        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (timestepCount === 0) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-0 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded">
      <table
        className="text-sm"
        style={{
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: 0,
        }}
      >
        <thead>
          <tr
            className="bg-gray-100 dark:bg-gray-800"
            style={{ position: "sticky", top: 0, zIndex: 20 }}
          >
            <th
              className="px-2 text-left font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 h-8 truncate"
              style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
            >
              Asset
            </th>
            {timeLabels.map((label, i) => (
              <th
                key={i}
                className="px-2 text-right font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 h-8"
                style={{ width: VALUE_COL_WIDTH, minWidth: VALUE_COL_WIDTH }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isSticky = row.isPercentile;
            const stickyTop = isSticky
              ? ROW_HEIGHT + rowIdx * ROW_HEIGHT
              : undefined;

            const rowBg = row.isPercentile
              ? "bg-gray-50 dark:bg-gray-800"
              : "bg-white dark:bg-gray-900";

            const borderClass = row.isLastPercentileBlock
              ? "border-b-2 border-gray-300 dark:border-gray-600"
              : "border-b border-gray-100 dark:border-gray-700";

            return (
              <tr
                key={rowIdx}
                style={
                  isSticky
                    ? { position: "sticky", top: stickyTop, zIndex: 10 }
                    : undefined
                }
              >
                <td
                  className={clsx(
                    "px-2 text-left text-gray-700 dark:text-gray-300 h-8 truncate",
                    row.isPercentile ? "font-medium" : "",
                    rowBg,
                    borderClass,
                  )}
                  style={{ width: LABEL_COL_WIDTH, minWidth: LABEL_COL_WIDTH }}
                >
                  {row.label}
                </td>
                {row.values.map((val, colIdx) => (
                  <td
                    key={colIdx}
                    className={clsx(
                      "px-2 text-right tabular-nums text-gray-700 dark:text-gray-300 h-8",
                      rowBg,
                      borderClass,
                    )}
                  >
                    {val !== null
                      ? localizeDecimal(val, { decimals: row.decimals })
                      : "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
