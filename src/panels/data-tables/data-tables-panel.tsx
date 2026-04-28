import { memo, useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import clsx from "clsx";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
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
import { useTranslate } from "src/hooks/use-translate";

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
  pipe: ["length", "diameter", "roughness", "minorLoss"],
  pump: [],
  valve: ["diameter", "setting"],
  reservoir: ["head"],
  tank: ["elevation", "initialLevel", "minLevel", "maxLevel", "diameter"],
};

function buildColumns(
  type: AssetType,
  translate: ReturnType<typeof useTranslate>,
): GridColumn[] {
  const editable = new Set(EDITABLE_NUMERIC_KEYS[type]);

  const numericCol = (key: string, header: string) =>
    editable.has(key)
      ? floatColumn(key, { header })
      : textReadonlyColumn(key, { header });

  switch (type) {
    case "junction":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("elevation", translate("elevation")),
        numericCol("emitterCoefficient", translate("emitterCoefficient")),
        numericCol("initialQuality", translate("initialQuality")),
      ];
    case "pipe":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("length", translate("length")),
        numericCol("diameter", translate("diameter")),
        numericCol("roughness", translate("roughness")),
        numericCol("minorLoss", translate("minorLoss")),
        textReadonlyColumn("initialStatus", {
          header: translate("initialStatus"),
        }),
      ];
    case "pump":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        textReadonlyColumn("initialStatus", {
          header: translate("initialStatus"),
        }),
      ];
    case "valve":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        textReadonlyColumn("kind", { header: "Type" }),
        numericCol("diameter", translate("diameter")),
        numericCol("setting", "Setting"),
        textReadonlyColumn("initialStatus", {
          header: translate("initialStatus"),
        }),
      ];
    case "reservoir":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("head", translate("head")),
      ];
    case "tank":
      return [
        textReadonlyColumn("label", { header: translate("label") }),
        numericCol("elevation", translate("elevation")),
        numericCol("initialLevel", translate("initialLevel")),
        numericCol("minLevel", translate("minLevel")),
        numericCol("maxLevel", translate("maxLevel")),
        numericCol("diameter", translate("diameter")),
      ];
  }
}

function assetToRow(asset: {
  id: AssetId;
  feature: { properties: Record<string, unknown> };
}): AssetRow {
  return { id: asset.id, ...asset.feature.properties };
}

function Tab({
  onClick,
  active,
  label,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      role="tab"
      onClick={onClick}
      aria-selected={active}
      className={clsx(
        "text-left text-sm py-1 px-3 focus:outline-none",
        active
          ? "text-black dark:text-white"
          : `bg-gray-100 dark:bg-gray-900
             border-b border-gray-200 dark:border-black
             text-gray-500 dark:text-gray-400
             hover:text-black dark:hover:text-gray-200
             focus:text-black`,
      )}
    >
      {label}
    </button>
  );
}

export const DataTablesPanel = memo(function DataTablesPanelInner() {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();

  const assetsByType = useMemo(() => {
    const map = new Map<AssetType, AssetRow[]>();
    for (const type of ASSET_TYPES) {
      const rows: AssetRow[] = [];
      for (const asset of hydraulicModel.assets.values()) {
        if (asset.type === type) {
          rows.push(assetToRow(asset));
        }
      }
      if (rows.length > 0) map.set(type, rows);
    }
    return map;
  }, [hydraulicModel.assets]);

  const presentTypes = useMemo(
    () => ASSET_TYPES.filter((t) => assetsByType.has(t)),
    [assetsByType],
  );

  const [activeTab, setActiveTab] = useState<AssetType | null>(
    () => presentTypes[0] ?? null,
  );

  const effectiveTab =
    activeTab && assetsByType.has(activeTab)
      ? activeTab
      : (presentTypes[0] ?? null);

  const rows = effectiveTab ? (assetsByType.get(effectiveTab) ?? []) : [];

  const columns = useMemo(
    () => (effectiveTab ? buildColumns(effectiveTab, translate) : []),
    [effectiveTab, translate],
  );

  const onChange = useCallback(
    (newRows: AssetRow[]) => {
      if (!effectiveTab) return;
      const editableKeys = EDITABLE_NUMERIC_KEYS[effectiveTab];
      for (let i = 0; i < newRows.length; i++) {
        const newRow = newRows[i];
        const oldRow = rows[i];
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
    <div className="absolute inset-0 flex flex-col">
      <div
        role="tablist"
        className="flex h-8 flex-none
          sticky top-0 z-10
          bg-white dark:bg-gray-800
          divide-x divide-gray-200 dark:divide-black
          border-b border-gray-200 dark:border-black
          pr-8"
      >
        {presentTypes.map((type) => (
          <Tab
            key={type}
            onClick={() => setActiveTab(type)}
            active={effectiveTab === type}
            label={translate(ASSET_TYPE_TAB_KEY[type])}
          />
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <DataGrid
          key={effectiveTab}
          data={rows}
          columns={columns}
          onChange={onChange as (data: Record<string, unknown>[]) => void}
          createRow={() => ({}) as Record<string, unknown>}
          gutterColumn={false}
        />
      </div>
    </div>
  );
});
