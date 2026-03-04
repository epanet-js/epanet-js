import {
  memo,
  useState,
  useMemo,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  showPanelBottomAtom,
  splitsAtom,
  TabOption,
  tabAtom,
  dialogAtom,
  bottomSidebarOpenAtom,
  bottomSidebarMaximizedAtom,
  bottomSidebarActiveTabAtom,
  LeftPanelId,
  stagingModelAtom,
  simulationResultsAtom,
  selectionAtom,
} from "src/state/jotai";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Link } from "src/hydraulic-model/asset-types/link";
import { MapContext } from "src/map";
import { useAtom, useAtomValue } from "jotai";
import {
  CloseIcon,
  Maximize2Icon,
  Minimize2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "src/icons";
import clsx from "clsx";

import FeatureEditor from "src/components/panels/feature-editor";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { MapStylingEditor } from "./map-styling-editor";
import { NetworkReview } from "./network-review";
import { ActivityBar } from "src/components/activity-bar";
import { SelectionListPanel } from "./selection-list";
import { ThemesPanel } from "./themes";
import { ScenariosPanel } from "./scenarios";

function Tab({
  onClick,
  active,
  label,
  ...attributes
}: {
  onClick: () => void;
  active: boolean;
  label: React.ReactNode;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      role="tab"
      onClick={onClick}
      aria-selected={active}
      className={clsx(
        "text-left text-sm py-1 px-3 focus:outline-none",
        active
          ? "text-black dark:text-white"
          : `
          bg-gray-100 dark:bg-gray-900
          border-b
          border-gray-200 dark:border-black
          text-gray-500 dark:text-gray-400
          hover:text-black dark:hover:text-gray-200
          focus:text-black`,
      )}
      {...attributes}
    >
      {label}
    </button>
  );
}

const ActiveTab = memo(function ActiveTab({
  activeTab,
}: {
  activeTab: TabOption;
}) {
  switch (activeTab) {
    case TabOption.Asset:
      return <FeatureEditor />;
    case TabOption.Map:
      return <MapStylingEditor />;
  }
});

const TabList = memo(function TabList({
  setTab,
  activeTab,
}: {
  activeTab: TabOption;
  setTab: React.Dispatch<React.SetStateAction<TabOption>>;
}) {
  const translate = useTranslate();
  return (
    <div
      role="tablist"
      style={{
        gridTemplateColumns: `repeat(2, 1fr) min-content`,
      }}
      className="flex-0 grid h-8 flex-none
      sticky top-0 z-10
      bg-white dark:bg-gray-800
      divide-x divide-gray-200 dark:divide-black"
    >
      <Tab
        onClick={() => setTab(TabOption.Asset)}
        active={activeTab === TabOption.Asset}
        label={translate("asset")}
      />
      <Tab
        onClick={() => setTab(TabOption.Map)}
        active={activeTab === TabOption.Map}
        label={translate("map")}
      />
    </div>
  );
});

export const SidePanel = memo(function SidePanelInner() {
  const splits = useAtomValue(splitsAtom);
  if (!splits.rightOpen) return null;
  return (
    <div
      style={{ width: splits.right }}
      className="absolute right-0 top-0 bottom-0 z-10 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-900"
    >
      <Panel />
    </div>
  );
});

export const BottomPanel = memo(function BottomPanelInner() {
  const splits = useAtomValue(splitsAtom);
  const showPanel = useAtomValue(showPanelBottomAtom);
  if (!showPanel) return null;
  return (
    <div
      style={{
        height: splits.bottom,
      }}
      className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-900 relative"
    >
      <Panel />
    </div>
  );
});

export const FullPanel = memo(function FullPanelInner() {
  return (
    <div className="flex flex-auto bg-white dark:bg-gray-800 relative">
      <Panel />
    </div>
  );
});

export const Panel = memo(function PanelInner() {
  const [activeTab, setTab] = useAtom(tabAtom);
  const dialog = useAtomValue(dialogAtom);

  if (dialog && dialog.type === "welcome") return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <TabList activeTab={activeTab} setTab={setTab} />
      <DefaultErrorBoundary>
        <ActiveTab activeTab={activeTab} />
      </DefaultErrorBoundary>
    </div>
  );
});

const LeftPanelContent = memo(function LeftPanelContentInner({
  activePanel,
}: {
  activePanel: LeftPanelId;
}) {
  switch (activePanel) {
    case "networkReview":
      return <NetworkReview />;
    case "selection":
      return <SelectionListPanel />;
    case "themes":
      return <ThemesPanel />;
    case "scenarios":
      return <ScenariosPanel />;
  }
});

