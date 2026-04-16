"use client";

import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  Active,
  Over,
} from "@dnd-kit/core";

// ─── Types ───────────────────────────────────────────────────────────────────

type Zone = "left" | "center" | "right" | "bottom";
type TabbedZone = Exclude<Zone, "center">;
type DropEdge = "top" | "bottom" | "left" | "right";

type LayoutNode =
  | { type: "panel"; panelId: string }
  | { type: "split"; direction: "row" | "col"; children: LayoutNode[] };

interface Panel {
  id: string;
  title: string;
  description: string;
}

type PanelLayout = Record<string, Zone>;

// ─── Data ────────────────────────────────────────────────────────────────────

const PANELS: Panel[] = [
  {
    id: "alpha",
    title: "Alpha",
    description:
      "Overview of network topology and active node connections across the current simulation run.",
  },
  {
    id: "bravo",
    title: "Bravo",
    description:
      "Pressure readings at monitored junctions. Alerts trigger when values fall outside thresholds.",
  },
  {
    id: "charlie",
    title: "Charlie",
    description:
      "Flow rate summary per pipe segment. Highlighted in red when velocity exceeds design limits.",
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
    id: "hotel",
    title: "Hotel",
    description:
      "Scenario comparison view. Diff between baseline and active scenario across all result parameters.",
  },
];

const INITIAL_LAYOUT: PanelLayout = {
  alpha: "center",
  bravo: "center",
  charlie: "left",
  delta: "left",
  echo: "right",
  foxtrot: "bottom",
  golf: "bottom",
  hotel: "center",
};

const ZONE_LABELS: Record<Zone, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  bottom: "Bottom",
};

// ─── Layout Tree Helpers ──────────────────────────────────────────────────────

function buildInitialTree(panelIds: string[]): LayoutNode | null {
  if (panelIds.length === 0) return null;
  if (panelIds.length === 1) return { type: "panel", panelId: panelIds[0] };
  return {
    type: "split",
    direction: "row",
    children: panelIds.map((id) => ({ type: "panel", panelId: id })),
  };
}

function removeFromTree(node: LayoutNode, panelId: string): LayoutNode | null {
  if (node.type === "panel") return node.panelId === panelId ? null : node;
  const next = node.children
    .map((c) => removeFromTree(c, panelId))
    .filter((c): c is LayoutNode => c !== null);
  if (next.length === 0) return null;
  if (next.length === 1) return next[0];
  return { ...node, children: next };
}

