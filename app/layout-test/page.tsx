"use client";

import {
  useState,
  useCallback,
  useRef,
  useMemo,
  memo,
  startTransition,
  useEffect,
} from "react";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import { LayoutTestProviders } from "./providers";
import FeatureEditor from "src/panels/feature-editor";
import { MapStylingEditor } from "src/panels/map-styling-editor";
import { AssetsTable } from "src/components/bottom-sidebar/assets-table";
import { NetworkReview } from "src/panels/network-review";
import {
  selectedFeaturesDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { dialogAtom } from "src/state/dialog";
import { Formik, Form } from "formik";
import { SimulationSettingsSidebar } from "src/dialogs/simulation-settings/simulation-settings-sidebar";
import {
  SimulationSettingsContent,
  SettingsSection,
  GeneralSection,
  TimesSection,
  DemandsSection,
  HydraulicsSection,
  WaterQualitySection,
  EnergySection,
} from "src/dialogs/simulation-settings/simulation-settings-content";
import { useScrollSpy } from "src/dialogs/simulation-settings/use-scroll-spy";
import {
  buildSectionIds,
  buildInitialValues,
  hasChanges,
  buildUpdatedSettings,
} from "src/dialogs/simulation-settings/simulation-settings-data";
import type { FormValues } from "src/dialogs/simulation-settings/simulation-settings-data";
import { useQuickGraph } from "src/panels/asset-panel/quick-graph";
import type { QuickGraphAssetType } from "src/state/quick-graph";
import type { Asset } from "src/hydraulic-model/asset-types";
import { MenuBarPlay } from "src/components/menu-bar";
import { Toolbar } from "src/toolbar/toolbar";
import { Footer } from "src/components/footer/footer";
import { MapCanvas } from "src/map/map-canvas";
import { MapContext } from "src/map";
import type { MapEngine } from "src/map";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  Active,
  Over,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ───────────────────────────────────────────────────────────────────

type Zone = "left" | "center" | "right" | "bottom";
type TabbedZone = Exclude<Zone, "center">;
type DropEdge = "top" | "bottom" | "left" | "right";

type LayoutNode =
  | { type: "panel"; panelId: string }
  | {
      type: "split";
      id: string;
      direction: "row" | "col";
      children: LayoutNode[];
      sizes: number[];
    };

interface Panel {
  id: string;
  title: string;
  description: string;
  component?: React.ComponentType;
}

type PanelLayout = Record<string, Zone>;

// ─── Alpha Panel (Quick Graph) ───────────────────────────────────────────────

const QUICK_GRAPH_TYPES = new Set<string>([
  "junction",
  "pipe",
  "pump",
  "valve",
  "tank",
  "reservoir",
]);

function AlphaGraphContent({
  assetId,
  assetType,
}: {
  assetId: number;
  assetType: QuickGraphAssetType;
}) {
  const { footer } = useQuickGraph(assetId, assetType);
  if (!footer) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-400">
        Run a simulation to view the time series graph
      </div>
    );
  }
  return <div className="h-full flex flex-col overflow-hidden">{footer}</div>;
}

function AlphaPanel() {
  const selectedFeatures = useAtomValue(selectedFeaturesDerivedAtom);
  const asset =
    selectedFeatures.length === 1 ? (selectedFeatures[0] as Asset) : null;
  const validAsset = asset && QUICK_GRAPH_TYPES.has(asset.type) ? asset : null;

  if (!validAsset) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-400">
        Select an asset to view the time series graph
      </div>
    );
  }

  return (
    <AlphaGraphContent
      assetId={validAsset.id}
      assetType={validAsset.type as QuickGraphAssetType}
    />
  );
}

// ─── Simulation Settings Panel ────────────────────────────────────────────────

