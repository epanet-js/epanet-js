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

export const quickGraphPropertyAtom =
  atomWithStorage<QuickGraphPropertyByAssetType>("quickGraphProperty", {
    junction: "pressure",
    pipe: "flow",
    pump: "flow",
    valve: "flow",
    tank: "level",
    reservoir: "head",
  });
