import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type Side = "left" | "right";

export const OTHER_SIDE: Record<Side, Side> = {
  left: "right",
  right: "left",
};

/**
 * The separation between the map and the pane, which can
 * be controlled by dragging the resizer
 */
export const MIN_SPLITS = {
  left: 150,
  right: 260,
} as const;
export const MAX_SPLIT = 640;

export interface Splits {
  layout: PanelLayout;
  bottom: number | string;
  rightOpen: boolean;
  right: number;
  leftOpen: boolean;
  left: number;
}

export type PanelLayout = "AUTO" | "FLOATING" | "VERTICAL";

export const defaultSplits: Splits = {
  layout: "AUTO",
  bottom: "50%",
  rightOpen: true,
  right: 320,
  leftOpen: false,
  left: 300,
};
export const splitsAtom = atom<Splits>(defaultSplits);

export const showPanelBottomAtom = atom<boolean>(true);

export enum TabOption {
  Asset = "Asset",
  Map = "Map",
}

export const tabAtom = atom<TabOption>(TabOption.Asset);

export type MultiAssetPanelCollapse = {
  junction: boolean;
  pipe: boolean;
  pump: boolean;
  valve: boolean;
  reservoir: boolean;
  tank: boolean;
};

export const multiAssetPanelCollapseAtom =
  atomWithStorage<MultiAssetPanelCollapse>("multiAssetPanelCollapse", {
    junction: true,
    pipe: true,
    pump: true,
    valve: true,
    reservoir: true,
    tank: true,
  });

export const pumpEnergySectionsCollapseAtom = atomWithStorage(
  "pumpEnergySectionsCollapse",
  { energy: false, energyResults: false },
);
