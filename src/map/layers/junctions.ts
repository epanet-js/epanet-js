import { CircleLayer } from "mapbox-gl";
import { isFeatureOn } from "src/infra/feature-flags";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import { ISymbolization } from "src/types";

export const junctionsLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: string;
  layerId: string;
  symbolization: ISymbolization;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter:
      isFeatureOn("FLAG_ASSET_IMPORT") && isFeatureOn("FLAG_RESERVOIR")
        ? ["==", ["get", "type"], "junction"]
        : ["all", ["==", "$type", "Point"]],
    paint: {
      "circle-opacity": [
        "case",
        ["boolean", ["feature-state", "hidden"], false],
        0,
        asNumberExpression({
          symbolization,
          part: "circle-opacity",
          defaultValue: 1,
        }),
      ],
      "circle-stroke-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        "white",
      ],
      "circle-stroke-width": 0,
      "circle-radius": 6,
      "circle-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        asColorExpression({
          symbolization,
          part: "stroke",
        }),
      ],
    },
  };
};
export function asNumberExpression({
  symbolization,
  defaultValue = 2,
  part,
}: {
  symbolization: ISymbolization;
  defaultValue?: number;
  part: "stroke-width" | "fill-opacity" | "stroke-opacity" | "circle-opacity";
}): mapboxgl.Expression | number {
  if (symbolization.simplestyle) {
    return ["coalesce", ["get", part], defaultValue];
  }
  return defaultValue;
}

export function asColorExpression({
  symbolization,
  part = "fill",
}: {
  symbolization: ISymbolization;
  part?: "fill" | "stroke";
}): mapboxgl.Expression | string {
  const expression = asColorExpressionInner({ symbolization });
  if (symbolization.simplestyle) {
    return ["coalesce", ["get", part], expression];
  }
  return expression;
}

function asColorExpressionInner({
  symbolization,
}: {
  symbolization: ISymbolization;
}): mapboxgl.Expression | string {
  const { defaultColor } = symbolization;
  switch (symbolization.type) {
    case "none": {
      return defaultColor;
    }
    case "categorical": {
      return [
        "match",
        ["get", symbolization.property],
        ...symbolization.stops.flatMap((stop) => [stop.input, stop.output]),
        defaultColor,
      ];
    }
    case "ramp": {
      return [
        "match",
        ["typeof", ["get", symbolization.property]],
        "number",
        symbolization.interpolate === "linear"
          ? [
              "interpolate-lab",
              ["linear"],
              ["get", symbolization.property],
              ...symbolization.stops.flatMap((stop) => {
                return [stop.input, stop.output];
              }),
            ]
          : [
              "step",
              ["get", symbolization.property],
              defaultColor,
              ...symbolization.stops.flatMap((stop) => {
                return [stop.input, stop.output];
              }),
            ],
        defaultColor,
      ];
    }
  }
}
