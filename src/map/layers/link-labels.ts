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
          "text-halo-width": 2,
          "text-halo-blur": 0.8,
          "text-color": colors.gray700,
          "text-opacity": [
            "case",
            ["boolean", ["feature-state", "hidden"], false],
            0,
            1,
          ],
        },
        layout: {
          "text-field": ["get", "label"],
          "symbol-placement": "line",
          "icon-optional": true,
          "text-size": 11,
          "text-letter-spacing": 0.05,
          "text-max-angle": 10,
          "text-justify": "center",
          "text-offset": [0, -1.1],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        filter: ["==", "type", "pipe"],
        minzoom: 15,
      }) as SymbolLayer,
  );
};
