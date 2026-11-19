import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import type { Asset, AssetId } from "@epanet-js/hydraulic-model";
import { getDecimals } from "@epanet-js/project-settings";
import {
  DataGrid,
  textColumn,
  type CellContextAction,
  type DataGridRef,
  type DataGridState,
  type GridSelection,
  type GutterContextAction,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
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
import type { QuickGraphPropertyByAssetType } from "src/state/quick-graph";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";
import {
  QUICK_GRAPH_PROPERTIES,
  STATUS_CLOSED,
  STATUS_OPEN,
  toStatusStep,
} from "src/panels/asset-panel/quick-graph/quick-graph-section";
import { useTimeSeries } from "src/panels/asset-panel/quick-graph/use-time-series";
import {
  QuickGraphChart,
  type QuickGraphSeries,
} from "src/panels/asset-panel/quick-graph/quick-graph-chart";
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
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const { units } = useAtomValue(projectSettingsAtom);

  return useCallback(
    (sensor: ImportedSensor, asset: Asset) => {
      const option = QUICK_GRAPH_PROPERTIES[asset.type].find(
        ({ value }) => value === sensor.parameter,
      );
      if (!option) return "";
      const label = translate(option.labelKey);
      const unit =
        sensor.parameter === "status" ? null : units[option.quantityKey];
      return unit ? `${label} (${translateUnit(unit)})` : label;
    },
    [translate, translateUnit, units],
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
  const [selectedIndex, setSelectedIndex] = useState(
    savedGrid?.selection?.min.row ?? 0,
  );
  const [isMultiRowSelection, setIsMultiRowSelection] = useState(
    savedGrid?.selection
      ? savedGrid.selection.min.row !== savedGrid.selection.max.row
      : false,
  );

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
    (selection: GridSelection | null) => {
      if (!selection) return;
      setSelectedIndex(selection.min.row);
      setIsMultiRowSelection(selection.min.row !== selection.max.row);
    },
    [],
  );

  const selected =
    sensors.length > 0
      ? sensors[Math.min(selectedIndex, sensors.length - 1)]
      : null;
  const selectedAsset = selected ? assets.get(selected.assetId) : undefined;
  const showChart =
    selected !== null &&
    !isMultiRowSelection &&
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
            {selectedAsset && (
              <span className="absolute top-0 left-0 z-10 max-w-[50%] truncate text-size-small text-subtle leading-5">
                {parameterLabel(selected, selectedAsset)}
              </span>
            )}
            {selectedAsset ? (
              <SelectedSensorChart
                key={`${selected.name}:${selected.assetId}`}
                sensor={selected}
                asset={selectedAsset}
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
}: {
  sensor: ImportedSensor;
  asset: Asset;
}) => {
  const translate = useTranslate();
  const { formatting } = useAtomValue(projectSettingsAtom);
  const { timing } = useAtomValue(simulationSettingsDerivedAtom);
  const { data } = useTimeSeries({
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

  const valueLabels = useMemo(() => {
    if (!isStatus) return null;
    return asset.type === "pump"
      ? new Map([
          [STATUS_CLOSED, translate("pump.off")],
          [STATUS_OPEN, translate("pump.on")],
        ])
      : new Map([
          [STATUS_CLOSED, translate("statusClosed")],
          [STATUS_OPEN, translate("statusOpen")],
        ]);
  }, [isStatus, asset.type, translate]);

  const simulated = data && data.intervalsCount > 1 ? data : null;

  const values = useMemo(() => {
    if (!simulated) return [];
    const raw = Array.from(simulated.values);
    return isStatus ? raw.map(toStatusStep) : raw;
  }, [simulated, isStatus]);

  const series = useMemo<QuickGraphSeries[]>(
    () => [
      {
        label: translate("simulation"),
        values,
        style: { type: "line", color: colors.gray400 },
      },
      {
        label: translate("sensorData.panel.sensor"),
        values: sensor.readings,
        style: { type: "points", color: colors.purple500 },
      },
    ],
    [translate, values, sensor.readings],
  );

  const intervalSeconds = simulated
    ? simulated.intervalSeconds
    : readingsStepSeconds(timing);
  const intervalsCount = Math.max(
    simulated?.intervalsCount ?? 0,
    sensor.readings.length,
  );

  return (
    <QuickGraphChart
      series={series}
      intervalsCount={intervalsCount}
      intervalSeconds={intervalSeconds}
      decimals={decimals}
      valueLabels={valueLabels}
    />
  );
};
