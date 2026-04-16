// Ported from spike/ui-exploration/activity-bar-and-bottom-sidebar
// Atom remapping: stagingModelAtom → stagingModelDerivedAtom,
//                 simulationResultsAtom → simulationResultsDerivedAtom

import {
  memo,
  useState,
  useMemo,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useAtom, useAtomValue } from "jotai";
import clsx from "clsx";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { splitsAtom } from "src/state/layout";
import {
  bottomSidebarOpenAtom,
  bottomSidebarMaximizedAtom,
} from "src/state/layout";
import { MapContext } from "src/map";
import { CloseIcon, ChevronUpIcon, ChevronDownIcon } from "src/icons";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Link } from "src/hydraulic-model/asset-types/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type AssetRow = {
  id: number;
  label: string;
  type: string;
  isActive?: boolean;
  elevation?: number;
  emitterCoefficient?: number;
  diameter?: number;
  length?: number;
  roughness?: number;
  minorLoss?: number;
  initialStatus?: string;
  flow?: number | null;
  velocity?: number | null;
  headloss?: number | null;
  pressure?: number | null;
  head?: number | null;
  demand?: number | null;
  level?: number | null;
  volume?: number | null;
};
type AssetRowKey = keyof Omit<AssetRow, "id">;

const ASSET_TYPE_LABEL: Record<string, string> = {
  pipe: "Pipe",
  junction: "Junction",
  tank: "Tank",
  reservoir: "Reservoir",
  valve: "Valve",
  pump: "Pump",
};

type SortField = AssetRowKey;
type SortDirection = "asc" | "desc";
type AssetFieldType = "text" | "enum" | "boolean" | "number" | "date";

type AssetFieldDef = {
  key: AssetRowKey;
  label: string;
  fieldType: AssetFieldType;
  enumValues?: string[];
};

type AssetCondition = {
  id: string;
  field: AssetRowKey;
  op: string;
  value: string;
};

const ASSET_PRIORITY_FIELDS: AssetFieldDef[] = [
  { key: "label", label: "Label", fieldType: "text" },
  { key: "type", label: "Type", fieldType: "enum" },
];

const ASSET_EXTRA_FIELDS: AssetFieldDef[] = [
  { key: "demand", label: "Demand", fieldType: "number" },
  { key: "diameter", label: "Diameter", fieldType: "number" },
  { key: "elevation", label: "Elevation", fieldType: "number" },
  { key: "emitterCoefficient", label: "Emitter Coeff.", fieldType: "number" },
  { key: "flow", label: "Flow", fieldType: "number" },
  { key: "head", label: "Head", fieldType: "number" },
  { key: "headloss", label: "Headloss", fieldType: "number" },
  {
    key: "initialStatus",
    label: "Initial Status",
    fieldType: "enum",
    enumValues: ["open", "closed", "cv"],
  },
  { key: "isActive", label: "Is Active", fieldType: "boolean" },
  { key: "length", label: "Length", fieldType: "number" },
  { key: "level", label: "Level", fieldType: "number" },
  { key: "minorLoss", label: "Minor Loss", fieldType: "number" },
  { key: "pressure", label: "Pressure", fieldType: "number" },
  { key: "roughness", label: "Roughness", fieldType: "number" },
  { key: "velocity", label: "Velocity", fieldType: "number" },
  { key: "volume", label: "Volume", fieldType: "number" },
];

const ALL_ASSET_FIELD_DEFS: AssetFieldDef[] = [
  ...ASSET_PRIORITY_FIELDS,
  ...ASSET_EXTRA_FIELDS,
];

const OPS_FOR_FIELD_TYPE: Record<
  AssetFieldType,
  readonly { value: string; label: string }[]
> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "doesn't contain" },
  ],
  enum: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  boolean: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
  ],
  number: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "gt", label: "greater than" },
    { value: "lt", label: "less than" },
  ],
  date: [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "before", label: "before" },
    { value: "after", label: "after" },
  ],
};

function applyAssetConditions(
  rows: AssetRow[],
  conditions: AssetCondition[],
): AssetRow[] {
  return rows.filter((row) =>
    conditions.every((cond) => {
      if (!cond.value) return true;
      const raw = row[cond.field];
      const str = String(raw ?? "").toLowerCase();
      const val = cond.value.toLowerCase();
      switch (cond.op) {
        case "contains":
          return str.includes(val);
        case "not_contains":
          return !str.includes(val);
        case "is":
          return str === val;
        case "is_not":
          return str !== val;
        case "gt":
          return Number(raw) > Number(cond.value);
        case "lt":
          return Number(raw) < Number(cond.value);
        case "before":
          return new Date(str) < new Date(val);
        case "after":
          return new Date(str) > new Date(val);
        default:
          return true;
      }
    }),
  );
}