function addToTree(
  root: LayoutNode | null,
  panelId: string,
  edge: DropEdge,
): LayoutNode {
  const leaf: LayoutNode = { type: "panel", panelId };
  if (!root) return leaf;
  const direction = edge === "top" || edge === "bottom" ? "col" : "row";
  const prepend = edge === "top" || edge === "left";
  if (root.type === "split" && root.direction === direction) {
    return {
      ...root,
      children: prepend ? [leaf, ...root.children] : [...root.children, leaf],
    };
  }
  return {
    type: "split",
    direction,
    children: prepend ? [leaf, root] : [root, leaf],
  };
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

function CenterPanelCard({
  panel,
  activeId,
}: {
  panel: Panel;
  activeId: string | null;
}) {
  const isDragging = activeId === panel.id;

  return (
    <div
      className={[
        "flex flex-col flex-1 min-w-0 min-h-0 rounded border border-gray-200 overflow-hidden bg-white",
        isDragging ? "opacity-30" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Tab header — the drag handle */}
      <div className="flex flex-row border-b border-gray-200 shrink-0 bg-gray-50">
        <DraggableTab panel={panel} isActive={activeId === panel.id} />
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0 p-3 overflow-auto">
        <div className="text-xs text-gray-400 leading-snug">
          {panel.description}
        </div>
      </div>
    </div>
  );
}

// ─── Layout Node Renderer ─────────────────────────────────────────────────────

function LayoutNodeView({
  node,
  activeId,
}: {
  node: LayoutNode;
  activeId: string | null;
}) {
  if (node.type === "panel") {
    const panel = PANELS.find((p) => p.id === node.panelId);
    if (!panel) return null;
    return <CenterPanelCard panel={panel} activeId={activeId} />;
  }
  return (
    <div
      className={[
        "flex min-w-0 min-h-0 gap-1 flex-1 h-full w-full",
        node.direction === "row" ? "flex-row" : "flex-col",
      ].join(" ")}
    >
      {node.children.map((child, i) => (
        <LayoutNodeView key={i} node={child} activeId={activeId} />
      ))}
    </div>
  );
}

// ─── Center Drop Zone ─────────────────────────────────────────────────────────

function CenterDropZone({
  tree,
  activeId,
  activePanelZone,
  pendingEdge,
}: {
  tree: LayoutNode | null;
  activeId: string | null;
  activePanelZone: Zone | null;
  pendingEdge: DropEdge | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "center" });
  const isSource = activePanelZone === "center";
  const showHint = activeId !== null && !isSource;
  const isEmpty = tree === null;

  // Solid rectangle showing exactly where the panel will land
  const dropRect: Record<DropEdge, string> = {
    top: "inset-x-0 top-0 h-1/3 border-b-2",
    bottom: "inset-x-0 bottom-0 h-1/3 border-t-2",
    left: "inset-y-0 left-0 w-1/4 border-r-2",
    right: "inset-y-0 right-0 w-1/4 border-l-2",
  };

  return (
    <div ref={setNodeRef} className="relative h-full w-full">
      {isOver && pendingEdge && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {isEmpty ? (
            <div className="absolute inset-1 rounded bg-blue-200/60 border-2 border-blue-500" />
          ) : (
            <div
              className={`absolute rounded bg-blue-200/60 border-blue-500 ${dropRect[pendingEdge]}`}
            />
          )}
        </div>
      )}
      <div
        className={[
          "flex h-full w-full p-1 gap-1 transition-colors duration-150",
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
          <span className="text-xs text-gray-400 select-none pointer-events-none">
            {showHint ? "Drop here → Center" : "Center"}
          </span>
        ) : (
          <LayoutNodeView node={tree} activeId={activeId} />
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: panel.id,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ height: 44 }}
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

function TabbedDropZone({
  zone,
  panels,
  activeId,
  activePanelZone,
  activeTabId,
  onTabClick,
  barSide = "top",
}: {
  zone: TabbedZone;
  panels: Panel[];
  activeId: string | null;
  activePanelZone: Zone | null;
  activeTabId: string | null;
  onTabClick: (panelId: string) => void;
  barSide?: "top" | "left" | "right";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone });
  const isSource = activePanelZone === zone;
  const showHint = activeId !== null && !isSource;
  const isEmpty = panels.length === 0;
  const effectiveId =
    panels.find((p) => p.id === activeTabId)?.id ?? panels[0]?.id ?? null;
  const activePanel = panels.find((p) => p.id === effectiveId) ?? null;

  const content = activePanel && (
    <div className="flex-1 min-h-0 p-3 overflow-auto">
      <div className="text-sm font-medium text-gray-700 mb-1">
        {activePanel.title}
      </div>
      <div className="text-xs text-gray-400 leading-snug">
        {activePanel.description}
      </div>
    </div>
  );

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
                onClick={() => onTabClick(p.id)}
              />
            ))}
          </div>
          <div className="flex-1 min-h-0 p-3 overflow-auto">
            {activePanel && (
              <>
                <div className="text-sm font-medium text-gray-700 mb-1">
                  {activePanel.title}
                </div>
                <div className="text-xs text-gray-400 leading-snug">
                  {activePanel.description}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {barSide === "right" && content}
          <div
            className={[
              "shrink-0 flex flex-col bg-gray-100",
              barSide === "left"
                ? "border-r border-gray-200"
                : "border-l border-gray-200",
            ].join(" ")}
            style={{ width: 44 }}
          >
            {panels.map((p) => (
              <ActivityBarTab
                key={p.id}
                panel={p}
                isActive={p.id === effectiveId}
                side={barSide as "left" | "right"}
                onClick={() => onTabClick(p.id)}
              />
            ))}
          </div>
          {barSide === "left" && content}
        </>
      )}
    </div>
  );
}

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
  const [activeTabByZone, setActiveTabByZone] = useState<
    Record<TabbedZone, string | null>
  >({
    left: "charlie",
    right: "echo",
    bottom: "foxtrot",
  });
  const [leftWidth, setLeftWidth] = useState(224);
  const [rightWidth, setRightWidth] = useState(224);
  const [bottomHeight, setBottomHeight] = useState(160);

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
    if (e.over?.id !== "center") {
      setPendingEdge(null);
      return;
    }
    setPendingEdge(computeDropEdge(e.active, e.over));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      setActiveId(null);
      setPendingEdge(null);
      if (!over) return;

      const panelId = active.id as string;
      const targetZone = over.id as Zone;
      const sourceZone = layout[panelId] as Zone;

      if (targetZone === "center") {
        const edge = computeDropEdge(active, over);
        setCenterTree((prev) => {
          const pruned =
            sourceZone === "center" && prev
              ? removeFromTree(prev, panelId)
              : prev;
          return addToTree(pruned, panelId, edge);
        });
      } else {
        if (sourceZone === "center") {
          setCenterTree((prev) =>
            prev ? removeFromTree(prev, panelId) : null,
          );
        }
        setActiveTabByZone((prev) => ({ ...prev, [targetZone]: panelId }));
      }

      setLayout((prev) => ({ ...prev, [panelId]: targetZone }));
    },
    [layout],
  );

  const handleTabClick = useCallback((zone: TabbedZone, panelId: string) => {
    setActiveTabByZone((prev) => ({ ...prev, [zone]: panelId }));
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        className="w-screen flex flex-col bg-gray-50 overflow-hidden font-sans"
        style={{ height: "100dvh" }}
      >
        <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">
            Layout Test
          </span>
          <span className="text-xs text-gray-400">
            Drag tabs to move panels between zones
          </span>
        </div>

        <div className="flex flex-1 min-h-0">
          <div
            className="shrink-0 bg-white overflow-hidden"
            style={{ width: leftWidth }}
          >
            <TabbedDropZone
              zone="left"
              barSide="left"
              panels={PANELS.filter((p) => layout[p.id] === "left")}
              activeId={activeId}
              activePanelZone={activePanelZone}
              activeTabId={activeTabByZone.left}
              onTabClick={(id) => handleTabClick("left", id)}
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
              />
            </div>
            <ResizeHandle
              direction="horizontal"
              onResize={(d) => setBottomHeight((h) => clamp(h - d, 80, 420))}
            />
            <div
              className="shrink-0 bg-white overflow-hidden"
              style={{ height: bottomHeight }}
            >
              <TabbedDropZone
                zone="bottom"
                panels={PANELS.filter((p) => layout[p.id] === "bottom")}
                activeId={activeId}
                activePanelZone={activePanelZone}
                activeTabId={activeTabByZone.bottom}
                onTabClick={(id) => handleTabClick("bottom", id)}
              />
            </div>
          </div>

          <ResizeHandle
            direction="vertical"
            onResize={(d) => setRightWidth((w) => clamp(w - d, 120, 520))}
          />

          <div
            className="shrink-0 bg-white overflow-hidden"
            style={{ width: rightWidth }}
          >
            <TabbedDropZone
              zone="right"
              barSide="right"
              panels={PANELS.filter((p) => layout[p.id] === "right")}
              activeId={activeId}
              activePanelZone={activePanelZone}
              activeTabId={activeTabByZone.right}
              onTabClick={(id) => handleTabClick("right", id)}
            />
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePanel ? <DragOverlayTab panel={activePanel} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
