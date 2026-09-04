import { atom, type Atom } from "jotai";
import { selectAtom } from "jotai/utils";
import { splitsAtom } from "src/state/layout";
import type { Panel } from "src/panels/panel";
import type { PanelContentState, PanelLayout } from "src/panels/panel-template";
import { defaultPanels } from "src/panels/default-panels";
import {
  type Dock,
  type ResolvedLayout,
  VERTICAL_DOCK,
  resolveLayout,
} from "src/panels/docks";

export type { ResolvedLayout, Dock, PanelLayout };

export const DOCKS: readonly Dock[] = ["left", "right", "center", "bottom"];

export type PlacedPanel = {
  id: string;
  closable: boolean;
  panel: Panel;
  dock: Dock | undefined;
  renamedTo?: string;
};

export const panelsAtom = atom<Panel[]>(defaultPanels());

export const panelLayoutAtom = atom<Record<string, PanelLayout>>({});

export const panelContentStateAtom = atom<Record<string, PanelContentState>>(
  {},
);

const selectedPanelIdsAtom = atom<Partial<Record<Dock, string>>>({});

export const resetPanelsAtom = atom(null, (_get, set) => {
  set(panelsAtom, defaultPanels());
  set(panelLayoutAtom, {});
  set(panelContentStateAtom, {});
  set(selectedPanelIdsAtom, {});
});

const resolvedLayoutAtom = selectAtom(splitsAtom, (splits) =>
  resolveLayout(splits.layout),
);

export function currentDock(
  panel: Panel,
  movedToDock: Dock | undefined,
  layout: ResolvedLayout,
): Dock | undefined {
  if (layout === "vertical") {
    return panel.availableInVerticalLayout ? VERTICAL_DOCK : undefined;
  }
  return movedToDock ?? panel.initialDock;
}

export const placedPanelsAtom = atom<PlacedPanel[]>((get) => {
  const layout = get(panelLayoutAtom);
  const resolved = get(resolvedLayoutAtom);
  return get(panelsAtom).map((panel) => ({
    id: panel.id,
    closable: panel.closable,
    panel,
    dock: currentDock(panel, layout[panel.id]?.movedToDock, resolved),
    renamedTo: layout[panel.id]?.renamedTo,
  }));
});

export const panelsByDockAtom = atom<Record<Dock, PlacedPanel[]>>((get) => {
  const byDock: Record<Dock, PlacedPanel[]> = {
    left: [],
    right: [],
    center: [],
    bottom: [],
  };
  for (const entry of get(placedPanelsAtom)) {
    if (entry.dock) byDock[entry.dock].push(entry);
  }
  return byDock;
});

export const activePanelsAtom = atom<Record<Dock, PlacedPanel | null>>(
  (get) => {
    const selected = get(selectedPanelIdsAtom);
    const byDock = get(panelsByDockAtom);
    const active = {} as Record<Dock, PlacedPanel | null>;
    for (const dock of DOCKS) {
      const panels = byDock[dock];
      active[dock] =
        panels.find((entry) => entry.id === selected[dock]) ??
        panels[0] ??
        null;
    }
    return active;
  },
);

export const activatePanelAtom = atom(null, (get, set, panelId: string) => {
  const entry = get(placedPanelsAtom).find((docked) => docked.id === panelId);
  if (!entry) return;
  const { dock } = entry;
  if (!dock) return;
  set(selectedPanelIdsAtom, (prev) => ({ ...prev, [dock]: panelId }));
});

const samePlacedPanel = (
  a: PlacedPanel | null,
  b: PlacedPanel | null,
): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.id === b.id &&
    a.renamedTo === b.renamedTo &&
    a.dock === b.dock &&
    a.closable === b.closable &&
    a.panel === b.panel);

const sameEntries = (a: PlacedPanel[], b: PlacedPanel[]): boolean =>
  a.length === b.length && a.every((entry, i) => samePlacedPanel(entry, b[i]));

const perDock = <T>(
  source: Atom<Record<Dock, T>>,
  equals: (a: T, b: T) => boolean,
): Record<Dock, Atom<T>> =>
  DOCKS.reduce(
    (atoms, dock) => {
      atoms[dock] = selectAtom(source, (byDock) => byDock[dock], equals);
      return atoms;
    },
    {} as Record<Dock, Atom<T>>,
  );

const activePanelAtoms = perDock(activePanelsAtom, samePlacedPanel);
const panelsInDockAtoms = perDock(panelsByDockAtom, sameEntries);

export const activePanelIn = (dock: Dock): Atom<PlacedPanel | null> =>
  activePanelAtoms[dock];

export const panelsIn = (dock: Dock): Atom<PlacedPanel[]> =>
  panelsInDockAtoms[dock];
