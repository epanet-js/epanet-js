import {
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { Selector } from "@epanet-js/ui-kit";
import type { Asset, AssetId } from "@epanet-js/hydraulic-model";
import { getDecimals } from "@epanet-js/project-settings";
import {
  DataGrid,
  textColumn,
  type CellContextAction,
  type DataGridRef,
  type DataGridState,
  type GutterContextAction,
  type SelectedCells,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { useSensorParameterLabel } from "src/hooks/use-sensor-parameter-label";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useSelectAssetsInApp } from "src/commands/select-assets-in-app";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { PointerClickIcon, SensorsIcon } from "src/icons";
import { sensorsAtom } from "src/state/sensor-data";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import {
  type QuickGraphPropertyByAssetType,
  QUICK_GRAPH_PROPERTIES,
  SERIES_COLORS,
  toStatusStep,
  sensorReadingsStyle,
  stepTimes,
} from "src/lib/asset-graph";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";
import { useTimeSeries } from "src/hooks/use-time-series";
import { useStatusValueLabels } from "src/hooks/use-status-value-labels";
import {
  QuickGraphChart,
  QuickGraphChartByIndex,
  type QuickGraphSeries,
} from "src/components/graphs";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { colors } from "src/lib/constants";
import {
  contentStateFor,
  withContentState,
} from "src/panels/panel-content-state";
import { panelContentStateAtom } from "src/state/panels";
import {
  registerTableHandleAtom,
  unregisterTableHandleAtom,
} from "src/panels/data-tables/table-handles";
import { VerticalResizer } from "src/dialogs/vertical-resizer";
import { readingsStepSeconds } from "./time-points";

type SensorRow = {
  name: string;
  parameter: string;
  asset: string;
  assetId: AssetId | null;
};

const ASSET_COLUMN = "asset";

const FIRST_ROW_SELECTED: DataGridState = {
  selection: { min: { row: 0, col: 0 }, max: { row: 0, col: 0 } },
  activeCell: { row: 0, col: 0 },
};

const TABLE_MIN_WIDTH = 256;
const TABLE_DEFAULT_SHARE = 0.5;
const CHART_MIN_WIDTH = 240;

const noop = () => {};

export const SensorsPanel = ({
  panelId,
  assetIds,
}: {
  panelId: string;
  assetIds?: readonly AssetId[];
}) => {
  const allSensors = useAtomValue(sensorsAtom);
  const sensors = useMemo(() => {
    if (!assetIds) return allSensors;
    const scope = new Set(assetIds);
    return allSensors.filter(({ assetId }) => scope.has(assetId));
  }, [allSensors, assetIds]);

  if (allSensors.length === 0) return <SensorsEmptyState />;
  return <SensorsTableAndChart panelId={panelId} sensors={sensors} />;
};

const SensorsEmptyState = () => {
  const translate = useTranslate();
  const menuPath = [
    translate("file"),
    translate("import"),
    translate("sensorData.menuEntry"),
  ].join(" > ");

  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="flex items-start gap-4">
        <SensorsIcon size="2xl" className="shrink-0 text-subtle" />
        <div className="flex flex-col gap-2">
          <p className="text-size-heading-3 font-semibold text-subtle">
            {translate("sensorData.panel.emptyTitle")}
          </p>
          <p className="max-w-64 text-size-base text-subtle">
            {translate("sensorData.panel.emptyDescription", menuPath)}
          </p>
        </div>
      </div>
    </div>
  );
};

const useParameterLabel = () => {
  const labelFor = useSensorParameterLabel();
  return useCallback(
    (sensor: ImportedSensor, asset: Asset) =>
      labelFor(sensor.parameter, asset.type),
    [labelFor],
  );
};

