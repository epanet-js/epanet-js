import { AnyLayer, SymbolLayer } from "mapbox-gl";
import { DataSource } from "../data-source";

export const tankLayers = ({
  sources,
}: {
  sources: DataSource[];
}): AnyLayer[] => {
  return [
    ...sources.map(
      (source) =>
        ({
          id: `${source}-tanks`,
          type: "symbol",
          source,
          layout: {
            "symbol-placement": "point",
            "icon-image": [
              "case",
              ["==", ["get", "isActive"], false],
              "tank-disabled",
              "tank",
            ],
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
          },
        }) as SymbolLayer,
    ),
  ];
};

export const facetedTankLayers = ({
  sources,
}: {
  sources: DataSource[];
}): AnyLayer[] =>
  tankLayers({ sources }).map((layer) => {
    const symbol = layer as SymbolLayer;
    return {
      ...symbol,
      layout: {
        ...symbol.layout,
        "icon-image": [
          "case",
          [
            "all",
            ["==", ["get", "selected"], true],
            ["==", ["get", "isActive"], false],
          ],
          "tank-disabled-selected",
          ["==", ["get", "selected"], true],
          "tank-selected",
          ["==", ["get", "isActive"], false],
          "tank-disabled",
          "tank",
        ],
      },
    } as SymbolLayer;
  });
