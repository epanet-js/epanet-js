import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getDecimals } from "src/lib/project-settings";
import type {
  UnitsSpec,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";

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
type FormatFn = (
  value: number | null | undefined,
  property: QuantityProperty,
) => string;

function buildSimRow(
  type: AssetType,
  assetId: AssetId,
  simulation: Simulation,
  translate: TranslateFn,
  fmt: FormatFn,
): Record<string, string> {
  switch (type) {
    case "junction": {
      const sim = simulation.getJunction(assetId);
      return {
        sim_pressure: fmt(sim?.pressure, "pressure"),
        sim_head: fmt(sim?.head, "head"),
        sim_demand: fmt(sim?.demand, "actualDemand"),
      };
    }
    case "pipe": {
      const sim = simulation.getPipe(assetId);
      return {
        sim_flow: fmt(sim?.flow, "flow"),
        sim_velocity: fmt(sim?.velocity, "velocity"),
        sim_headloss: fmt(sim?.headloss, "headloss"),
        sim_unitHeadloss: fmt(sim?.unitHeadloss, "unitHeadloss"),
        sim_status: sim?.status ? translate(`pipe.${sim.status}`) : "",
      };
    }
    case "pump": {
      const sim = simulation.getPump(assetId);
      return {
        sim_flow: fmt(sim?.flow, "flow"),
        sim_headloss: fmt(sim?.headloss, "headloss"),
        sim_status: sim?.status ? translate(`pump.${sim.status}`) : "",
      };
    }
    case "valve": {
      const sim = simulation.getValve(assetId);
      return {
        sim_flow: fmt(sim?.flow, "flow"),
        sim_velocity: fmt(sim?.velocity, "velocity"),
        sim_headloss: fmt(sim?.headloss, "headloss"),
        sim_status: sim?.status ? translate(`valve.${sim.status}`) : "",
      };
    }
    case "reservoir": {
      const r = simulation.getReservoir(assetId);
      return {
        sim_head: fmt(r?.head, "head"),
        sim_netFlow: fmt(r?.netFlow, "netFlow"),
      };
    }
    case "tank": {
      const sim = simulation.getTank(assetId);
      return {
        sim_head: fmt(sim?.head, "head"),
        sim_level: fmt(sim?.level, "level"),
        sim_volume: fmt(sim?.volume, "volume"),
        sim_netFlow: fmt(sim?.netFlow, "netFlow"),
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
  formatting: FormattingSpec,
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
    property?: QuantityProperty,
  ) =>
    floatColumn(key, {
      header: hdr(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      readonly: !editable.has(key),
      ...(NULLABLE_KEYS.has(key) ? { nullValue: null, deleteValue: null } : {}),
    });

  const simCols = hasSimulation
    ? buildSimColumns(type, translate, units, translateUnit)
    : [];

  switch (type) {
    case "junction":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol(
          "elevation",
          translate("elevation"),
          units.elevation,
          "elevation",
        ),
        numericCol(
          "emitterCoefficient",
          translate("emitterCoefficient"),
          units.emitterCoefficient,
          "emitterCoefficient",
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
        numericCol(
          "diameter",
          translate("diameter"),
          units.diameter,
          "diameter",
        ),
        numericCol("length", translate("length"), units.length, "length"),
        numericCol("roughness", translate("roughness"), units.roughness),
        numericCol(
          "minorLoss",
          translate("minorLoss"),
          units.minorLoss,
          "minorLoss",
        ),
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
        numericCol("speed", translate("initialSpeed"), units.speed, "speed"),
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
        numericCol(
          "diameter",
          translate("diameter"),
          units.diameter,
          "diameter",
        ),
        numericCol(
          "minorLoss",
          translate("minorLoss"),
          units.minorLoss,
          "minorLoss",
        ),
        ...simCols,
      ];
    case "reservoir":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol(
          "elevation",
          translate("elevation"),
          units.elevation,
          "elevation",
        ),
        numericCol("head", translate("head"), units.head, "head"),
        numericCol("initialQuality", translate("initialQuality")),
        ...simCols,
      ];
    case "tank":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol(
          "elevation",
          translate("elevation"),
          units.elevation,
          "elevation",
        ),
        numericCol(
          "initialLevel",
          translate("initialLevel"),
          units.initialLevel,
          "initialLevel",
        ),
        numericCol(
          "minLevel",
          translate("minLevel"),
          units.minLevel,
          "minLevel",
        ),
        numericCol(
          "maxLevel",
          translate("maxLevel"),
          units.maxLevel,
          "maxLevel",
        ),
        numericCol(
          "diameter",
          translate("diameter"),
          units.tankDiameter,
          "tankDiameter",
        ),
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
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const formatSimValue = useCallback<FormatFn>(
    (value, property) =>
      value != null
        ? localizeDecimal(value, {
            decimals: getDecimals(formatting, property),
          })
        : "",
    [formatting],
  );

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

  const hasSimulation = simulation !== null;
  const columns = useMemo(
    () =>
      effectiveTab
        ? buildColumns(
            effectiveTab,
            translate,
            hasSimulation,
            units,
            translateUnit,
            formatting,
          )
        : [],
    [effectiveTab, translate, hasSimulation, units, translateUnit, formatting],
  );

  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const prevTabRef = useRef<typeof effectiveTab | undefined>(undefined);

  useEffect(
    function updateTableOnTabChange() {
      if (!effectiveTab) {
        setRows([]);
        prevTabRef.current = effectiveTab;
        return;
      }
      const ids = assetIdsByType.get(effectiveTab) ?? [];
      let cancelled = false;
      const tabChanged = prevTabRef.current !== effectiveTab;

      async function compute() {
        if (tabChanged) {
          setRows(null);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (cancelled) return;

        const result: AssetRow[] = [];
        for (const id of ids) {
          const asset = hydraulicModel.assets.get(id);
          if (!asset) continue;
          const simFields = simulation
            ? buildSimRow(
                effectiveTab,
                id,
                simulation,
                translate,
                formatSimValue,
              )
            : {};
          result.push({ ...assetToRow(asset), ...simFields });
        }
        if (!cancelled) {
          setRows(result);
          prevTabRef.current = effectiveTab;
        }
      }

      void compute();
      return () => {
        cancelled = true;
      };
    },
    [
      effectiveTab,
      assetIdsByType,
      hydraulicModel.assets,
      simulation,
      translate,
      formatSimValue,
    ],
  );

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      if (!effectiveTab) return;
      const editableKeys = EDITABLE_NUMERIC_KEYS[effectiveTab];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
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
    [effectiveTab, hydraulicModel, transact],
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
