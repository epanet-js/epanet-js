import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { changeProperties } from "src/hydraulic-model/model-operations";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import {
  DataGrid,
  floatColumn,
  textReadonlyColumn,
  type GridColumn,
} from "src/components/data-grid";
import { SpinnerIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";

type AssetRow = Record<string, unknown> & { id: AssetId };

const ASSET_TYPES: AssetType[] = [
  "junction",
  "pipe",
  "pump",
  "valve",
  "reservoir",
  "tank",
];

const ASSET_TYPE_TAB_KEY: Record<AssetType, string> = {
  junction: "junctions",
  pipe: "pipes",
  pump: "pumps",
  valve: "valves",
  reservoir: "reservoirs",
  tank: "tanks",
};

const EDITABLE_NUMERIC_KEYS: Record<AssetType, string[]> = {
  junction: ["elevation", "emitterCoefficient", "initialQuality"],
  pipe: [
    "diameter",
    "length",
    "roughness",
    "minorLoss",
    "bulkReactionCoeff",
    "wallReactionCoeff",
  ],
  pump: ["speed", "energyPrice"],
  valve: ["setting", "diameter", "minorLoss"],
  reservoir: ["elevation", "head", "initialQuality"],
  tank: [
    "elevation",
    "initialLevel",
    "minLevel",
    "maxLevel",
    "diameter",
    "initialQuality",
    "bulkReactionCoeff",
  ],
};

const NULLABLE_KEYS = new Set([
  "bulkReactionCoeff",
  "wallReactionCoeff",
  "energyPrice",
]);

type Simulation = NonNullable<
  ReturnType<typeof useAtomValue<typeof simulationResultsDerivedAtom>>
>;
type TranslateFn = ReturnType<typeof useTranslate>;
type TranslateUnitFn = ReturnType<typeof useTranslateUnit>;

function fmtNum(v: number | null | undefined): string {
  return v != null ? localizeDecimal(v, { decimals: 3 }) : "";
}

function buildSimRow(
  type: AssetType,
  assetId: AssetId,
  simulation: Simulation,
  translate: TranslateFn,
): Record<string, string> {
  switch (type) {
    case "junction": {
      const r = simulation.getJunction(assetId);
      return {
        sim_pressure: fmtNum(r?.pressure),
        sim_head: fmtNum(r?.head),
        sim_demand: fmtNum(r?.demand),
      };
    }
    case "pipe": {
      const r = simulation.getPipe(assetId);
      return {
        sim_flow: fmtNum(r?.flow),
        sim_velocity: fmtNum(r?.velocity),
        sim_headloss: fmtNum(r?.headloss),
        sim_unitHeadloss: fmtNum(r?.unitHeadloss),
        sim_status: r?.status ? translate(`pipe.${r.status}`) : "",
      };
    }
    case "pump": {
      const r = simulation.getPump(assetId);
      return {
        sim_flow: fmtNum(r?.flow),
        sim_headloss: fmtNum(r?.headloss),
        sim_status: r?.status ? translate(`pump.${r.status}`) : "",
      };
    }
    case "valve": {
      const r = simulation.getValve(assetId);
      return {
        sim_flow: fmtNum(r?.flow),
        sim_velocity: fmtNum(r?.velocity),
        sim_headloss: fmtNum(r?.headloss),
        sim_status: r?.status ? translate(`valve.${r.status}`) : "",
      };
    }
    case "reservoir": {
      const r = simulation.getReservoir(assetId);
      return {
        sim_head: fmtNum(r?.head),
        sim_netFlow: fmtNum(r?.netFlow),
      };
    }
    case "tank": {
      const r = simulation.getTank(assetId);
      return {
        sim_head: fmtNum(r?.head),
        sim_level: fmtNum(r?.level),
        sim_volume: fmtNum(r?.volume),
        sim_netFlow: fmtNum(r?.netFlow),
      };
    }
  }
}

function buildSimColumns(
  type: AssetType,
  translate: TranslateFn,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
): GridColumn[] {
  const ro = (
    key: string,
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const u = translateUnit(unit);
    return textReadonlyColumn(key, { header: u ? `${name} (${u})` : name });
  };
  switch (type) {
    case "junction":
      return [
        ro("sim_pressure", translate("pressure"), units.pressure),
        ro("sim_head", translate("head"), units.head),
        ro("sim_demand", translate("demand"), units.actualDemand),
      ];
    case "pipe":
      return [
        ro("sim_flow", translate("flow"), units.flow),
        ro("sim_velocity", translate("velocity"), units.velocity),
        ro("sim_headloss", translate("headlossShort"), units.headloss),
        ro("sim_unitHeadloss", translate("unitHeadloss"), units.unitHeadloss),
        ro("sim_status", translate("actualStatus")),
      ];
    case "pump":
      return [
        ro("sim_flow", translate("flow"), units.flow),
        ro("sim_headloss", translate("pumpHead"), units.headloss),
        ro("sim_status", translate("actualStatus")),
      ];
    case "valve":
      return [
        ro("sim_flow", translate("flow"), units.flow),
        ro("sim_velocity", translate("velocity"), units.velocity),
        ro("sim_headloss", translate("headlossShort"), units.headloss),
        ro("sim_status", translate("actualStatus")),
      ];
    case "reservoir":
      return [
        ro("sim_head", translate("head"), units.head),
        ro("sim_netFlow", translate("netFlow"), units.netFlow),
      ];
    case "tank":
      return [
        ro("sim_head", translate("head"), units.head),
        ro("sim_level", translate("level"), units.level),
        ro("sim_volume", translate("volume"), units.volume),
        ro("sim_netFlow", translate("netFlow"), units.netFlow),
      ];
  }
}

function buildColumns(
  type: AssetType,
  translate: TranslateFn,
  hasSimulation: boolean,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
): GridColumn[] {
  const editable = new Set(EDITABLE_NUMERIC_KEYS[type]);

  const hdr = (name: string, unit: Parameters<TranslateUnitFn>[0] = null) => {
    const u = translateUnit(unit);
    return u ? `${name} (${u})` : name;
  };

  const numericCol = (
    key: string,
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) =>
    editable.has(key)
      ? floatColumn(key, {
          header: hdr(name, unit),
          ...(NULLABLE_KEYS.has(key)
            ? { nullValue: null, deleteValue: null }
            : {}),
        })
      : textReadonlyColumn(key, { header: hdr(name, unit) });

  const simCols = hasSimulation
    ? buildSimColumns(type, translate, units, translateUnit)
    : [];

  switch (type) {
    case "junction":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("elevation", translate("elevation"), units.elevation),
        numericCol(
          "emitterCoefficient",
          translate("emitterCoefficient"),
          units.emitterCoefficient,
        ),
        numericCol("initialQuality", translate("initialQuality")),
        ...simCols,
      ];
    case "pipe":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        textReadonlyColumn("initialStatus", {
          header: translate("initialStatus"),
        }),
        numericCol("diameter", translate("diameter"), units.diameter),
        numericCol("length", translate("length"), units.length),
        numericCol("roughness", translate("roughness"), units.roughness),
        numericCol("minorLoss", translate("minorLoss"), units.minorLoss),
        numericCol("bulkReactionCoeff", translate("bulkReactionCoeff")),
        numericCol("wallReactionCoeff", translate("wallReactionCoeff")),
        ...simCols,
      ];
    case "pump":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        textReadonlyColumn("initialStatus", {
          header: translate("initialStatus"),
        }),
        numericCol("speed", translate("initialSpeed"), units.speed),
        numericCol("energyPrice", translate("energyPrice")),
        ...simCols,
      ];
    case "valve":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        textReadonlyColumn("kind", { header: translate("valveType") }),
        numericCol("setting", translate("setting")),
        textReadonlyColumn("initialStatus", {
          header: translate("initialStatus"),
        }),
        numericCol("diameter", translate("diameter"), units.diameter),
        numericCol("minorLoss", translate("minorLoss"), units.minorLoss),
        ...simCols,
      ];
    case "reservoir":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("elevation", translate("elevation"), units.elevation),
        numericCol("head", translate("head"), units.head),
        numericCol("initialQuality", translate("initialQuality")),
        ...simCols,
      ];
    case "tank":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("elevation", translate("elevation"), units.elevation),
        numericCol(
          "initialLevel",
          translate("initialLevel"),
          units.initialLevel,
        ),
        numericCol("minLevel", translate("minLevel"), units.minLevel),
        numericCol("maxLevel", translate("maxLevel"), units.maxLevel),
        numericCol("diameter", translate("diameter"), units.tankDiameter),
        numericCol("initialQuality", translate("initialQuality")),
        numericCol("bulkReactionCoeff", translate("bulkReactionCoeff")),
        ...simCols,
      ];
  }
}

