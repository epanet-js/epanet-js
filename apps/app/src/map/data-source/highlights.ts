import { Feature } from "src/types";
import { Highlight } from "src/state/highlights";
import { AssetsMap, LinkAsset } from "src/hydraulic-model";

export const buildHighlightsSource = (
  highlights: Highlight[],
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];
  for (const highlight of highlights) {
    if (highlight.type === "marker") {
      const properties: Record<string, unknown> = { marker: true };
      if (highlight.nodeType === "tank" || highlight.nodeType === "reservoir") {
        properties.icon = `${highlight.nodeType}-highlight`;
      } else if (
        highlight.linkType !== "pump" &&
        highlight.linkType !== "valve"
      ) {
        properties.dot = true;
      }
      features.push({
        type: "Feature",
        properties,
        geometry: {
          type: "Point",
          coordinates: highlight.coordinates,
        },
      } as Feature);
      continue;
    }

    const asset = assets.get(highlight.assetId);
    if (!asset || asset.feature.properties?.visibility === false) continue;
    if (!asset.isLink) continue;

    const link = asset as LinkAsset;
    features.push({
      type: "Feature",
      id: `highlight-link-${highlight.assetId}`,
      properties: { halo: true },
      geometry: {
        type: "LineString",
        coordinates: link.coordinates,
      },
    } as Feature);
  }
  return features;
};
