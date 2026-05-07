import { atom } from "jotai";

export type Zone = "left" | "right" | "center" | "bottom";
export type ResolvedLayout = "horizontal" | "vertical";

export interface PanelDefinition {
  id: string;
  labelKey: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  defaultZone: Partial<Record<ResolvedLayout, Zone>>;
}

export interface PanelState {
  shown?: boolean;
  zone?: Zone;
}

export type PanelEntry = PanelDefinition & PanelState;

export const panelLayoutStateAtom = atom<Record<string, PanelState>>({});

export const bottomActiveTabAtom = atom<string | null>(null);

export function effectiveZone(
  entry: PanelEntry,
  layout: ResolvedLayout,
): Zone | undefined {
  return entry.zone ?? entry.defaultZone[layout];
}
