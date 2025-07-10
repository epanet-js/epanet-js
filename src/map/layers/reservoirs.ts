import { AnyLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";

export const reservoirLayers = ({
  sources,
}: {
  sources: DataSource[];
}): AnyLayer[] => {
  return [
    ...sources.map(
      (source) =>
        ({
          id: `${source}-reservoirs`,
          type: "symbol",
          source,
          layout: {
            "symbol-placement": "point",
            "icon-image": [
              "case",
              ["==", ["get", "selected"], true],
              "reservoir-selected",
              "reservoir",
            ],
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              13,
              0.2,
              20,
              0.5,
            ],
            "icon-allow-overlap": true,
          },
          filter: ["==", ["get", "type"], "reservoir"],
          paint: {
            "icon-opacity": [
              "case",
              ["!=", ["feature-state", "hidden"], true],
              1,
              0,
            ],
          },
        }) as SymbolLayer,
    ),
  ];
};
