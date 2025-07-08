import { AnyLayer, CircleLayer, SymbolLayer } from "mapbox-gl";
import { ISymbology } from "src/types";
import { LINE_COLORS_SELECTED, POINT_COLORS_SELECTED } from "src/lib/constants";
import { DataSource } from "../data-source";

export const tankLayers = ({
  sources,
  symbology,
}: {
  sources: DataSource[];
  symbology: ISymbology;
}): AnyLayer[] => {
  return [
    ...sources.map(
      (source) =>
        ({
          id: `${source}-tank-selected`,
          type: "circle",
          source,
          layout: {},
          filter: ["all", ["==", "type", "tank"], ["==", "selected", true]],
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              8,
              20,
              22,
            ],
            "circle-color": LINE_COLORS_SELECTED,
            "circle-opacity": [
              "case",
              ["!=", ["feature-state", "hidden"], true],
              0.8,
              0,
            ],
            "circle-blur": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12,
              0,
              20,
              0.8,
            ],
          },
          minzoom: 10,
        }) as CircleLayer,
    ),
    ...sources.map(
      (source) =>
        ({
          id: `${source}-tanks`,
          type: "symbol",
          source,
          layout: {
            "symbol-placement": "point",
            "icon-image": "tank",
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0.2,
              20,
              0.4,
            ],
            "icon-allow-overlap": true,
          },
          filter: ["==", ["get", "type"], "tank"],
          paint: {
            "icon-opacity": [
              "case",
              ["!=", ["feature-state", "hidden"], true],
              1,
              0,
            ],
            "icon-color": [
              "case",
              ["==", ["feature-state", "selected"], "true"],
              POINT_COLORS_SELECTED,
              symbology.defaultColor,
            ],
          },
        }) as SymbolLayer,
    ),
  ];
};