function sortAssetRows(
  rows: AssetRow[],
  field: SortField,
  dir: SortDirection,
): AssetRow[] {
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
}

type TableColumn = {
  key: AssetRowKey;
  label: string;
  align: "left" | "right";
  unit?: string;
  format: (val: unknown) => string;
};

function fmtNum(val: unknown, decimals = 2): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toFixed(decimals);
}
function fmtBool(val: unknown): string {
  if (val === null || val === undefined) return "—";
  return val ? "Active" : "Inactive";
}
function fmtStr(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

const COL: Record<string, TableColumn> = {
  label: {
    key: "label",
    label: "Label",
    align: "left",
    format: (v) => String(v ?? ""),
  },
  type: {
    key: "type",
    label: "Type",
    align: "left",
    format: (v) => ASSET_TYPE_LABEL[String(v)] ?? String(v),
  },
  isActive: {
    key: "isActive",
    label: "Active",
    align: "left",
    format: fmtBool,
  },
  elevation: {
    key: "elevation",
    label: "Elevation",
    align: "right",
    unit: "m",
    format: fmtNum,
  },
  emitterCoefficient: {
    key: "emitterCoefficient",
    label: "Emitter Coeff",
    align: "right",
    format: (v) => fmtNum(v, 4),
  },
  diameter: {
    key: "diameter",
    label: "Diameter",
    align: "right",
    unit: "mm",
    format: fmtNum,
  },
  length: {
    key: "length",
    label: "Length",
    align: "right",
    unit: "m",
    format: fmtNum,
  },
  roughness: {
    key: "roughness",
    label: "Roughness",
    align: "right",
    format: (v) => fmtNum(v, 4),
  },
  minorLoss: {
    key: "minorLoss",
    label: "Minor Loss",
    align: "right",
    format: (v) => fmtNum(v, 4),
  },
  initialStatus: {
    key: "initialStatus",
    label: "Initial Status",
    align: "left",
    format: fmtStr,
  },
  flow: {
    key: "flow",
    label: "Flow",
    align: "right",
    unit: "L/s",
    format: (v) => fmtNum(v, 3),
  },
  velocity: {
    key: "velocity",
    label: "Velocity",
    align: "right",
    unit: "m/s",
    format: (v) => fmtNum(v, 3),
  },
  headloss: {
    key: "headloss",
    label: "Headloss",
    align: "right",
    unit: "m/km",
    format: (v) => fmtNum(v, 3),
  },
  pressure: {
    key: "pressure",
    label: "Pressure",
    align: "right",
    unit: "m",
    format: fmtNum,
  },
  head: {
    key: "head",
    label: "Head",
    align: "right",
    unit: "m",
    format: fmtNum,
  },
  demand: {
    key: "demand",
    label: "Demand",
    align: "right",
    unit: "L/s",
    format: (v) => fmtNum(v, 3),
  },
  level: {
    key: "level",
    label: "Level",
    align: "right",
    unit: "m",
    format: fmtNum,
  },
  volume: {
    key: "volume",
    label: "Volume",
    align: "right",
    unit: "m³",
    format: fmtNum,
  },
};

const COLUMNS_BY_TYPE: Record<string, TableColumn[]> = {
  junction: [
    COL.label,
    COL.elevation,
    COL.emitterCoefficient,
    COL.isActive,
    COL.pressure,
    COL.head,
    COL.demand,
  ],
  pipe: [
    COL.label,
    COL.diameter,
    COL.length,
    COL.roughness,
    COL.minorLoss,
    COL.initialStatus,
    COL.isActive,
    COL.flow,
    COL.velocity,
    COL.headloss,
  ],
  tank: [
    COL.label,
    COL.elevation,
    COL.diameter,
    COL.isActive,
    COL.pressure,
    COL.head,
    COL.level,
    COL.volume,
  ],
  reservoir: [COL.label, COL.elevation, COL.isActive, COL.pressure, COL.head],
  valve: [
    COL.label,
    COL.diameter,
    COL.minorLoss,
    COL.initialStatus,
    COL.isActive,
    COL.flow,
    COL.velocity,
    COL.headloss,
  ],
  pump: [COL.label, COL.initialStatus, COL.isActive, COL.flow, COL.headloss],
};

const DEFAULT_COLUMNS: TableColumn[] = [COL.label, COL.type];

// ── useFlyToAsset ─────────────────────────────────────────────────────────────

function useFlyToAsset() {
  const mapEngine = useContext(MapContext);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const splits = useAtomValue(splitsAtom);
  const bottomSidebarOpen = useAtomValue(bottomSidebarOpenAtom);
  const bottomSidebarMaximized = useAtomValue(bottomSidebarMaximizedAtom);

  return useCallback(
    (id: number) => {
      if (!mapEngine) return;
      const asset = hydraulicModel.assets.get(id);
      if (!asset) return;

      let center: [number, number];
      if (asset.isLink) {
        const pts = (asset as unknown as Link<unknown>).coordinates;
        const mid = pts[Math.floor(pts.length / 2)];
        center = [mid[0], mid[1]] as [number, number];
      } else {
        const pt = (asset as unknown as Junction).coordinates;
        center = [pt[0], pt[1]] as [number, number];
      }

      const paddingLeft = splits.leftOpen ? 44 + splits.left : 44;
      const paddingRight = splits.rightOpen ? splits.right : 0;
      const paddingBottom =
        bottomSidebarOpen && !bottomSidebarMaximized
          ? Math.min(window.innerHeight * 0.33, 400)
          : 0;

      mapEngine.map.flyTo({
        center,
        zoom: 15,
        duration: 800,
        padding: {
          top: 0,
          bottom: paddingBottom,
          left: paddingLeft,
          right: paddingRight,
        },
      });
    },
    [
      mapEngine,
      hydraulicModel,
      splits,
      bottomSidebarOpen,
      bottomSidebarMaximized,
    ],
  );
}

// ── AssetConditionRow ─────────────────────────────────────────────────────────

const conditionControlCls = clsx(
  "text-sm py-0.5 pl-1.5 rounded border",
  "border-gray-200 dark:border-gray-600",
  "bg-white dark:bg-gray-700",
  "text-gray-700 dark:text-gray-300",
  "focus:outline-none focus:border-blue-400",
);

function AssetConditionRow({
  condition,
  availableFields,
  distinctTypeValues,
  onChangeField,
  onChangeOp,
  onChangeValue,
  onRemove,
}: {
  condition: AssetCondition;
  availableFields: Set<string>;
  distinctTypeValues: string[];
  onChangeField: (field: AssetRowKey) => void;
  onChangeOp: (op: string) => void;
  onChangeValue: (value: string) => void;
  onRemove: () => void;
}) {
  const fieldDef =
    ALL_ASSET_FIELD_DEFS.find((f) => f.key === condition.field) ??
    ASSET_PRIORITY_FIELDS[0];
  const ops = OPS_FOR_FIELD_TYPE[fieldDef.fieldType];
  const enumOptions =
    fieldDef.enumValues ??
    (condition.field === "type" ? distinctTypeValues : []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 border-t border-gray-100 dark:border-gray-700/50">
      <select
        value={condition.field}
        onChange={(e) => onChangeField(e.target.value as AssetRowKey)}
        className={conditionControlCls}
      >
        {ASSET_PRIORITY_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
        <option disabled>──────────</option>
        {ASSET_EXTRA_FIELDS.map((f) => (
          <option
            key={f.key}
            value={f.key}
            disabled={!availableFields.has(f.key)}
          >
            {f.label}
          </option>
        ))}
      </select>
      <select
        value={condition.op}
        onChange={(e) => onChangeOp(e.target.value)}
        className={conditionControlCls}
      >
        {ops.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {fieldDef.fieldType === "enum" && (
        <select
          value={condition.value}
          onChange={(e) => onChangeValue(e.target.value)}
          className={conditionControlCls}
        >
          {enumOptions.map((v) => (
            <option key={v} value={v}>
              {ASSET_TYPE_LABEL[v] ?? v}
            </option>
          ))}
        </select>
      )}
      {fieldDef.fieldType === "boolean" && (
        <select
          value={condition.value}
          onChange={(e) => onChangeValue(e.target.value)}
          className={conditionControlCls}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      )}
      {(fieldDef.fieldType === "text" || fieldDef.fieldType === "number") && (
        <input
          type={fieldDef.fieldType === "number" ? "number" : "text"}
          value={condition.value}
          onChange={(e) => onChangeValue(e.target.value)}
          placeholder="value…"
          className={clsx(conditionControlCls, "min-w-[5rem] flex-1")}
        />
      )}
      {fieldDef.fieldType === "date" && (
        <input
          type="date"
          value={condition.value}
          onChange={(e) => onChangeValue(e.target.value)}
          className={conditionControlCls}
        />
      )}
      <button
        onClick={onRemove}
        aria-label="Remove condition"
        className="ml-auto flex-shrink-0 p-0.5 text-gray-400 hover:text-red-500"
      >
        <CloseIcon size="sm" />
      </button>
    </div>
  );
}

// ── AssetsTable ───────────────────────────────────────────────────────────────

export const AssetsTable = memo(function AssetsTable() {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulationResults = useAtomValue(simulationResultsDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const flyToAsset = useFlyToAsset();
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const [sortField, setSortField] = useState<SortField>("type");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [conditions, setConditions] = useState<AssetCondition[]>([]);

  const assets = useMemo<AssetRow[]>(() => {
    return Array.from(hydraulicModel.assets.values()).map((a) => {
      const p = a as unknown as Record<string, unknown>;
      const simPipe =
        a.type === "pipe" ? (simulationResults?.getPipe(a.id) ?? null) : null;
      const simValve =
        a.type === "valve" ? (simulationResults?.getValve(a.id) ?? null) : null;
      const simPump =
        a.type === "pump" ? (simulationResults?.getPump(a.id) ?? null) : null;
      const simJunction =
        a.type === "junction"
          ? (simulationResults?.getJunction(a.id) ?? null)
          : null;
      const simTank =
        a.type === "tank" ? (simulationResults?.getTank(a.id) ?? null) : null;
      const simReservoir =
        a.type === "reservoir"
          ? (simulationResults?.getReservoir(a.id) ?? null)
          : null;
      return {
        id: a.id,
        label: a.label,
        type: a.type,
        isActive: p.isActive as boolean | undefined,
        diameter:
          a.type === "pipe" || a.type === "valve" || a.type === "tank"
            ? (p.diameter as number | undefined)
            : undefined,
        length:
          a.type === "pipe" ? (p.length as number | undefined) : undefined,
        roughness:
          a.type === "pipe" ? (p.roughness as number | undefined) : undefined,
        minorLoss:
          a.type === "pipe" || a.type === "valve"
            ? (p.minorLoss as number | undefined)
            : undefined,
        initialStatus:
          a.type === "pipe" || a.type === "valve" || a.type === "pump"
            ? (p.initialStatus as string | undefined)
            : undefined,
        elevation:
          a.type === "junction" || a.type === "tank" || a.type === "reservoir"
            ? (p.elevation as number | undefined)
            : undefined,
        emitterCoefficient:
          a.type === "junction"
            ? (p.emitterCoefficient as number | undefined)
            : undefined,
        flow: simPipe?.flow ?? simValve?.flow ?? simPump?.flow ?? undefined,
        velocity: simPipe?.velocity ?? simValve?.velocity ?? undefined,
        headloss:
          simPipe?.headloss ??
          simValve?.headloss ??
          simPump?.headloss ??
          undefined,
        pressure:
          simJunction?.pressure ??
          simTank?.pressure ??
          simReservoir?.pressure ??
          undefined,
        head:
          simJunction?.head ?? simTank?.head ?? simReservoir?.head ?? undefined,
        demand: simJunction?.demand ?? undefined,
        level: simTank?.level ?? undefined,
        volume: simTank?.volume ?? undefined,
      };
    });
  }, [hydraulicModel, simulationResults]);

  const distinctTypeValues = useMemo(
    () => [...new Set(assets.map((a) => a.type))].sort(),
    [assets],
  );

  const filteredAssets = useMemo(
    () => applyAssetConditions(assets, conditions),
    [assets, conditions],
  );
  const displayedAssets = useMemo(
    () => sortAssetRows(filteredAssets, sortField, sortDir),
    [filteredAssets, sortField, sortDir],
  );

  const singleType = useMemo(() => {
    if (filteredAssets.length === 0) return null;
    const first = filteredAssets[0].type;
    return filteredAssets.every((r) => r.type === first) ? first : null;
  }, [filteredAssets]);

  const columns =
    singleType != null
      ? (COLUMNS_BY_TYPE[singleType] ?? DEFAULT_COLUMNS)
      : DEFAULT_COLUMNS;

  useEffect(() => {
    setSortField("label");
    setSortDir("asc");
  }, [singleType]);

  const availableFields = useMemo(() => {
    const set = new Set<string>(ASSET_PRIORITY_FIELDS.map((f) => f.key));
    for (const row of assets) {
      for (const f of ASSET_EXTRA_FIELDS) {
        const v = row[f.key];
        if (v !== undefined && v !== null) set.add(f.key);
      }
    }
    return set;
  }, [assets]);

  useEffect(() => {
    if (selection.type !== "single") return;
    tbodyRef.current
      ?.querySelector<HTMLTableRowElement>(`[data-id="${selection.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const addCondition = () => {
    const def = ASSET_PRIORITY_FIELDS[0];
    setConditions((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        field: def.key,
        op: OPS_FOR_FIELD_TYPE[def.fieldType][0].value,
        value: "",
      },
    ]);
  };

  const removeCondition = (id: string) =>
    setConditions((prev) => prev.filter((c) => c.id !== id));

  const changeConditionField = (id: string, field: AssetRowKey) => {
    const def =
      ALL_ASSET_FIELD_DEFS.find((f) => f.key === field) ??
      ASSET_PRIORITY_FIELDS[0];
    const defaultOp = OPS_FOR_FIELD_TYPE[def.fieldType][0].value;
    const defaultValue =
      def.fieldType === "enum"
        ? (def.enumValues?.[0] ?? distinctTypeValues[0] ?? "")
        : def.fieldType === "boolean"
          ? "true"
          : "";
    setConditions((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, field, op: defaultOp, value: defaultValue } : c,
      ),
    );
  };

  if (assets.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-400 dark:text-gray-500">
        No assets in model
      </div>
    );
  }

  const selectedId = selection.type === "single" ? selection.id : null;

  const actionBtnCls = clsx(
    "text-sm px-2 py-0.5 rounded border",
    "border-gray-200 dark:border-gray-600",
    "text-gray-500 dark:text-gray-400",
    "hover:text-gray-700 dark:hover:text-gray-200",
  );

  return (
    <div className="flex flex-col h-full">
      {/* Filter panel */}
      <div className="flex-none border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 px-3 h-9">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter
          </span>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            ({filteredAssets.length})
          </span>
          <button
            onClick={addCondition}
            className={clsx(
              "text-sm px-2 py-0.5 rounded border",
              "border-purple-300 dark:border-purple-600",
              "text-purple-600 dark:text-purple-400",
              "hover:bg-purple-50 dark:hover:bg-purple-900/20",
            )}
          >
            + Add condition
          </button>
          <div className="flex-1" />
          <button className={actionBtnCls}>Load</button>
          <button className={actionBtnCls}>Save</button>
        </div>
        {conditions.map((cond) => (
          <AssetConditionRow
            key={cond.id}
            condition={cond}
            availableFields={availableFields}
            distinctTypeValues={distinctTypeValues}
            onChangeField={(field) => changeConditionField(cond.id, field)}
            onChangeOp={(op) =>
              setConditions((prev) =>
                prev.map((c) => (c.id === cond.id ? { ...c, op } : c)),
              )
            }
            onChangeValue={(value) =>
              setConditions((prev) =>
                prev.map((c) => (c.id === cond.id ? { ...c, value } : c)),
              )
            }
            onRemove={() => removeCondition(cond.id)}
          />
        ))}
      </div>

      {/* Table */}
      <div className="flex-auto overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={clsx(
                    "sticky top-0 z-10 h-8 bg-gray-50 dark:bg-gray-900 px-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-200 dark:border-gray-700 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <div
                    className={clsx(
                      "flex items-center gap-1",
                      col.align === "right" && "justify-end",
                    )}
                  >
                    {col.label}
                    {col.unit && (
                      <span className="font-normal text-gray-400 dark:text-gray-500">
                        ({col.unit})
                      </span>
                    )}
                    {sortField === col.key &&
                      (sortDir === "asc" ? (
                        <ChevronUpIcon size="sm" />
                      ) : (
                        <ChevronDownIcon size="sm" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {displayedAssets.map((row) => {
              const isSelected = selectedId === row.id;
              return (
                <tr
                  key={row.id}
                  data-id={row.id}
                  onClick={() => {
                    setSelection({ type: "single", id: row.id, parts: [] });
                    flyToAsset(row.id);
                  }}
                  className={clsx(
                    "border-b border-gray-100 dark:border-gray-800 cursor-pointer",
                    isSelected
                      ? "bg-blue-100 dark:bg-blue-900/40"
                      : "hover:bg-blue-50 dark:hover:bg-gray-700/50",
                  )}
                >
                  {columns.map((col) => {
                    const raw = row[col.key];
                    const display = col.format(raw);
                    return (
                      <td
                        key={col.key}
                        className={clsx(
                          "px-3 py-1.5 whitespace-nowrap",
                          col.align === "right"
                            ? "text-right tabular-nums"
                            : "text-left",
                          col.key === "label"
                            ? "font-medium text-gray-900 dark:text-white"
                            : col.key === "isActive" && raw === false
                              ? "text-red-500"
                              : display === "—"
                                ? "text-gray-300 dark:text-gray-600"
                                : "text-gray-700 dark:text-gray-300",
                        )}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
