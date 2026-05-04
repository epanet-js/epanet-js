import { atom } from "jotai";
import { AssetId } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";

export type { PathData };

export type ProfileViewPlot = {
  startNodeId: AssetId;
  endNodeId: AssetId;
  path: PathData;
};

export type ProfileViewUiPhase =
  | "idle"
  | "selectingStart"
  | "selectingEnd"
  | "showingProfile";

export const profileViewAtom = atom<ProfileViewPlot | null>(null);
