import { Feature } from "src/types";
import { Highlight } from "src/state/highlights";
import { AssetsMap } from "src/hydraulic-model";
import type { ResultsReader } from "src/simulation/results-reader";
import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { buildFeatureId } from "./features";
import {
  buildIconSelectionFeature,
  buildLinkIconSelectionFeature,
  buildLinkSelectionFeature,
  buildPointSelectionFeature,
} from "./selection";

export const buildHighlightsSource = (
  highlights: Highlight[],
  assets: AssetsMap,
  units: UnitsSpec,
  simulationResults?: ResultsReader | null,
): Feature[] => {
  const features: Feature[] = [];
  for (const highlight of highlights) {
    if (highlight.type === "marker") {
      features.push(buildMarkerFeature(highlight.coordinates));
      continue;
    }

    if (highlight.type === "asset") {
      const asset = assets.get(highlight.assetId);
      if (!asset || asset.feature.properties?.visibility === false) {
        continue;
      }

      const featureId = buildFeatureId(highlight.assetId);

      if (asset.isLink) {
        features.push(
          buildLinkSelectionFeature(asset, featureId, units, simulationResults),
        );

        const needsIcon =
          asset.type === "pump" ||
          asset.type === "valve" ||
          (asset.type === "pipe" && (asset as any).initialStatus === "cv");

        if (needsIcon) {
          features.push(buildLinkIconSelectionFeature(asset, featureId));
        }
      } else if (asset.type === "junction") {
        features.push(buildPointSelectionFeature(asset, featureId));
      } else {
        features.push(buildIconSelectionFeature(asset, featureId));
      }
    }
  }
  return features;
};

const buildMarkerFeature = (coordinates: [number, number]): Feature => {
  return {
    type: "Feature",
    properties: { marker: true },
    geometry: {
      type: "Point",
      coordinates,
    },
  } as Feature;
};
