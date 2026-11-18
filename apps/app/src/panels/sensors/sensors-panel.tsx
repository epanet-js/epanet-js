import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { Asset, AssetId } from "@epanet-js/hydraulic-model";
import {
  DataGrid,
  textColumn,
  type CellContextAction,
  type DataGridRef,
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
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";
import { QUICK_GRAPH_PROPERTIES } from "src/panels/asset-panel/quick-graph/quick-graph-section";
import { usePanelGridState } from "src/panels/data-tables/use-panel-grid-state";
import {
  registerTableHandleAtom,
  unregisterTableHandleAtom,
} from "src/panels/data-tables/table-handles";

type SensorRow = {
  name: string;
  type: string;
  asset: string;
  assetId: AssetId | null;
};

const ASSET_COLUMN = "asset";

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
  return <SensorsTable panelId={panelId} sensors={sensors} />;
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

const useSensorTypeLabel = () => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const { units } = useAtomValue(projectSettingsAtom);

  return useCallback(
    (sensor: ImportedSensor, asset: Asset) => {
      const option = QUICK_GRAPH_PROPERTIES[asset.type].find(
        ({ value }) => value === sensor.type,
      );
      if (!option) return "";
      const label = translate(option.labelKey);
      const unit = sensor.type === "status" ? null : units[option.quantityKey];
      return unit ? `${label} (${translateUnit(unit)})` : label;
    },
    [translate, translateUnit, units],
  );
};

const SensorsTable = ({
  panelId,
  sensors,
}: {
  panelId: string;
  sensors: ImportedSensor[];
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { assets } = useAtomValue(stagingModelDerivedAtom);
  const typeLabel = useSensorTypeLabel();
  const selectAssetsInApp = useSelectAssetsInApp();
  const zoomTo = useZoomTo();
  const dataGridRef = useRef<DataGridRef>(null);
  const [savedState, saveState] = usePanelGridState(panelId, "sensors");
  const registerHandle = useSetAtom(registerTableHandleAtom);
  const unregisterHandle = useSetAtom(unregisterTableHandleAtom);

  useEffect(
    function publishCaptureHandle() {
      const handle = {
        captureState: () => {
          const state = dataGridRef.current?.captureState();
          if (state) saveState(state);
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
            type: "",
            asset: translate("sensorData.panel.notInScenario"),
            assetId: null,
          };
        }
        return {
          name: sensor.name,
          type: typeLabel(sensor, asset),
          asset: `${asset.label} (${translate(asset.type)})`,
          assetId: asset.id,
        };
      }),
    [sensors, assets, typeLabel, translate],
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
      textColumn<SensorRow>("type", {
        header: translate("sensorData.panel.type"),
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

  return (
    <div className="h-full flex flex-col min-h-0">
      <DataGrid<SensorRow>
        ref={dataGridRef}
        initialGridState={savedState}
        data={rows}
        columns={columns}
        onChange={noop}
        createRow={() => ({ name: "", type: "", asset: "", assetId: null })}
        getRowId={(row) => row.name}
        readOnly
        resizable
        minColumnSizePx={20}
        gutterColumn="selection"
        cellHasWarning={cellHasWarning}
        cellContextActions={selectInMapActions.cell}
        gutterContextActions={selectInMapActions.gutter}
      />
    </div>
  );
};