export const LeftSidePanel = memo(function LeftSidePanelInner() {
  const splits = useAtomValue(splitsAtom);

  return (
    <div
      className={clsx(
        "absolute left-0 top-0 bottom-0 z-10 flex bg-white dark:bg-gray-800",
        !splits.leftOpen && "border-r border-gray-200 dark:border-gray-900",
      )}
    >
      <ActivityBar />
      {splits.leftOpen && (
        <div
          style={{ width: splits.left }}
          className="flex-none relative border-r border-gray-200 dark:border-gray-900"
        >
          <DefaultErrorBoundary>
            <LeftPanelContent activePanel={splits.activeLeftPanel} />
          </DefaultErrorBoundary>
        </div>
      )}
    </div>
  );
});

type AssetRow = {
  id: number;
  label: string;
  type: string;
  // present on most assets
  isActive?: boolean;
  // junction, tank, reservoir
  elevation?: number;
  // junction only
  emitterCoefficient?: number;
  // pipe / valve / tank
  diameter?: number;
  // pipe only
  length?: number;
  roughness?: number;
  // pipe / valve
  minorLoss?: number;
  // pipe / valve / pump
  initialStatus?: string;
  // simulation — links (pipe, valve, pump)
  flow?: number | null;
  velocity?: number | null;
  headloss?: number | null;
  // simulation — nodes (junction, tank, reservoir)
  pressure?: number | null;
  head?: number | null;
  // simulation — junctions
  demand?: number | null;
  // simulation — tanks
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

// ── Assets table: sort + filter ──────────────────────────────────────────────

type SortField = AssetRowKey;
type SortDirection = "asc" | "desc";
type AssetFieldType = "text" | "enum" | "boolean" | "number" | "date";

type AssetFieldDef = {
  key: AssetRowKey;
  label: string;
  fieldType: AssetFieldType;
  // Static enum values; if omitted on an "enum" field, values are derived dynamically.
  enumValues?: string[];
};

type AssetCondition = {
  id: string;
  field: AssetRowKey;
  op: string;
  value: string;
};

// "Label" and "Type" are always pinned first, separated from the rest by a divider.
const ASSET_PRIORITY_FIELDS: AssetFieldDef[] = [
  { key: "label", label: "Label", fieldType: "text" },
  { key: "type", label: "Type", fieldType: "enum" },
];

// All other filterable attributes, alphabetically.
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

// ── Per-type display columns ──────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

function useFlyToAsset() {
  const mapEngine = useContext(MapContext);
  const hydraulicModel = useAtomValue(stagingModelAtom);
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

      // Offset the fly-to center so the asset appears in the visible map area,
      // not obscured by any open sidebar panels.
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
  // For "type", use dynamic distinct values; for fields with static enumValues, use those.
  const enumOptions =
    fieldDef.enumValues ??
    (condition.field === "type" ? distinctTypeValues : []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 border-t border-gray-100 dark:border-gray-700/50">
      {/* Field selector — priority fields always enabled; extras disabled when not in filtered result */}
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

      {/* Operator selector */}
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

      {/* Value control — depends on field type */}
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

function AssetsTable() {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const simulationResults = useAtomValue(simulationResultsAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const flyToAsset = useFlyToAsset();
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // Sort — default: type asc
  const [sortField, setSortField] = useState<SortField>("type");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Filter conditions
  const [conditions, setConditions] = useState<AssetCondition[]>([]);

  // All assets — expanded with type-specific fields and simulation results
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
        // pipe / valve / tank
        diameter:
          a.type === "pipe" || a.type === "valve" || a.type === "tank"
            ? (p.diameter as number | undefined)
            : undefined,
        // pipe only
        length:
          a.type === "pipe" ? (p.length as number | undefined) : undefined,
        roughness:
          a.type === "pipe" ? (p.roughness as number | undefined) : undefined,
        // pipe / valve
        minorLoss:
          a.type === "pipe" || a.type === "valve"
            ? (p.minorLoss as number | undefined)
            : undefined,
        // pipe / valve / pump
        initialStatus:
          a.type === "pipe" || a.type === "valve" || a.type === "pump"
            ? (p.initialStatus as string | undefined)
            : undefined,
        // junction / tank / reservoir
        elevation:
          a.type === "junction" || a.type === "tank" || a.type === "reservoir"
            ? (p.elevation as number | undefined)
            : undefined,
        // junction only
        emitterCoefficient:
          a.type === "junction"
            ? (p.emitterCoefficient as number | undefined)
            : undefined,
        // simulation — links
        flow: simPipe?.flow ?? simValve?.flow ?? simPump?.flow ?? undefined,
        velocity: simPipe?.velocity ?? simValve?.velocity ?? undefined,
        headloss:
          simPipe?.headloss ??
          simValve?.headloss ??
          simPump?.headloss ??
          undefined,
        // simulation — nodes
        pressure:
          simJunction?.pressure ??
          simTank?.pressure ??
          simReservoir?.pressure ??
          undefined,
        head:
          simJunction?.head ?? simTank?.head ?? simReservoir?.head ?? undefined,
        // simulation — junctions
        demand: simJunction?.demand ?? undefined,
        // simulation — tanks
        level: simTank?.level ?? undefined,
        volume: simTank?.volume ?? undefined,
      };
    });
  }, [hydraulicModel, simulationResults]);

  // Distinct type values present in the model (for the "type" enum filter)
  const distinctTypeValues = useMemo(
    () => [...new Set(assets.map((a) => a.type))].sort(),
    [assets],
  );

  // Filter then sort
  const filteredAssets = useMemo(
    () => applyAssetConditions(assets, conditions),
    [assets, conditions],
  );
  const displayedAssets = useMemo(
    () => sortAssetRows(filteredAssets, sortField, sortDir),
    [filteredAssets, sortField, sortDir],
  );

  // Detect when all filtered rows share a single type → use type-specific columns
  const singleType = useMemo(() => {
    if (filteredAssets.length === 0) return null;
    const first = filteredAssets[0].type;
    return filteredAssets.every((r) => r.type === first) ? first : null;
  }, [filteredAssets]);

  const columns =
    singleType != null
      ? (COLUMNS_BY_TYPE[singleType] ?? DEFAULT_COLUMNS)
      : DEFAULT_COLUMNS;

  // Reset sort to "label" when the column set changes
  useEffect(() => {
    setSortField("label");
    setSortDir("asc");
  }, [singleType]);

  // Extra fields are available when at least one asset in the network has a value.
  // Priority fields (label, type) are always available.
  // Computed from the full asset list — independent of active filters.
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

  // Scroll to selected row when selection changes
  useEffect(() => {
    if (selection.type !== "single") return;
    tbodyRef.current
      ?.querySelector<HTMLTableRowElement>(`[data-id="${selection.id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selection]);

  // Toggle sort on column header click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const addCondition = () => {
    const def = ASSET_PRIORITY_FIELDS[0]; // default to "label"
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
      {/* ── Filter panel ─────────────────────────────────────────────────── */}
      <div className="flex-none border-b border-gray-200 dark:border-gray-700">
        {/* Header bar */}
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

        {/* Condition rows */}
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

      {/* ── Table ────────────────────────────────────────────────────────── */}
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
}

type BottomTab = "assets" | "warnings" | "errors";

export const HorizontalBottomSidebar = memo(function HorizontalBottomSidebar() {
  const [open, setOpen] = useAtom(bottomSidebarOpenAtom);
  const [maximized, setMaximized] = useAtom(bottomSidebarMaximizedAtom);
  const [activeTab, setActiveTab] = useAtom(bottomSidebarActiveTabAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const assetCount = hydraulicModel.assets.size;

  const handleTabClick = (id: BottomTab) => {
    if (activeTab === id && open) {
      setOpen(false);
    } else {
      setActiveTab(id);
      setOpen(true);
    }
  };

  return (
    <div
      className={clsx(
        "absolute bottom-0 flex flex-col",
        "border-l border-t border-gray-200 dark:border-gray-900",
        "bg-white dark:bg-gray-800",
        open && (maximized ? "top-0" : "h-[33dvh] max-h-[400px]"),
      )}
      style={{
        left: "var(--sidebar-left, 0px)",
        right: "var(--sidebar-right, 0px)",
      }}
    >
      <header
        className={clsx(
          "bottom-sidebar-header flex items-stretch h-8 flex-none bg-white dark:bg-gray-800",
          open && "border-b border-gray-200 dark:border-black",
        )}
      >
        <div role="tablist" className="flex flex-1">
          {(
            [
              { id: "assets", label: "Assets", count: assetCount },
              { id: "warnings", label: "Warnings", count: 0 },
              { id: "errors", label: "Errors", count: 0 },
            ] satisfies { id: BottomTab; label: string; count: number }[]
          ).map(({ id, label, count }) => (
            <button
              key={id}
              role="tab"
              aria-selected={open && activeTab === id}
              onClick={() => handleTabClick(id)}
              className={clsx(
                "px-3 text-sm focus:outline-none h-full flex items-center border-b-2 text-nowrap",
                open && activeTab === id
                  ? "border-purple-500 text-gray-900 dark:text-white"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              )}
            >
              {label}
              <span className="ml-1.5 text-sm font-normal text-gray-400 dark:text-gray-500">
                ({count})
              </span>
            </button>
          ))}
        </div>
        {open && (
          <div className="flex items-center gap-0.5 px-1">
            <button
              aria-label={maximized ? "minimize-2" : "maximize-2"}
              onClick={() => setMaximized((v) => !v)}
              className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
            </button>
          </div>
        )}
      </header>
      {open && (
        <div className="bottom-sidebar-content flex-auto overflow-auto overscroll-none">
          {activeTab === "assets" && <AssetsTable />}
          {activeTab === "warnings" && (
            <div className="p-4 text-sm text-gray-400 dark:text-gray-500">
              No warnings
            </div>
          )}
          {activeTab === "errors" && (
            <div className="p-4 text-sm text-gray-400 dark:text-gray-500">
              No errors
            </div>
          )}
        </div>
      )}
    </div>
  );
});
