import { atom } from "jotai";
import {
  profileViewAtom,
  profileHoverAtom,
  buildProfileFeatures,
} from "src/state/profile-view";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";

export const mapOverlayFeaturesAtom = atom<GeoJSON.Feature[]>([]);

export const combinedMapOverlayFeaturesAtom = atom<GeoJSON.Feature[]>((get) => {
  const overlay = get(mapOverlayFeaturesAtom);
  const profileState = get(profileViewAtom);
  const model = get(stagingModelDerivedAtom);
  const hoveredId = get(profileHoverAtom);

  const profileFeatures = buildProfileFeatures(profileState, model.assets);

  if (
    profileState.phase !== "idle" &&
    hoveredId !== null &&
    !hoveredId.isLink
  ) {
    const hoveredNode = model.assets.get(hoveredId.id);
    if (hoveredNode && !hoveredNode.isLink) {
      profileFeatures.push({
        type: "Feature",
        properties: { profileType: "hover", assetId: hoveredId.id },
        geometry: {
          type: "Point",
          coordinates: (hoveredNode as unknown as { coordinates: number[] })
            .coordinates,
        },
      });
    }
  }

  if (profileFeatures.length === 0) return overlay;
  return [...overlay, ...profileFeatures];
});