function SimulationSettingsPanel() {
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const setSimulationSettings = useSetAtom(simulationSettingsDerivedAtom);
  const [projectSettings, setProjectSettings] = useAtom(projectSettingsAtom);

  const sectionIds = useMemo(buildSectionIds, []);
  const { activeSection, scrollToSection, scrollContainerRef } =
    useScrollSpy(sectionIds);

  const initialValues = useMemo(
    () => buildInitialValues(simulationSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSubmit = useCallback(
    (values: FormValues) => {
      if (hasChanges(values, simulationSettings)) {
        setSimulationSettings(buildUpdatedSettings(values, simulationSettings));
      }
      if (
        values.qualityMassUnit !== projectSettings.units.chemicalConcentration
      ) {
        setProjectSettings({
          ...projectSettings,
          units: {
            ...projectSettings.units,
            chemicalConcentration: values.qualityMassUnit,
          },
        });
      }
    },
    [
      simulationSettings,
      setSimulationSettings,
      projectSettings,
      setProjectSettings,
    ],
  );

  return (
    <Formik onSubmit={handleSubmit} initialValues={initialValues}>
      {({ submitForm, isSubmitting }) => (
        <Form className="flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex flex-1 min-h-0">
            <SimulationSettingsSidebar
              activeSection={activeSection}
              onSelectSection={scrollToSection}
            />
            <div className="border-l border-gray-200 flex-1 flex flex-col min-h-0">
              <SimulationSettingsContent ref={scrollContainerRef}>
                <SettingsSection sectionId="general">
                  <GeneralSection />
                </SettingsSection>
                <SettingsSection sectionId="times">
                  <TimesSection />
                </SettingsSection>
                <SettingsSection sectionId="demands">
                  <DemandsSection />
                </SettingsSection>
                <SettingsSection sectionId="hydraulics">
                  <HydraulicsSection />
                </SettingsSection>
                <SettingsSection sectionId="waterQuality">
                  <WaterQualitySection />
                </SettingsSection>
                <SettingsSection sectionId="energy">
                  <EnergySection />
                </SettingsSection>
              </SimulationSettingsContent>
            </div>
          </div>
          <div className="shrink-0 flex justify-end px-3 py-2 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={submitForm}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PANELS: Panel[] = [
  {
    id: "map",
    title: "Map",
    description:
      "Interactive network map showing nodes, pipes, and simulation results.",
  },
  {
    id: "feature-editor",
    title: "Feature",
    description: "Properties editor for the selected network asset.",
    component: FeatureEditor,
  },
  {
    id: "map-styling",
    title: "Styling",
    description: "Map symbology, color rules, and layer visibility.",
    component: MapStylingEditor,
  },
  {
    id: "alpha",
    title: "Alpha",
    description:
      "Overview of network topology and active node connections across the current simulation run.",
    component: AlphaPanel,
  },
  {
    id: "network-review",
    title: "Network",
    description:
      "Network topology checks: orphan assets, crossing pipes, proximity anomalies.",
    component: NetworkReview,
  },
  {
    id: "delta",
    title: "Delta",
    description:
      "Demand patterns assigned to nodes. Editable multipliers adjust baseline consumption over time.",
  },
  {
    id: "echo",
    title: "Echo",
    description:
      "Reservoir and tank levels throughout the simulation. Tracks fill and drain cycles per interval.",
  },
  {
    id: "assets",
    title: "Assets",
    description:
      "All network assets with filtering, sorting, and simulation results.",
    component: AssetsTable,
  },
  {
    id: "foxtrot",
    title: "Foxtrot",
    description:
      "Water quality results including chlorine residual decay along the distribution network.",
  },
  {
    id: "golf",
    title: "Golf",
    description:
      "Pump operating schedules and energy consumption. Efficiency curves shown per pump asset.",
  },
  {
    id: "simulation-settings",
    title: "Settings",
    description: "Simulation settings.",
    component: SimulationSettingsPanel,
  },
];

const INITIAL_LAYOUT: PanelLayout = {
  map: "center",
  alpha: "center",
  bravo: "center",
  "network-review": "left",
  charlie: "left",
  delta: "left",
  "feature-editor": "right",
  "map-styling": "right",
  echo: "right",
  assets: "bottom",
  foxtrot: "bottom",
  golf: "bottom",
  hotel: "center",
};

// Zone droppable ids — everything else is a panel-level droppable
// Zone droppable ids — used to distinguish zone drops from panel-id drops
const ZONE_IDS = new Set(["left", "right", "center", "bottom"]);

const ZONE_LABELS: Record<Zone, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  bottom: "Bottom",
};

// ─── Layout Tree Helpers ──────────────────────────────────────────────────────

let _splitSeq = 0;
const nextSplitId = () => `sp${++_splitSeq}`;

function equalSizes(n: number): number[] {
  return Array.from({ length: n }, () => 100 / n);
}

function makeSplit(
  direction: "row" | "col",
  children: LayoutNode[],
): LayoutNode {
  return {
    type: "split",
    id: nextSplitId(),
    direction,
    children,
    sizes: equalSizes(children.length),
  };
}

function buildInitialTree(panelIds: string[]): LayoutNode | null {
  if (panelIds.length === 0) return null;
  if (panelIds.length === 1) return { type: "panel", panelId: panelIds[0] };
  return makeSplit(
    "row",
    panelIds.map((id) => ({ type: "panel", panelId: id })),
  );
}

function removeFromTree(node: LayoutNode, panelId: string): LayoutNode | null {
  if (node.type === "panel") return node.panelId === panelId ? null : node;
  const nextChildren: LayoutNode[] = [];
  const nextSizes: number[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const result = removeFromTree(node.children[i], panelId);
    if (result !== null) {
      nextChildren.push(result);
      nextSizes.push(node.sizes[i]);
    }
  }
  if (nextChildren.length === 0) return null;
  if (nextChildren.length === 1) return nextChildren[0];
  const total = nextSizes.reduce((a, b) => a + b, 0);
  return {
    ...node,
    children: nextChildren,
    sizes: nextSizes.map((s) => (s / total) * 100),
  };
}

function addToTree(
  root: LayoutNode | null,
  panelId: string,
  edge: DropEdge,
): LayoutNode {
  const leaf: LayoutNode = { type: "panel", panelId };
  if (!root) return leaf;
  const direction: "row" | "col" =
    edge === "top" || edge === "bottom" ? "col" : "row";
  const prepend = edge === "top" || edge === "left";
  if (root.type === "split" && root.direction === direction) {
    const next = prepend ? [leaf, ...root.children] : [...root.children, leaf];
    return { ...root, children: next, sizes: equalSizes(next.length) };
  }
  return makeSplit(direction, prepend ? [leaf, root] : [root, leaf]);
}

function insertNextTo(
  root: LayoutNode,
  targetId: string,
  newId: string,
  edge: DropEdge,
): LayoutNode {
  if (root.type === "panel") {
    if (root.panelId !== targetId) return root;
    const newLeaf: LayoutNode = { type: "panel", panelId: newId };
    const direction: "row" | "col" =
      edge === "top" || edge === "bottom" ? "col" : "row";
    const prepend = edge === "top" || edge === "left";
    return makeSplit(direction, prepend ? [newLeaf, root] : [root, newLeaf]);
  }
  const newChildren = root.children.map((child) =>
    insertNextTo(child, targetId, newId, edge),
  );
  if (newChildren.every((c, i) => c === root.children[i])) return root;
  const flat: LayoutNode[] = [];
  for (const child of newChildren) {
    if (child.type === "split" && child.direction === root.direction) {
      flat.push(...child.children);
    } else {
      flat.push(child);
    }
  }
  return { ...root, children: flat, sizes: equalSizes(flat.length) };
}

function updateSplitSizes(
  root: LayoutNode,
  splitId: string,
  index: number,
  delta: number,
  totalPx: number,
): LayoutNode {
  if (root.type === "panel") return root;
  if (root.id === splitId) {
    const sizes = [...root.sizes];
    const deltaPct = (delta / totalPx) * 100;
    const minPct = 5;
    const sum = sizes[index] + sizes[index + 1];
    const a = Math.max(minPct, Math.min(sum - minPct, sizes[index] + deltaPct));
    sizes[index] = a;
    sizes[index + 1] = sum - a;
    return { ...root, sizes };
  }
  const next = root.children.map((c) =>
    updateSplitSizes(c, splitId, index, delta, totalPx),
  );
  if (next.every((c, i) => c === root.children[i])) return root;
  return { ...root, children: next };
}

// ─── Drop Edge Detection ──────────────────────────────────────────────────────

function computeDropEdge(active: Active, over: Over): DropEdge {
  const t = active.rect.current.translated;
  if (!t) return "bottom";
  const rx = (t.left + t.width / 2 - over.rect.left) / over.rect.width;
  const ry = (t.top + t.height / 2 - over.rect.top) / over.rect.height;
  const d: Record<DropEdge, number> = {
    top: ry,
    bottom: 1 - ry,
    left: rx,
    right: 1 - rx,
  };
  return (Object.keys(d) as DropEdge[]).reduce((a, b) => (d[a] < d[b] ? a : b));
}

// ─── Draggable Tab ────────────────────────────────────────────────────────────
// Unified drag handle used everywhere — tab bar of a tabbed zone AND
// the header strip of each center panel card.

function DraggableTab({
  panel,
  isActive,
  onClick,
}: {
  panel: Panel;
  isActive: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: panel.id,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={[
        "px-3 py-1.5 text-xs font-medium border-b-2 cursor-grab select-none whitespace-nowrap shrink-0",
        "transition-colors duration-100 focus:outline-none",
        isDragging ? "opacity-40" : "",
        isActive
          ? "border-blue-500 text-blue-700 bg-blue-50"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {panel.title}
    </button>
  );
}

// ─── Center Panel Card ────────────────────────────────────────────────────────
// A panel slot in the center split layout. Tab header is the only drag handle.

const centerDropRect: Record<DropEdge, string> = {
  top: "inset-x-0 top-0 h-1/3 border-b-2",
  bottom: "inset-x-0 bottom-0 h-1/3 border-t-2",
  left: "inset-y-0 left-0 w-1/4 border-r-2",
  right: "inset-y-0 right-0 w-1/4 border-l-2",
};

function CenterPanelCard({
  panel,
  activeId,
  setMap,
  pendingEdge,
}: {
  panel: Panel;
  activeId: string | null;
  setMap: (map: MapEngine | null) => void;
  pendingEdge: DropEdge | null;
}) {
  const isDragging = activeId === panel.id;
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "center-panel:" + panel.id,
  });

  return (
    <div
      ref={setDropRef}
      className={[
        "relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-white",
        isDragging ? "opacity-30" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isOver && pendingEdge && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div
            className={`absolute rounded bg-blue-200/60 border-2 border-blue-500 ${centerDropRect[pendingEdge]}`}
          />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        {panel.id === "map" ? (
          <MapCanvas setMap={setMap} />
        ) : panel.component ? (
          (() => {
            const Component = panel.component;
            return <Component />;
          })()
        ) : (
          <div className="p-3 h-full overflow-auto">
            <div className="text-xs text-gray-400 leading-snug">
              {panel.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Layout Node Renderer ─────────────────────────────────────────────────────

function LayoutNodeView({
  node,
  activeId,
  setMap,
  onClose,
  pendingEdge,
  setCenterTree,
  availablePanels,
  onAddToRow,
}: {
  node: LayoutNode;
  activeId: string | null;
  setMap: (map: MapEngine | null) => void;
  onClose: (panelId: string) => void;
  pendingEdge: DropEdge | null;
  setCenterTree: React.Dispatch<React.SetStateAction<LayoutNode | null>>;
  availablePanels: Panel[];
  onAddToRow: (targetPanelId: string | null, newPanelId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Panel: compact tab header (drag handle + close + right-aligned "+") ──
  if (node.type === "panel") {
    const panel = PANELS.find((p) => p.id === node.panelId);
    if (!panel) return null;
    return (
      <div className="flex flex-col min-h-0 flex-1 h-full">
        <div className="shrink-0 flex items-center border-b border-gray-200 bg-gray-50">
          <DraggableTab panel={panel} isActive={false} />
          <button
            onClick={() => onClose(panel.id)}
            className="w-3.5 h-3.5 -ml-1.5 mr-1 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 text-xs leading-none focus:outline-none"
            aria-label={`Close ${panel.title}`}
          >
            ×
          </button>
          <div className="ml-auto px-1">
            <AddPanelButton
              availablePanels={availablePanels}
              onAddPanel={(id) => onAddToRow(panel.id, id)}
            />
          </div>
        </div>
        <CenterPanelCard
          panel={panel}
          activeId={activeId}
          setMap={setMap}
          pendingEdge={pendingEdge}
        />
      </div>
    );
  }

  // ── Row split: panels side-by-side, last child gets the "+" ─────────────
  if (node.direction === "row") {
    const items: React.ReactNode[] = [];

    node.children.forEach((child, i) => {
      const key = child.type === "panel" ? child.panelId : child.id;
      items.push(
        <div
          key={key}
          className="flex flex-col min-w-0 min-h-0 overflow-hidden"
          style={{ flex: node.sizes[i] }}
        >
          <LayoutNodeView
            node={child}
            activeId={activeId}
            setMap={setMap}
            onClose={onClose}
            pendingEdge={pendingEdge}
            setCenterTree={setCenterTree}
            availablePanels={availablePanels}
            onAddToRow={onAddToRow}
          />
        </div>,
      );
      if (i < node.children.length - 1) {
        const splitId = node.id;
        items.push(
          <ResizeHandle
            key={`r${i}`}
            direction="vertical"
            onResize={(delta) => {
              const el = containerRef.current;
              if (!el) return;
              setCenterTree((prev) =>
                prev
                  ? updateSplitSizes(prev, splitId, i, delta, el.clientWidth)
                  : prev,
              );
            }}
          />,
        );
      }
    });

    return (
      <div
        ref={containerRef}
        className="flex flex-row min-w-0 min-h-0 flex-1 h-full w-full"
      >
        {items}
      </div>
    );
  }

  // ── Col split: stack children, each row handles its own "+" ─────────────
  const items: React.ReactNode[] = [];
  node.children.forEach((child, i) => {
    const key = child.type === "panel" ? child.panelId : child.id;
    items.push(
      <div
        key={key}
        className="flex flex-col min-w-0 min-h-0 overflow-hidden"
        style={{ flex: node.sizes[i] }}
      >
        <LayoutNodeView
          node={child}
          activeId={activeId}
          setMap={setMap}
          onClose={onClose}
          pendingEdge={pendingEdge}
          setCenterTree={setCenterTree}
          availablePanels={availablePanels}
          onAddToRow={onAddToRow}
        />
      </div>,
    );
    if (i < node.children.length - 1) {
      const splitId = node.id;
      items.push(
        <ResizeHandle
          key={`r${i}`}
          direction="horizontal"
          onResize={(delta) => {
            const el = containerRef.current;
            if (!el) return;
            setCenterTree((prev) =>
              prev
                ? updateSplitSizes(prev, splitId, i, delta, el.clientHeight)
                : prev,
            );
          }}
        />,
      );
    }
  });

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-w-0 min-h-0 flex-1 h-full w-full"
    >
      {items}
    </div>
  );
}

// ─── Add Panel Button ─────────────────────────────────────────────────────────

function AddPanelButton({
  availablePanels,
  onAddPanel,
}: {
  availablePanels: Panel[];
  onAddPanel: (panelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (availablePanels.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Add panel"
        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 text-base leading-none focus:outline-none"
      >
        +
      </button>
      {open && (
        <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[140px] z-30">
          {availablePanels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => {
                onAddPanel(panel.id);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              {panel.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Center Drop Zone ─────────────────────────────────────────────────────────

function CenterDropZone({
  tree,
  activeId,
  activePanelZone,
  pendingEdge,
  pendingTargetId,
  setMap,
  onClose,
  setCenterTree,
  availablePanels,
  onAddToRow,
}: {
  tree: LayoutNode | null;
  activeId: string | null;
  activePanelZone: Zone | null;
  pendingEdge: DropEdge | null;
  pendingTargetId: string | null;
  setMap: (map: MapEngine | null) => void;
  onClose: (panelId: string) => void;
  setCenterTree: React.Dispatch<React.SetStateAction<LayoutNode | null>>;
  availablePanels: Panel[];
  onAddToRow: (splitId: string | null, panelId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "center" });
  const isSource = activePanelZone === "center";
  const showHint = activeId !== null && !isSource;
  const isEmpty = tree === null;

  const showContainerIndicator =
    isOver && pendingEdge && pendingTargetId === null;
  const dropRect: Record<DropEdge, string> = {
    top: "inset-x-0 top-0 h-1/3",
    bottom: "inset-x-0 bottom-0 h-1/3",
    left: "inset-y-0 left-0 w-1/4",
    right: "inset-y-0 right-0 w-1/4",
  };

  return (
    <div ref={setNodeRef} className="relative h-full w-full flex flex-col">
      {showContainerIndicator && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {isEmpty ? (
            <div className="absolute inset-1 rounded bg-blue-200/60 border-2 border-blue-500" />
          ) : (
            <div
              className={`absolute rounded bg-blue-200/60 border-2 border-blue-500 ${dropRect[pendingEdge]}`}
            />
          )}
        </div>
      )}
      <div
        className={[
          "flex flex-1 min-h-0",
          isEmpty ? "items-center justify-center" : "",
          isOver && isEmpty ? "bg-blue-50" : "",
          showHint && isEmpty
            ? "bg-gray-50 ring-2 ring-inset ring-dashed ring-gray-300"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-400 select-none pointer-events-none">
              {showHint ? "Drop here → Center" : "Center"}
            </span>
            {availablePanels.length > 0 && (
              <AddPanelButton
                availablePanels={availablePanels}
                onAddPanel={(id) => onAddToRow(null, id)}
              />
            )}
          </div>
        ) : (
          <LayoutNodeView
            node={tree}
            activeId={activeId}
            setMap={setMap}
            onClose={onClose}
            pendingEdge={pendingEdge}
            setCenterTree={setCenterTree}
            availablePanels={availablePanels}
            onAddToRow={onAddToRow}
          />
        )}
      </div>
    </div>
  );
}

// ─── Activity Bar Tab ────────────────────────────────────────────────────────

function ActivityBarTab({
  panel,
  isActive,
  side,
  onClick,
}: {
  panel: Panel;
  isActive: boolean;
  side: "left" | "right";
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: panel.id });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{
        height: 44,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        "flex items-center justify-center w-full shrink-0 cursor-grab select-none focus:outline-none",
        "transition-colors duration-100",
        side === "left" ? "border-l-4" : "border-r-4",
        isDragging ? "opacity-40" : "",
        isActive
          ? "border-blue-500 text-blue-600 bg-white"
          : "border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-200",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="text-xs font-semibold tracking-wide">
        {panel.title.slice(0, 2)}
      </span>
    </button>
  );
}

// ─── Tabbed Drop Zone ─────────────────────────────────────────────────────────

const TabbedDropZone = memo(function TabbedDropZone({
  zone,
  panels,
  activeId,
  activePanelZone,
  activeTabId,
  onTabClick,
  barSide = "top",
  collapsed = false,
}: {
  zone: TabbedZone;
  panels: Panel[];
  activeId: string | null;
  activePanelZone: Zone | null;
  activeTabId: string | null;
  onTabClick: (panelId: string, wasActive: boolean) => void;
  barSide?: "top" | "left" | "right";
  collapsed?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone });
  const isSource = activePanelZone === zone;
  const showHint = activeId !== null && !isSource;
  const isEmpty = panels.length === 0;
  const effectiveId =
    panels.find((p) => p.id === activeTabId)?.id ?? panels[0]?.id ?? null;
  const activePanel = panels.find((p) => p.id === effectiveId) ?? null;

  const content =
    activePanel &&
    (() => {
      const Component = activePanel.component;
      return Component ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <Component />
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-3 overflow-auto">
          <div className="text-sm font-medium text-gray-700 mb-1">
            {activePanel.title}
          </div>
          <div className="text-xs text-gray-400 leading-snug">
            {activePanel.description}
          </div>
        </div>
      );
    })();

  return (
    <div
      ref={setNodeRef}
      className={[
        "relative h-full w-full transition-colors duration-150",
        barSide === "top" ? "flex flex-col" : "flex flex-row",
        showHint && isEmpty
          ? "bg-gray-50 ring-2 ring-inset ring-dashed ring-gray-300"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isOver && !isSource && (
        <div className="absolute inset-0 rounded bg-blue-200/50 border-2 border-blue-500 pointer-events-none z-10" />
      )}
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-gray-400 select-none pointer-events-none">
            {showHint ? `Drop here → ${ZONE_LABELS[zone]}` : ZONE_LABELS[zone]}
          </span>
        </div>
      ) : barSide === "top" ? (
        <>
          <div className="flex flex-row border-b border-gray-200 shrink-0 overflow-x-auto bg-gray-50">
            {panels.map((p) => (
              <DraggableTab
                key={p.id}
                panel={p}
                isActive={p.id === effectiveId}
                onClick={() => onTabClick(p.id, p.id === effectiveId)}
              />
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {activePanel &&
              (() => {
                const Component = activePanel.component;
                return Component ? (
                  <Component />
                ) : (
                  <div className="p-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">
                      {activePanel.title}
                    </div>
                    <div className="text-xs text-gray-400 leading-snug">
                      {activePanel.description}
                    </div>
                  </div>
                );
              })()}
          </div>
        </>
      ) : (
        <>
          {barSide === "right" && !collapsed && content}
          <div
            className={[
              "shrink-0 flex flex-col bg-gray-100",
              barSide === "left"
                ? "border-r border-gray-200"
                : "border-l border-gray-200",
            ].join(" ")}
            style={{ width: 44 }}
          >
            <SortableContext
              items={panels.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {panels.map((p) => (
                <ActivityBarTab
                  key={p.id}
                  panel={p}
                  isActive={p.id === effectiveId && !collapsed}
                  side={barSide as "left" | "right"}
                  onClick={() =>
                    onTabClick(p.id, p.id === effectiveId && !collapsed)
                  }
                />
              ))}
            </SortableContext>
          </div>
          {barSide === "left" && !collapsed && content}
        </>
      )}
    </div>
  );
});

// ─── Drag Overlay ─────────────────────────────────────────────────────────────

function DragOverlayTab({ panel }: { panel: Panel }) {
  return (
    <div className="px-3 py-1.5 text-xs font-medium bg-white border border-blue-400 rounded shadow-lg text-blue-700 cursor-grabbing select-none">
      {panel.title}
    </div>
  );
}

// ─── Resize Handle ───────────────────────────────────────────────────────────

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

function ResizeHandle({
  direction,
  onResize,
}: {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
}) {
  const dragging = useRef(false);
  const last = useRef(0);
  const [active, setActive] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    last.current = direction === "vertical" ? e.clientX : e.clientY;
    setActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const pos = direction === "vertical" ? e.clientX : e.clientY;
    onResize(pos - last.current);
    last.current = pos;
  };

  const onPointerUp = () => {
    dragging.current = false;
    setActive(false);
  };

  return (
    <div
      className={[
        "shrink-0 transition-colors z-20",
        direction === "vertical"
          ? "w-1 cursor-col-resize"
          : "h-1 cursor-row-resize",
        active ? "bg-blue-500" : "bg-gray-200 hover:bg-blue-400",
      ].join(" ")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

// ─── Dialog Interceptor ──────────────────────────────────────────────────────
// Must render INSIDE LayoutTestProviders so it shares the same Jotai store
// as the Toolbar. The page component itself is the parent of LayoutTestProviders
// and therefore uses a different store.

function DialogInterceptor({
  onAddToCenter,
}: {
  onAddToCenter: (panelId: string) => void;
}) {
  const [dialog, setDialog] = useAtom(dialogAtom);

  useEffect(() => {
    if (dialog?.type !== "simulationSettings") return;
    setDialog(null);
    onAddToCenter("simulation-settings");
  }, [dialog, setDialog, onAddToCenter]);

  return null;
}

// ─── Page ────────────────────────────────────────────────────────────────────

const INITIAL_CENTER_IDS = PANELS.filter(
  (p) => INITIAL_LAYOUT[p.id] === "center",
).map((p) => p.id);

export default function LayoutTestPage() {
  const [layout, setLayout] = useState<PanelLayout>(INITIAL_LAYOUT);
  const [centerTree, setCenterTree] = useState<LayoutNode | null>(
    buildInitialTree(INITIAL_CENTER_IDS),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingEdge, setPendingEdge] = useState<DropEdge | null>(null);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const [activeTabByZone, setActiveTabByZone] = useState<
    Record<TabbedZone, string | null>
  >({
    left: "network-review",
    right: "feature-editor",
    bottom: "assets",
  });
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(160);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [map, setMap] = useState<MapEngine | null>(null);

  // Explicit ordering for sidebar activity bars — panels are filtered by
  // current layout so entries for other zones are harmlessly ignored
  const [leftOrder, setLeftOrder] = useState<string[]>(() =>
    PANELS.filter((p) => INITIAL_LAYOUT[p.id] === "left").map((p) => p.id),
  );
  const [rightOrder, setRightOrder] = useState<string[]>(() =>
    PANELS.filter((p) => INITIAL_LAYOUT[p.id] === "right").map((p) => p.id),
  );

  const leftPanels = useMemo(
    () =>
      leftOrder
        .filter((id) => layout[id] === "left")
        .map((id) => PANELS.find((p) => p.id === id)!)
        .filter(Boolean),
    [layout, leftOrder],
  );
  const rightPanels = useMemo(
    () =>
      rightOrder
        .filter((id) => layout[id] === "right")
        .map((id) => PANELS.find((p) => p.id === id)!)
        .filter(Boolean),
    [layout, rightOrder],
  );
  const bottomPanels = useMemo(
    () => PANELS.filter((p) => layout[p.id] === "bottom"),
    [layout],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activePanelZone = activeId ? layout[activeId] : null;
  const activePanel = activeId
    ? (PANELS.find((p) => p.id === activeId) ?? null)
    : null;

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  }, []);

  const handleDragMove = useCallback((e: DragMoveEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    const isCenterPanel = overId?.startsWith("center-panel:") ?? false;
    const isCenter = overId === "center";
    if (!isCenterPanel && !isCenter) {
      setPendingEdge(null);
      setPendingTargetId(null);
      return;
    }
    setPendingEdge(computeDropEdge(e.active, e.over!));
    setPendingTargetId(
      isCenterPanel ? overId!.slice("center-panel:".length) : null,
    );
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      setActiveId(null);
      setPendingEdge(null);
      setPendingTargetId(null);
      if (!over) return;

      const panelId = active.id as string;
      const overId = String(over.id);
      const sourceZone = layout[panelId] as Zone;

      // ── Same-sidebar reorder ─────────────────────────────────────────────
      const overZone = layout[overId] as Zone | undefined;
      if (
        overZone !== undefined &&
        overZone === sourceZone &&
        (sourceZone === "left" || sourceZone === "right")
      ) {
        const setter = sourceZone === "left" ? setLeftOrder : setRightOrder;
        setter((prev) => {
          const oldIndex = prev.indexOf(panelId);
          const newIndex = prev.indexOf(overId);
          return arrayMove(prev, oldIndex, newIndex);
        });
        return;
      }

      // ── Cross-zone move ──────────────────────────────────────────────────
      const isCenterPanel = overId.startsWith("center-panel:");
      const targetPanelId = isCenterPanel
        ? overId.slice("center-panel:".length)
        : null;
      const targetZone: Zone =
        isCenterPanel || overId === "center"
          ? "center"
          : ZONE_IDS.has(overId)
            ? (overId as Zone)
            : ((layout[overId] ?? sourceZone) as Zone);

      startTransition(() => {
        if (targetZone === "center") {
          const edge = computeDropEdge(active, over);
          setCenterTree((prev) => {
            const pruned =
              sourceZone === "center" && prev
                ? removeFromTree(prev, panelId)
                : prev;
            if (targetPanelId && pruned) {
              return insertNextTo(pruned, targetPanelId, panelId, edge);
            }
            return addToTree(pruned, panelId, edge);
          });
        } else {
          if (sourceZone === "center") {
            setCenterTree((prev) =>
              prev ? removeFromTree(prev, panelId) : null,
            );
          }
          setActiveTabByZone((prev) => ({ ...prev, [targetZone]: panelId }));
          if (targetZone === "left") {
            setLeftOrder((prev) =>
              prev.includes(panelId) ? prev : [...prev, panelId],
            );
          } else if (targetZone === "right") {
            setRightOrder((prev) =>
              prev.includes(panelId) ? prev : [...prev, panelId],
            );
          }
        }

        setLayout((prev) => ({ ...prev, [panelId]: targetZone }));
      });
    },
    [layout],
  );

  const handleLeftTabClick = useCallback(
    (panelId: string, wasActive: boolean) => {
      setActiveTabByZone((prev) => ({ ...prev, left: panelId }));
      setLeftCollapsed((prev) => (prev ? false : wasActive));
    },
    [],
  );

  const handleRightTabClick = useCallback(
    (panelId: string, wasActive: boolean) => {
      setActiveTabByZone((prev) => ({ ...prev, right: panelId }));
      setRightCollapsed((prev) => (prev ? false : wasActive));
    },
    [],
  );

  const handleBottomTabClick = useCallback(
    (panelId: string, _wasActive: boolean) => {
      setActiveTabByZone((prev) => ({ ...prev, bottom: panelId }));
    },
    [],
  );

  const handleCloseCenter = useCallback((panelId: string) => {
    setCenterTree((prev) => (prev ? removeFromTree(prev, panelId) : null));
    setLayout((prev) => {
      const next = { ...prev };
      delete next[panelId];
      return next;
    });
  }, []);

  const availablePanels = useMemo(
    () => PANELS.filter((p) => !layout[p.id]),
    [layout],
  );

  const handleAddToCenterRow = useCallback(
    (targetPanelId: string | null, newPanelId: string) => {
      startTransition(() => {
        setLayout((prev) => ({ ...prev, [newPanelId]: "center" }));
        setCenterTree((prev) => {
          if (!prev) return { type: "panel", panelId: newPanelId };
          if (targetPanelId === null)
            return addToTree(prev, newPanelId, "right");
          return insertNextTo(prev, targetPanelId, newPanelId, "right");
        });
      });
    },
    [],
  );

  const handleAddToCenter = useCallback(
    (panelId: string) => {
      handleAddToCenterRow(null, panelId);
    },
    [handleAddToCenterRow],
  );

  return (
    <LayoutTestProviders>
      <DialogInterceptor onAddToCenter={handleAddToCenter} />
      <MapContext.Provider value={map}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          <div
            className="w-screen flex flex-col bg-gray-50 overflow-hidden font-sans"
            style={{ height: "100dvh" }}
          >
            <div className="shrink-0 h-24 border-b border-gray-200 bg-white">
              <MenuBarPlay />
              <Toolbar />
            </div>

            <div className="flex flex-1 min-h-0 pb-10">
              <div
                className="shrink-0 bg-white overflow-hidden"
                style={{ width: leftCollapsed ? 44 : leftWidth }}
              >
                <TabbedDropZone
                  zone="left"
                  barSide="left"
                  panels={leftPanels}
                  activeId={activeId}
                  activePanelZone={activePanelZone}
                  activeTabId={activeTabByZone.left}
                  onTabClick={handleLeftTabClick}
                  collapsed={leftCollapsed}
                />
              </div>

              <ResizeHandle
                direction="vertical"
                onResize={(d) => setLeftWidth((w) => clamp(w + d, 120, 520))}
              />

              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <div className="flex-1 min-h-0 bg-white">
                  <CenterDropZone
                    tree={centerTree}
                    activeId={activeId}
                    activePanelZone={activePanelZone}
                    pendingEdge={pendingEdge}
                    pendingTargetId={pendingTargetId}
                    setMap={setMap}
                    onClose={handleCloseCenter}
                    setCenterTree={setCenterTree}
                    availablePanels={availablePanels}
                    onAddToRow={handleAddToCenterRow}
                  />
                </div>
                <ResizeHandle
                  direction="horizontal"
                  onResize={(d) =>
                    setBottomHeight((h) => clamp(h - d, 80, 420))
                  }
                />
                <div
                  className="shrink-0 bg-white overflow-hidden"
                  style={{ height: bottomHeight }}
                >
                  <TabbedDropZone
                    zone="bottom"
                    panels={bottomPanels}
                    activeId={activeId}
                    activePanelZone={activePanelZone}
                    activeTabId={activeTabByZone.bottom}
                    onTabClick={handleBottomTabClick}
                  />
                </div>
              </div>

              <ResizeHandle
                direction="vertical"
                onResize={(d) => setRightWidth((w) => clamp(w - d, 120, 520))}
              />

              <div
                className="shrink-0 bg-white overflow-hidden"
                style={{ width: rightCollapsed ? 44 : rightWidth }}
              >
                <TabbedDropZone
                  zone="right"
                  barSide="right"
                  panels={rightPanels}
                  activeId={activeId}
                  activePanelZone={activePanelZone}
                  activeTabId={activeTabByZone.right}
                  onTabClick={handleRightTabClick}
                  collapsed={rightCollapsed}
                />
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activePanel ? <DragOverlayTab panel={activePanel} /> : null}
          </DragOverlay>
          <Footer />
        </DndContext>
      </MapContext.Provider>
    </LayoutTestProviders>
  );
}
