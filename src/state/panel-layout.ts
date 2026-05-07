import { useEffect, type ComponentType } from "react";
import { atom, useSetAtom } from "jotai";

export type Zone = "left" | "right" | "center" | "bottom";
export type ResolvedLayout = "horizontal" | "vertical";

export interface PanelDefinition {
  id: string;
  labelKey: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType;
  defaultZone: Partial<Record<ResolvedLayout, Zone>>;
}

export interface PanelState {
  shown?: boolean;
  zone?: Zone;
}

export type PanelEntry = PanelDefinition & PanelState;

export const panelDefinitionsAtom = atom<PanelDefinition[]>([]);

export const panelLayoutStateAtom = atom<Record<string, PanelState>>({});

export const panelRegistryAtom = atom<PanelEntry[]>((get) => {
  const defs = get(panelDefinitionsAtom);
  const state = get(panelLayoutStateAtom);
  return defs.map((def) => ({ ...def, ...state[def.id] }));
});

export const bottomActiveTabAtom = atom<string | null>(null);

export function effectiveZone(
  entry: PanelEntry,
  layout: ResolvedLayout,
): Zone | undefined {
  return entry.zone ?? entry.defaultZone[layout];
}

export function useRegisterPanel(definition: PanelDefinition, enabled = true) {
  const setDefs = useSetAtom(panelDefinitionsAtom);
  useEffect(() => {
    if (!enabled) return;
    setDefs((prev) => [...prev, definition]);
    return () => setDefs((prev) => prev.filter((p) => p.id !== definition.id));
  }, [definition, enabled, setDefs]);
}
