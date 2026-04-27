import { atom } from "jotai";
import { AssetId } from "src/hydraulic-model";
import { AssetsMap } from "src/hydraulic-model";

export type PathData = {
  nodeIds: AssetId[];
  linkIds: AssetId[];
  totalLength: number;
};

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

export const profileHoverAtom = atom<{ id: AssetId; isLink: boolean } | null>(
  null,
);

export const profileChartHoverPositionAtom = atom<{
  coordinates: [number, number];
} | null>(null);

export type ProfileModifier = "none" | "extend" | "subtract";
export const profileModifierAtom = atom<ProfileModifier>("none");

export function buildProfileFeatures(
  state: ProfileViewState,
  assets: AssetsMap,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];

  if (state.phase === "selectingEnd") {
    const startNode = assets.get(state.startNodeId);
    if (startNode && !startNode.isLink) {
      features.push({
        type: "Feature",
        properties: { profileType: "start", assetId: state.startNodeId },
        geometry: {
          type: "Point",
          coordinates: (startNode as unknown as { coordinates: number[] })
            .coordinates,
        },
      });
    }
  }

  if (state.phase === "showingProfile") {
    const startNode = assets.get(state.startNodeId);
    const endNode = assets.get(state.endNodeId);
    if (startNode && !startNode.isLink) {
      features.push({
        type: "Feature",
        properties: { profileType: "start", assetId: state.startNodeId },
        geometry: {
          type: "Point",
          coordinates: (startNode as unknown as { coordinates: number[] })
            .coordinates,
        },
      });
    }
    if (endNode && !endNode.isLink) {
      features.push({
        type: "Feature",
        properties: { profileType: "end", assetId: state.endNodeId },
        geometry: {
          type: "Point",
          coordinates: (endNode as unknown as { coordinates: number[] })
            .coordinates,
        },
      });
    }
  }

  return features;
}
