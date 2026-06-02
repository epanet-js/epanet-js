import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { type ValveKind, valveCurveTypeFrom } from "@epanet-js/hydraulic-model";

export function valveKindChanges(
  newKind: ValveKind,
  oldKind: ValveKind,
): PropertyChange[] {
  const changes: PropertyChange[] = [{ property: "kind", value: newKind }];
  if (valveCurveTypeFrom(newKind) !== valveCurveTypeFrom(oldKind)) {
    changes.push({ property: "curveId", value: undefined });
  }
  return changes;
}
