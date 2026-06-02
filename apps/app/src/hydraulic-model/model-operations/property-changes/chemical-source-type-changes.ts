import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { type ChemicalSourceType } from "@epanet-js/hydraulic-model";

export function chemicalSourceTypeChanges(
  sourceType: ChemicalSourceType | null,
): PropertyChange[] {
  if (sourceType === null) {
    return [
      { property: "chemicalSourceType", value: undefined },
      { property: "chemicalSourceStrength", value: undefined },
      { property: "chemicalSourcePatternId", value: undefined },
    ];
  }
  return [{ property: "chemicalSourceType", value: sourceType }];
}
