import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
  JunctionProperty,
  TankProperty,
  ReservoirProperty,
  PipeProperty,
  PumpProperty,
  ValveProperty,
} from "src/simulation/epanet/eps-results-reader";

export interface QuickGraphPropertyByAssetType {
  junction: JunctionProperty;
  tank: TankProperty;
  reservoir: ReservoirProperty;
  pipe: PipeProperty;
  pump: PumpProperty;
  valve: ValveProperty;
}

export type QuickGraphAssetType = keyof QuickGraphPropertyByAssetType;

interface AssetPanelFooterState {
  isPinned: boolean;
  height: number;
}

export const DEFAULT_FOOTER_HEIGHT = 220;

export const assetPanelFooterAtom = atom<AssetPanelFooterState>({
  isPinned: false,
  height: DEFAULT_FOOTER_HEIGHT,
});

export const defaultQuickGraphProperty: QuickGraphPropertyByAssetType = {
  junction: "pressure",
  pipe: "flow",
  pump: "flow",
  valve: "flow",
  tank: "level",
  reservoir: "head",
};

export const quickGraphPropertyAtom =
  atomWithStorage<QuickGraphPropertyByAssetType>(
    "quickGraphProperty",
    defaultQuickGraphProperty,
  );

/**
 * Write-only atom: resets any asset type whose currently selected quick graph
 * property matches the given value back to the type's default. Useful when a
 * property becomes unavailable (e.g. running a simulation without water age
 * after the user had selected "waterAge").
 */
export const clearQuickGraphPropertyAtom = atom(
  null,
  (_get, set, property: string) => {
    set(quickGraphPropertyAtom, (prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(prev) as QuickGraphAssetType[]) {
        if (prev[key] === property) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (next as any)[key] = defaultQuickGraphProperty[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  },
);