const SensorsTableAndChart = ({
  panelId,
  sensors,
}: {
  panelId: string;
  sensors: ImportedSensor[];
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { assets } = useAtomValue(stagingModelDerivedAtom);
  const parameterLabel = useParameterLabel();
  const selectAssetsInApp = useSelectAssetsInApp();
  const zoomTo = useZoomTo();
  const dataGridRef = useRef<DataGridRef>(null);
  const [contentStates, setContentStates] = useAtom(panelContentStateAtom);
  const savedState = contentStateFor(contentStates, panelId, "sensors");
  const savedGrid = savedState?.grid;
  const registerHandle = useSetAtom(registerTableHandleAtom);
  const unregisterHandle = useSetAtom(unregisterTableHandleAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const tableWidth =
    savedState?.tableWidth ??
    Math.max(TABLE_MIN_WIDTH, Math.round(containerWidth * TABLE_DEFAULT_SHARE));

  useLayoutEffect(function trackContainerWidth() {
    const container = containerRef.current;
    if (!container) return;
    setContainerWidth(container.clientWidth);
    const observer = new ResizeObserver(() =>
      setContainerWidth(container.clientWidth),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const [selectedNames, setSelectedNames] = useState<readonly string[]>(() => {
    const first = savedGrid?.selection?.min.row ?? 0;
    const last = savedGrid?.selection?.max.row ?? 0;
    return sensors.slice(first, last + 1).map(({ name }) => name);
  });

  const saveState = useCallback(
    (patch: { grid?: DataGridState; tableWidth?: number }) =>
      setContentStates((prev) =>
        withContentState(prev, panelId, "sensors", {
          ...contentStateFor(prev, panelId, "sensors"),
          ...patch,
        }),
      ),
    [setContentStates, panelId],
  );

  const setTableWidth = useCallback(
    (width: number) => saveState({ tableWidth: width }),
    [saveState],
  );

  useEffect(
    function publishCaptureHandle() {
      const handle = {
        captureState: () => {
          const grid = dataGridRef.current?.captureState();
          if (grid) saveState({ grid });
        },
      };
      registerHandle(panelId, handle);
      return () => unregisterHandle(panelId, handle);
    },
    [panelId, saveState, registerHandle, unregisterHandle],
  );

  const rows = useMemo<SensorRow[]>(
    () =>
      sensors.map((sensor) => {
        const asset = assets.get(sensor.assetId);
        if (!asset) {
          return {
            name: sensor.name,
            parameter: "",
            asset: translate("sensorData.panel.notInScenario"),
            assetId: null,
          };
        }
        return {
          name: sensor.name,
          parameter: parameterLabel(sensor, asset),
          asset: `${asset.label} (${translate(asset.type)})`,
          assetId: asset.id,
        };
      }),
    [sensors, assets, parameterLabel, translate],
  );

  const cellHasWarning = useCallback(
    (rowIndex: number, columnId: string) =>
      columnId === ASSET_COLUMN && rows[rowIndex]?.assetId === null,
    [rows],
  );

  const columns = useMemo(
    () => [
      textColumn<SensorRow>("name", {
        header: translate("sensorData.panel.sensor"),
        isReadOnly: true,
      }),
      textColumn<SensorRow>(ASSET_COLUMN, {
        header: translate("sensorData.panel.asset"),
        isReadOnly: true,
      }),
      textColumn<SensorRow>("parameter", {
        header: translate("sensorData.panel.parameter"),
        isReadOnly: true,
      }),
    ],
    [translate],
  );

  const selectInMapActions = useMemo(() => {
    const assetIdsIn = (
      sortedRows: SensorRow[],
      minRow: number,
      maxRow: number,
    ) => {
      const ids = new Set<AssetId>();
      for (let i = minRow; i <= maxRow && i < sortedRows.length; i++) {
        const assetId = sortedRows[i]?.assetId;
        if (assetId !== null && assetId !== undefined) ids.add(assetId);
      }
      return [...ids];
    };

    const selectInMap =
      (source: "cell-context" | "gutter-context") =>
      (
        selection: { min: { row: number }; max: { row: number } },
        sortedRows: unknown[],
      ) => {
        const ids = assetIdsIn(
          sortedRows as SensorRow[],
          selection.min.row,
          selection.max.row,
        );
        if (ids.length === 0) return;
        selectAssetsInApp(ids);
        zoomTo(USelection.fromAssetIds(ids));
        userTracking.capture({
          name: "dataTables.selectedInMap",
          type: "sensor",
          source,
          count: ids.length,
        });
      };

    const action = (source: "cell-context" | "gutter-context") => ({
      label: translate("selectInMap"),
      icon: <PointerClickIcon />,
      onSelect: selectInMap(source),
    });

    return {
      cell: [action("cell-context")] as CellContextAction[],
      gutter: [action("gutter-context")] as GutterContextAction[],
    };
  }, [translate, selectAssetsInApp, zoomTo, userTracking]);

  const handleSelectionChange = useCallback(
    (selection: SelectedCells | null) => {
      if (!selection || selection.rowIndexes.length === 0) return;
      setSelectedNames(
        selection.rowIndexes.flatMap((index) => {
          const name = sensors[index]?.name;
          return name === undefined ? [] : [name];
        }),
      );
    },
    [sensors],
  );

  const handleSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      userTracking.capture({
        name: "dataTables.sorted",
        type: "sensor",
        property: columnId,
        direction,
      });
    },
    [userTracking],
  );

  const selectedSensors = useMemo(() => {
    const byName = new Map(sensors.map((sensor) => [sensor.name, sensor]));
    const found = selectedNames.flatMap((name) => {
      const sensor = byName.get(name);
      return sensor ? [sensor] : [];
    });
    return found.length > 0 ? found : sensors.slice(0, 1);
  }, [sensors, selectedNames]);
  const selected = selectedSensors.length === 1 ? selectedSensors[0] : null;
  const selectedAsset = selected ? assets.get(selected.assetId) : undefined;
  const showChart =
    selectedSensors.length > 0 &&
    containerWidth >= TABLE_MIN_WIDTH + CHART_MIN_WIDTH;

  return (
    <div ref={containerRef} className="h-full flex flex-row min-h-0">
      <div
        className={clsx(
          "flex flex-col min-h-0",
          showChart ? "shrink-0 border-r" : "flex-1 min-w-0",
        )}
        style={
          showChart
            ? {
                width: tableWidth,
                maxWidth: `calc(100% - ${CHART_MIN_WIDTH}px)`,
              }
            : undefined
        }
      >
        <DataGrid<SensorRow>
          ref={dataGridRef}
          initialGridState={
            savedGrid ?? (rows.length > 0 ? FIRST_ROW_SELECTED : undefined)
          }
          data={rows}
          columns={columns}
          onChange={noop}
          createRow={() => ({
            name: "",
            parameter: "",
            asset: "",
            assetId: null,
          })}
          getRowId={(row) => row.name}
          readOnly
          resizable
          minColumnSizePx={20}
          gutterColumn="selection"
          cellHasWarning={cellHasWarning}
          cellContextActions={selectInMapActions.cell}
          gutterContextActions={selectInMapActions.gutter}
          sortable
          onColumnSort={handleSort}
          onSelectionChange={handleSelectionChange}
        />
      </div>
      {showChart && (
        <VerticalResizer
          width={tableWidth}
          onWidthChange={setTableWidth}
          minWidth={TABLE_MIN_WIDTH}
          maxWidth={Math.max(TABLE_MIN_WIDTH, containerWidth - CHART_MIN_WIDTH)}
        />
      )}
      {showChart && (
        <div className="flex-1 min-w-0 flex flex-col min-h-0 p-3">
          <div className="relative flex-1 min-h-0">
            {selectedSensors.length > 1 ? (
              <MultiSensorChart
                sensors={selectedSensors}
                parameterLabel={parameterLabel}
              />
            ) : selected && selectedAsset ? (
              <SelectedSensorChart
                sensor={selected}
                asset={selectedAsset}
                label={parameterLabel(selected, selectedAsset)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-size-base text-subtle">
                {translate("sensorData.panel.notInScenario")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SelectedSensorChart = ({
  sensor,
  asset,
  label,
}: {
  sensor: ImportedSensor;
  asset: Asset;
  label: string;
}) => {
  const translate = useTranslate();
  const isSensorTimeSeriesOn = useFeatureFlag("FLAG_SENSOR_TIME_SERIES");
  const { formatting } = useAtomValue(projectSettingsAtom);
  const { timing } = useAtomValue(simulationSettingsDerivedAtom);
  const { data, isLoading, isStale } = useTimeSeries({
    assetId: asset.id,
    assetType: asset.type,
    property:
      sensor.parameter as QuickGraphPropertyByAssetType[typeof asset.type],
  });

  const isStatus = sensor.parameter === "status";

  const decimals = useMemo(() => {
    if (isStatus) return 0;
    const option = QUICK_GRAPH_PROPERTIES[asset.type].find(
      ({ value }) => value === sensor.parameter,
    );
    return option ? getDecimals(formatting, option.quantityKey) : 0;
  }, [isStatus, asset.type, sensor.parameter, formatting]);

  const valueLabels = useStatusValueLabels(asset.type, isStatus);

  const simulated = !isStale && data && data.intervalsCount > 1 ? data : null;

  const values = useMemo(() => {
    if (!simulated) return [];
    const raw = Array.from(simulated.values);
    return isStatus ? raw.map(toStatusStep) : raw;
  }, [simulated, isStatus]);

  const readingsStep = readingsStepSeconds(timing);
  const sensorTimes = useMemo(
    () => stepTimes(sensor.readings.length, readingsStep),
    [sensor.readings.length, readingsStep],
  );

  const series = useMemo<QuickGraphSeries[]>(
    () => [
      {
        label: translate("sensorData.panel.sensor"),
        values: sensor.readings,
        times: sensorTimes,
        style: sensorReadingsStyle(sensor.readings.length),
      },
      {
        label: translate("simulation"),
        values,
        times: stepTimes(values.length, simulated?.intervalSeconds ?? 0),
        style: { type: "line", color: colors.purple500 },
      },
    ],
    [translate, values, simulated, sensor.readings, sensorTimes],
  );

  const intervalSeconds = simulated ? simulated.intervalSeconds : readingsStep;
  const intervalsCount = Math.max(
    simulated?.intervalsCount ?? 0,
    sensor.readings.length,
  );

  const showTimeLabels = timing.duration > 0;

  const current = useMemo(
    () =>
      isSensorTimeSeriesOn ? (
        <QuickGraphChart
          series={series}
          timeRange={{
            start: 0,
            end: Math.max(0, intervalsCount - 1) * intervalSeconds,
          }}
          decimals={decimals}
          valueLabels={valueLabels}
          showTimeLabels={showTimeLabels}
          title={label}
        />
      ) : (
        <QuickGraphChartByIndex
          series={series}
          intervalsCount={intervalsCount}
          intervalSeconds={intervalSeconds}
          decimals={decimals}
          valueLabels={valueLabels}
          showTimeLabels={showTimeLabels}
          title={label}
        />
      ),
    [
      isSensorTimeSeriesOn,
      label,
      series,
      intervalsCount,
      intervalSeconds,
      decimals,
      valueLabels,
      showTimeLabels,
    ],
  );

  const [shown, setShown] = useState<ReactElement | null>(
    isLoading ? null : current,
  );
  if (!isLoading && shown !== current) setShown(current);

  return shown;
};

const MultiSensorChart = ({
  sensors,
  parameterLabel,
}: {
  sensors: ImportedSensor[];
  parameterLabel: (sensor: ImportedSensor, asset: Asset) => string;
}) => {
  const translate = useTranslate();
  const isSensorTimeSeriesOn = useFeatureFlag("FLAG_SENSOR_TIME_SERIES");
  const { formatting } = useAtomValue(projectSettingsAtom);
  const { timing } = useAtomValue(simulationSettingsDerivedAtom);
  const { assets } = useAtomValue(stagingModelDerivedAtom);
  const [chosenLabel, setChosenLabel] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      sensors.flatMap((sensor) => {
        const asset = assets.get(sensor.assetId);
        if (!asset) return [];
        return [{ sensor, asset, label: parameterLabel(sensor, asset) }];
      }),
    [sensors, assets, parameterLabel],
  );

  const labels = useMemo(
    () => [...new Set(entries.map(({ label }) => label))],
    [entries],
  );
  const activeLabel =
    chosenLabel !== null && labels.includes(chosenLabel)
      ? chosenLabel
      : (labels[0] ?? null);

  const plotted = useMemo(
    () => entries.filter(({ label }) => label === activeLabel),
    [entries, activeLabel],
  );

  const first = plotted[0];
  const isStatus = first?.sensor.parameter === "status";
  const valueLabels = useStatusValueLabels(
    first?.asset.type ?? "junction",
    isStatus,
  );

  const decimals = useMemo(() => {
    if (!first || isStatus) return 0;
    const option = QUICK_GRAPH_PROPERTIES[first.asset.type].find(
      ({ value }) => value === first.sensor.parameter,
    );
    return option ? getDecimals(formatting, option.quantityKey) : 0;
  }, [first, isStatus, formatting]);

  const stepSeconds = readingsStepSeconds(timing);
  const series = useMemo<QuickGraphSeries[]>(
    () =>
      plotted.map(({ sensor }, index) => ({
        label: sensor.name,
        values: sensor.readings,
        times: stepTimes(sensor.readings.length, stepSeconds),
        style: sensorReadingsStyle(
          sensor.readings.length,
          SERIES_COLORS[index % SERIES_COLORS.length],
        ),
      })),
    [plotted, stepSeconds],
  );

  const intervalsCount = Math.max(
    0,
    ...plotted.map(({ sensor }) => sensor.readings.length),
  );
  const timeRange = useMemo(
    () => ({ start: 0, end: Math.max(0, intervalsCount - 1) * stepSeconds }),
    [intervalsCount, stepSeconds],
  );

  const labelOptions = useMemo(
    () => labels.map((label) => ({ label, value: label })),
    [labels],
  );

  if (activeLabel === null) {
    return (
      <div className="h-full flex items-center justify-center text-size-base text-subtle">
        {translate("sensorData.panel.notInScenario")}
      </div>
    );
  }

  const title = labels.length > 1 ? undefined : activeLabel;
  const chart = isSensorTimeSeriesOn ? (
    <QuickGraphChart
      series={series}
      timeRange={timeRange}
      decimals={decimals}
      valueLabels={valueLabels}
      showTimeLabels={timing.duration > 0}
      title={title}
    />
  ) : (
    <QuickGraphChartByIndex
      series={series}
      intervalsCount={intervalsCount}
      intervalSeconds={stepSeconds}
      decimals={decimals}
      valueLabels={valueLabels}
      showTimeLabels={timing.duration > 0}
      title={title}
    />
  );

  if (labels.length === 1) return chart;

  return (
    <div className="absolute inset-0 flex flex-col gap-2">
      <div className="w-max shrink-0">
        <Selector
          options={labelOptions}
          selected={activeLabel}
          onChange={setChosenLabel}
          triggerClassName="h-8"
          styleOptions={{
            border: true,
            textSize: "text-size-base",
            paddingY: 1,
          }}
        />
      </div>
      <div className="flex-1 min-h-0">{chart}</div>
    </div>
  );
};
