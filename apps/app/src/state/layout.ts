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
  bottomOpen: boolean;
  rightOpen: boolean;
  right: number;
  leftOpen: boolean;
  left: number;
}

export type PanelLayout = "AUTO" | "FLOATING" | "VERTICAL";

export const defaultSplits: Splits = {
  layout: "AUTO",
  bottom: 300,
  bottomOpen: false,
  rightOpen: true,
  right: 320,
  leftOpen: false,
  left: 300,
};
export const splitsAtom = atom<Splits>(defaultSplits);

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
  customerPoint: boolean;
};

const DEFAULT_MULTI_ASSET_PANEL_COLLAPSE: MultiAssetPanelCollapse = {
  junction: true,
  pipe: true,
  pump: true,
  valve: true,
  reservoir: true,
  tank: true,
  customerPoint: true,
};

const storedMultiAssetPanelCollapseAtom = atomWithStorage<
  Partial<MultiAssetPanelCollapse>
>("multiAssetPanelCollapse", DEFAULT_MULTI_ASSET_PANEL_COLLAPSE);

export const multiAssetPanelCollapseAtom = atom<
  MultiAssetPanelCollapse,
  [
    | MultiAssetPanelCollapse
    | ((prev: MultiAssetPanelCollapse) => MultiAssetPanelCollapse),
  ],
  void
>(
  (get) => ({
    ...DEFAULT_MULTI_ASSET_PANEL_COLLAPSE,
    ...get(storedMultiAssetPanelCollapseAtom),
  }),
  (get, set, next) => {
    const current: MultiAssetPanelCollapse = {
      ...DEFAULT_MULTI_ASSET_PANEL_COLLAPSE,
      ...get(storedMultiAssetPanelCollapseAtom),
    };
    set(
      storedMultiAssetPanelCollapseAtom,
      typeof next === "function" ? next(current) : next,
    );
  },
);

export type AssetPanelSectionExpanded = {
  connections: boolean;
  activeTopology: boolean;
  modelAttributes: boolean;
  controls: boolean;
  demands: boolean;
  quality: boolean;
  simulationResults: boolean;
  energy: boolean;
  energyResults: boolean;
};

export const assetPanelSectionsExpandedAtom =
  atomWithStorage<AssetPanelSectionExpanded>("assetPanelSectionsCollapse", {
    connections: true,
    activeTopology: true,
    modelAttributes: true,
    controls: true,
    demands: true,
    quality: true,
    simulationResults: true,
    energy: false,
    energyResults: false,
  });

export type MapStylingPanelSectionExpanded = {
  nodeSymbology: boolean;
  linkSymbology: boolean;
  customerPoints: boolean;
  zoneSymbology: boolean;
  elevations: boolean;
  layers: boolean;
  projection: boolean;
};

export const mapStylingPanelSectionsExpandedAtom =
  atomWithStorage<MapStylingPanelSectionExpanded>(
    "mapStylingPanelSectionsCollapse",
    {
      nodeSymbology: true,
      linkSymbology: true,
      customerPoints: true,
      zoneSymbology: true,
      elevations: true,
      layers: true,
      projection: true,
    },
  );
