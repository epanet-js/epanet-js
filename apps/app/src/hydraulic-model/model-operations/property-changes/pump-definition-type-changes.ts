import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import {
  type PumpDefinitionType,
  type CurveId,
  type CurvePoint,
} from "@epanet-js/hydraulic-model";

export type PumpDefinitionOptions = {
  power?: number | null;
  curveId?: CurveId | null;
  curve?: CurvePoint[] | null;
};

export function pumpDefinitionTypeChanges(
  newType: PumpDefinitionType,
  options?: PumpDefinitionOptions,
): PropertyChange[] {
  switch (newType) {
    case "power":
      return [
        { property: "definitionType", value: "power" },
        ...(options?.power !== undefined
          ? [{ property: "power", value: options.power } as PropertyChange]
          : []),
        { property: "curveId", value: null },
      ];
    case "curveId":
      return [
        { property: "definitionType", value: "curveId" },
        ...(options?.curveId !== undefined
          ? [{ property: "curveId", value: options.curveId } as PropertyChange]
          : []),
      ];
    case "designPointCurve":
    case "standardCurve":
      return [
        { property: "definitionType", value: newType },
        ...(options?.curve !== undefined
          ? [{ property: "curve", value: options.curve } as PropertyChange]
          : []),
        { property: "curveId", value: null },
      ];
  }
}
