import { SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";

export const linkLabelsLayer = ({
  sources,
}: {
  sources: DataSource[];
}): SymbolLayer[] => {
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
          "text-color": colors.gray500,
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
          "text-font": [
            "Open Sans Bold",
            "Arial Unicode MS Bold",
            "Open Sans Regular",
            "Arial Unicode MS Regular",
          ],
          "text-letter-spacing": 0,
          "text-max-angle": 10,
          "text-offset": [0, -1.1],
          "text-allow-overlap": false,
          "text-ignore-placement": true,
        },
        filter: ["==", "type", "pipe"],
        minzoom: 15,
      }) as SymbolLayer,
  );
};

export const linkLabelsLayerWithActiveTopology = ({
  sources,
}: {
  sources: DataSource[];
}): SymbolLayer[] => {
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
          "text-color": colors.gray500,
          "text-opacity": [
            "case",
            ["boolean", ["feature-state", "hidden"], false],
            0,
            ["==", ["get", "isActive"], false],
            0,
            1,
          ],
        },
        layout: {
          "text-field": ["get", "label"],
          "symbol-placement": "line",
          "icon-optional": true,
          "text-size": 11,
          "text-font": [
            "Open Sans Bold",
            "Arial Unicode MS Bold",
            "Open Sans Regular",
            "Arial Unicode MS Regular",
          ],
          "text-letter-spacing": 0,
          "text-max-angle": 10,
          "text-offset": [0, -1.1],
          "text-allow-overlap": false,
          "text-ignore-placement": true,
        },
        filter: ["==", "type", "pipe"],
        minzoom: 15,
      }) as SymbolLayer,
  );
};
