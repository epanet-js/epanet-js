import { ISymbology } from "src/types";

export function asNumberExpression({
  symbology,
  defaultValue = 2,
  part,
}: {
  symbology: ISymbology;
  defaultValue?: number;
  part: "stroke-width" | "fill-opacity" | "stroke-opacity" | "circle-opacity";
}): mapboxgl.Expression | number {
  if (symbology.simplestyle) {
    return ["coalesce", ["get", part], defaultValue];
  }
  return defaultValue;
}
export function asColorExpression({
  symbology,
  part = "fill",
}: {
  symbology: ISymbology;
  part?: "fill" | "stroke";
}): mapboxgl.Expression | string {
  const expression = asColorExpressionInner({ symbology });
  if (symbology.simplestyle) {
    return ["coalesce", ["get", part], expression];
  }
  return expression;
}

function asColorExpressionInner({
  symbology,
}: {
  symbology: ISymbology;
}): mapboxgl.Expression | string {
  const { defaultColor } = symbology;
  switch (symbology.type) {
    case "none": {
      return defaultColor;
    }
    case "categorical": {
      return [
        "match",
        ["get", symbology.property],
        ...symbology.stops.flatMap((stop) => [stop.input, stop.output]),
        defaultColor,
      ];
    }
  }
}
