import { ISymbolization } from "src/types";

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
