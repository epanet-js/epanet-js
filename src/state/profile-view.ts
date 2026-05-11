import { atom } from "jotai";
import { AssetId } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { Unit } from "src/quantity";
import {
  HglRange,
  SyncProfileViewData,
  TerrainPoint,
} from "src/panels/profile-view/chart-types";
import { Mode, modeAtom } from "src/state/mode";

export type { PathData };

export type ProfileViewSnapshot = {
  id: string;
  startNodeId: AssetId;
  endNodeId: AssetId;
  nodeIds: AssetId[];
  linkIds: AssetId[];
  data: SyncProfileViewData;
  terrain: TerrainPoint[] | null;
  hglRanges: (HglRange | null)[] | null;
  units: {
    elevation: Unit;
    length: Unit;
    pressure: Unit;
  };
  decimals: {
    elevation: number;
    length: number;
    pressure: number;
  };
  isUnprojected: boolean;
};

export type ProfileViewUiPhase =
  | "idle"
  | "selectingStart"
  | "selectingEnd"
  | "showingProfile"
  | "pathBroken";

export const profileViewAtom = atom<ProfileViewSnapshot | null>(null);

export const profileViewOpenAtom = atom(false);

export const hasProfileViewAtom = atom(
  (get) =>
    get(profileViewOpenAtom) ||
    get(profileViewAtom) !== null ||
    get(modeAtom).mode === Mode.PROFILE_VIEW,
);
