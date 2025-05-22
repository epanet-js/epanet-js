import { SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { isFeatureOn } from "src/infra/feature-flags";
import { colors } from "src/lib/constants";

export const linkLabelsLayer = ({
  sources,
}: {
  sources: DataSource[];
}): SymbolLayer[] => {
  if (!isFeatureOn("FLAG_LABELS")) return [];

  return sources.map(
    (source) =>
      ({
        id: `${source}-link-labels`,
        type: "symbol",
        source: source,
        paint: {
          "text-halo-color": "#fff",
          "text-halo-width": 1,
          "text-halo-blur": 0.8,
          "text-color": colors.gray700,
        },
        layout: {
          "text-field": ["get", "label"],
          "symbol-placement": "line",
          "symbol-avoid-edges": true,
          "icon-optional": true,
          "text-size": 13,
          "text-justify": "center",
          "text-offset": [0, -0.8],
          "text-allow-overlap": true,
        },
        filter: ["==", "type", "pipe"],
        minzoom: 14,
      }) as SymbolLayer,
  );
};
