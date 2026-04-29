import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  changeProperties,
  changeLabel,
} from "src/hydraulic-model/model-operations";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { AssetType } from "src/hydraulic-model/asset-types/types";
import type { AssetId } from "src/hydraulic-model/asset-types/base-asset";
import {
  DataGrid,
  floatColumn,
  filterableSelectColumn,
  textColumn,
  type GridColumn,
} from "src/components/data-grid";
import { pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import { pumpStatuses } from "src/hydraulic-model/asset-types/pump";
import {
  valveKinds,
  valveStatuses,
} from "src/hydraulic-model/asset-types/valve";
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

const EDITABLE_SELECT_KEYS: Record<AssetType, string[]> = {
  junction: [],
  pipe: ["initialStatus"],
  pump: ["initialStatus"],
  valve: ["kind", "initialStatus"],
  reservoir: [],
  tank: [],
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

function buildSimRow(
  type: AssetType,
  assetId: AssetId,
  simulation: Simulation,
  translate: TranslateFn,
): Record<string, number | string | null> {
  switch (type) {
    case "junction": {
      const sim = simulation.getJunction(assetId);
      return {
        sim_pressure: sim?.pressure ?? null,
        sim_head: sim?.head ?? null,
        sim_demand: sim?.demand ?? null,
      };
    }
    case "pipe": {
      const sim = simulation.getPipe(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_velocity: sim?.velocity ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_unitHeadloss: sim?.unitHeadloss ?? null,
        sim_status: sim?.status ? translate(`pipe.${sim.status}`) : "",
      };
    }
    case "pump": {
      const sim = simulation.getPump(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_status: sim?.status ? translate(`pump.${sim.status}`) : "",
      };
    }
    case "valve": {
      const sim = simulation.getValve(assetId);
      return {
        sim_flow: sim?.flow ?? null,
        sim_velocity: sim?.velocity ?? null,
        sim_headloss: sim?.headloss ?? null,
        sim_status: sim?.status ? translate(`valve.${sim.status}`) : "",
      };
    }
    case "reservoir": {
      const r = simulation.getReservoir(assetId);
      return {
        sim_head: r?.head ?? null,
        sim_netFlow: r?.netFlow ?? null,
      };
    }
    case "tank": {
      const sim = simulation.getTank(assetId);
      return {
        sim_head: sim?.head ?? null,
        sim_level: sim?.level ?? null,
        sim_volume: sim?.volume ?? null,
        sim_netFlow: sim?.netFlow ?? null,
      };
    }
  }
}

function buildSimColumns(
  type: AssetType,
  translate: TranslateFn,
  units: UnitsSpec,
  translateUnit: TranslateUnitFn,
  formatting: FormattingSpec,
): GridColumn[] {
  const headerLabel = (
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const unitLabel = translateUnit(unit);
    return unitLabel ? `${name} (${unitLabel})` : name;
  };
  const simNumericValue = (
    key: string,
    name: string,
    unit: Parameters<TranslateUnitFn>[0],
    property: QuantityProperty,
  ) =>
    floatColumn(key, {
      header: headerLabel(name, unit),
      decimals: getDecimals(formatting, property),
      readonly: true,
    });
  const simTextValue = (key: string, name: string) =>
    textColumn(key, { header: name, readonly: true });

  switch (type) {
    case "junction":
      return [
        simNumericValue(
          "sim_pressure",
          translate("pressure"),
          units.pressure,
          "pressure",
        ),
        simNumericValue("sim_head", translate("head"), units.head, "head"),
        simNumericValue(
          "sim_demand",
          translate("demand"),
          units.actualDemand,
          "actualDemand",
        ),
      ];
    case "pipe":
      return [
        simNumericValue("sim_flow", translate("flow"), units.flow, "flow"),
        simNumericValue(
          "sim_velocity",
          translate("velocity"),
          units.velocity,
          "velocity",
        ),
        simNumericValue(
          "sim_headloss",
          translate("headlossShort"),
          units.headloss,
          "headloss",
        ),
        simNumericValue(
          "sim_unitHeadloss",
          translate("unitHeadloss"),
          units.unitHeadloss,
          "unitHeadloss",
        ),
        simTextValue("sim_status", translate("actualStatus")),
      ];
    case "pump":
      return [
        simNumericValue("sim_flow", translate("flow"), units.flow, "flow"),
        simNumericValue(
          "sim_headloss",
          translate("pumpHead"),
          units.headloss,
          "headloss",
        ),
        simTextValue("sim_status", translate("actualStatus")),
      ];
    case "valve":
      return [
        simNumericValue("sim_flow", translate("flow"), units.flow, "flow"),
        simNumericValue(
          "sim_velocity",
          translate("velocity"),
          units.velocity,
          "velocity",
        ),
        simNumericValue(
          "sim_headloss",
          translate("headlossShort"),
          units.headloss,
          "headloss",
        ),
        simTextValue("sim_status", translate("actualStatus")),
      ];
    case "reservoir":
      return [
        simNumericValue("sim_head", translate("head"), units.head, "head"),
        simNumericValue(
          "sim_netFlow",
          translate("netFlow"),
          units.netFlow,
          "netFlow",
        ),
      ];
    case "tank":
      return [
        simNumericValue("sim_head", translate("head"), units.head, "head"),
        simNumericValue("sim_level", translate("level"), units.level, "level"),
        simNumericValue(
          "sim_volume",
          translate("volume"),
          units.volume,
          "volume",
        ),
        simNumericValue(
          "sim_netFlow",
          translate("netFlow"),
          units.netFlow,
          "netFlow",
        ),
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

  const headerLabel = (
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
  ) => {
    const unitLabel = translateUnit(unit);
    return unitLabel ? `${name} (${unitLabel})` : name;
  };

  const numericCol = (
    key: string,
    name: string,
    unit: Parameters<TranslateUnitFn>[0] = null,
    property?: QuantityProperty,
  ) =>
    floatColumn(key, {
      header: headerLabel(name, unit),
      decimals:
        property != null
          ? getDecimals(formatting, property)
          : formatting.defaultDecimals,
      readonly: !editable.has(key),
      ...(NULLABLE_KEYS.has(key) ? { nullValue: null, deleteValue: null } : {}),
    });

  const simCols = hasSimulation
    ? buildSimColumns(type, translate, units, translateUnit, formatting)
    : [];

  switch (type) {
    case "junction":
      return [
        textColumn("label", { header: translate("label") }),
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
        textColumn("label", { header: translate("label") }),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: pipeStatuses.map((s) => ({
            value: s,
            label: translate(`pipe.${s}`),
          })),
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
        textColumn("label", { header: translate("label") }),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: pumpStatuses.map((s) => ({
            value: s,
            label: translate(`pump.${s}`),
          })),
        }),
        numericCol("speed", translate("initialSpeed"), units.speed, "speed"),
        numericCol("energyPrice", translate("energyPrice")),
        ...simCols,
      ];
    case "valve":
      return [
        textColumn("label", { header: translate("label") }),
        filterableSelectColumn("kind", {
          header: translate("valveType"),
          options: valveKinds.map((k) => ({
            value: k,
            label: k.toUpperCase(),
          })),
        }),
        numericCol("setting", translate("setting")),
        filterableSelectColumn("initialStatus", {
          header: translate("initialStatus"),
          options: valveStatuses.map((s) => ({
            value: s,
            label: translate(`valve.${s}`),
          })),
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
        textColumn("label", { header: translate("label") }),
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
        textColumn("label", { header: translate("label") }),
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
  const { labelManager } = useAtomValue(modelFactoriesAtom);
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
            ? buildSimRow(effectiveTab, id, simulation, translate)
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
    ],
  );

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      if (!effectiveTab) return;
      const editableKeys = [
        ...EDITABLE_NUMERIC_KEYS[effectiveTab],
        ...EDITABLE_SELECT_KEYS[effectiveTab],
      ];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
        if (!oldRow) continue;
        const assetId = newRow.id;

        if (
          typeof newRow.label === "string" &&
          newRow.label !== oldRow.label &&
          labelManager.isLabelAvailable(newRow.label, effectiveTab, assetId)
        ) {
          transact(
            changeLabel(hydraulicModel, { assetId, newLabel: newRow.label }),
          );
        }

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
    [effectiveTab, hydraulicModel, labelManager, transact],
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
            resizable
          />
        )}
      </div>
    </TabRoot>
  );
});
