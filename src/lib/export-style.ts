import {
  CIRCLE_PAINT,
  FILL_PAINT,
  LINE_PAINT,
} from "src/lib/load-and-augment-style";
import { ISymbology } from "src/types";
import { asColorExpression } from "./symbolization-deprecated";

export interface EOption {
  name: string;
  value: string;
}

export function exportStyle(symbology: ISymbology): EOption[] {
  return [
    {
      name: "Mapbox GL Style: Line",
      value: JSON.stringify(LINE_PAINT(symbology, true), null, 2),
    },
    {
      name: "Mapbox GL Style: Fill",
      value: JSON.stringify(FILL_PAINT(symbology, true), null, 2),
    },
    {
      name: "Mapbox GL Style: Circle",
      value: JSON.stringify(CIRCLE_PAINT(symbology), null, 2),
    },
    {
      name: "Mapbox GL Expression",
      value: JSON.stringify(
        asColorExpression({
          symbology: {
            ...symbology,
            simplestyle: false,
          },
        }),
        null,
        2,
      ),
    },
  ];
}
