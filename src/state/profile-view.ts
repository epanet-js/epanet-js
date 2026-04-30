import { atom } from "jotai";
import { AssetId } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";

export type { PathData };

export type ProfileViewState =
  | { phase: "idle" }
  | { phase: "selectingStart" }
  | { phase: "selectingEnd"; startNodeId: AssetId }
  | {
      phase: "showingProfile";
      path: PathData;
      startNodeId: AssetId;
      endNodeId: AssetId;
    };

export const profileViewAtom = atom<ProfileViewState>({ phase: "idle" });
