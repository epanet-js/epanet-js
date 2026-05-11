import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import type { PumpDefinitionType } from "src/hydraulic-model/asset-types/pump";
import type { CurveId, CurvePoint } from "src/hydraulic-model/curves";

export type PumpDefinitionOptions = {
  power?: number;
  curveId?: CurveId;
  curve?: CurvePoint[];
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
        { property: "curveId", value: undefined },
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
        { property: "curveId", value: undefined },
      ];
  }
}
