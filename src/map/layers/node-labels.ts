import { SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";
import { colors } from "src/lib/constants";

export const nodeLabelsLayer = ({
  sources,
}: {
  sources: DataSource[];
}): SymbolLayer[] => {
  return sources.map(
    (source) =>
      ({
        id: `${source}-node-labels`,
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
          "symbol-placement": "point",
          "icon-optional": true,
          "text-size": 11,
          "text-font": [
            "Open Sans Bold",
            "Arial Unicode MS Bold",
            "Open Sans Regular",
            "Arial Unicode MS Regular",
          ],
          "text-letter-spacing": 0,
          "text-allow-overlap": false,
          "text-variable-anchor": ["left", "right", "top", "bottom"],
          "text-radial-offset": 1,
        },
        filter: ["==", "type", "junction"],
        minzoom: 15,
      }) as SymbolLayer,
  );
};

export const nodeLabelsLayerWithActiveTopology = ({
  sources,
}: {
  sources: DataSource[];
}): SymbolLayer[] => {
  return sources.map(
    (source) =>
      ({
        id: `${source}-node-labels`,
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
          "symbol-placement": "point",
          "icon-optional": true,
          "text-size": 11,
          "text-font": [
            "Open Sans Bold",
            "Arial Unicode MS Bold",
            "Open Sans Regular",
            "Arial Unicode MS Regular",
          ],
          "text-letter-spacing": 0,
          "text-allow-overlap": false,
          "text-variable-anchor": ["left", "right", "top", "bottom"],
          "text-radial-offset": 1,
        },
        filter: ["==", "type", "junction"],
        minzoom: 15,
      }) as SymbolLayer,
  );
};