function assetToRow(asset: {
  id: AssetId;
  feature: { properties: Record<string, unknown> };
}): AssetRow {
  return { id: asset.id, ...asset.feature.properties };
}

export const DataTablesPanel = memo(function DataTablesPanelInner() {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationResultsDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const assetIdsByType = useMemo(() => {
    const map = new Map<AssetType, AssetId[]>();
    for (const asset of hydraulicModel.assets.values()) {
      const type = asset.type as AssetType;
      const ids = map.get(type);
      if (ids) {
        ids.push(asset.id);
      } else {
        map.set(type, [asset.id]);
      }
    }
    return map;
  }, [hydraulicModel.assets]);

  const presentTypes = useMemo(
    () => ASSET_TYPES.filter((t) => assetIdsByType.has(t)),
    [assetIdsByType],
  );

  const [activeTab, setActiveTab] = useState<AssetType | null>(
    () => presentTypes[0] ?? null,
  );

  const effectiveTab =
    activeTab && assetIdsByType.has(activeTab)
      ? activeTab
      : (presentTypes[0] ?? null);

  const columns = useMemo(
    () =>
      effectiveTab
        ? buildColumns(
            effectiveTab,
            translate,
            simulation !== null,
            units,
            translateUnit,
          )
        : [],
    [effectiveTab, translate, simulation, units, translateUnit],
  );

  const [rows, setRows] = useState<AssetRow[] | null>(null);

  useEffect(() => {
    if (!effectiveTab) {
      setRows([]);
      return;
    }
    const ids = assetIdsByType.get(effectiveTab) ?? [];
    let cancelled = false;

    async function compute() {
      setRows(null);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelled) return;

      const result: AssetRow[] = [];
      for (const id of ids) {
        const asset = hydraulicModel.assets.get(id);
        if (!asset) continue;
        const simFields = simulation
          ? buildSimRow(effectiveTab, id, simulation, translate)
          : {};
        result.push({ ...assetToRow(asset), ...simFields });
      }
      setRows(result);
    }

    void compute();
    return () => {
      cancelled = true;
    };
  }, [
    effectiveTab,
    assetIdsByType,
    hydraulicModel.assets,
    simulation,
    translate,
  ]);

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      if (!effectiveTab) return;
      const editableKeys = EDITABLE_NUMERIC_KEYS[effectiveTab];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rows?.[i];
        if (!oldRow) continue;
        const assetId = newRow.id;
        const changes: PropertyChange[] = [];
        for (const key of editableKeys) {
          if (newRow[key] !== oldRow[key]) {
            changes.push({
              property: key,
              value: newRow[key],
            } as PropertyChange);
          }
        }
        if (changes.length > 0) {
          transact(
            changeProperties(hydraulicModel, { assetIds: [assetId], changes }),
          );
        }
      }
    },
    [rows, effectiveTab, hydraulicModel, transact],
  );

  if (presentTypes.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-600">
        No assets in network
      </div>
    );
  }

  return (
    <TabRoot
      className="absolute inset-0 flex flex-col"
      value={effectiveTab ?? undefined}
      onValueChange={(v) => setActiveTab(v as AssetType)}
    >
      <TabList>
        {presentTypes.map((type) => (
          <Tab key={type} value={type}>
            {translate(ASSET_TYPE_TAB_KEY[type])}
          </Tab>
        ))}
      </TabList>
      <div className="flex-1 min-h-0 relative">
        {rows === null ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-600">
            <SpinnerIcon />
          </div>
        ) : (
          <DataGrid
            key={effectiveTab}
            data={rows}
            columns={columns}
            onChange={onChange as (data: Record<string, unknown>[]) => void}
            createRow={() => ({}) as Record<string, unknown>}
            gutterColumn={false}
          />
        )}
      </div>
    </TabRoot>
  );
});
