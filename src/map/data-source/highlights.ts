import { Feature } from "src/types";
import { Highlight } from "src/state/highlights";

export const buildHighlightsSource = (highlights: Highlight[]): Feature[] => {
  const features: Feature[] = [];
  for (const highlight of highlights) {
    if (highlight.type === "marker") {
      features.push(buildMarkerFeature(highlight.coordinates));
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
