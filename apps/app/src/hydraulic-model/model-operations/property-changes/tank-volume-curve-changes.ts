import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import type { Curves, CurveId } from "src/hydraulic-model/curves";

export function tankVolumeCurveChanges(
  curves: Curves,
  curveId: CurveId | null,
): PropertyChange[] | null {
  if (curveId === null) {
    return [{ property: "volumeCurveId", value: undefined }];
  }

  const curve = curves.get(curveId);
  if (!curve || curve.points.length === 0) return null;

  return [
    { property: "volumeCurveId", value: curveId },
    { property: "minLevel", value: curve.points[0].x },
    { property: "maxLevel", value: curve.points[curve.points.length - 1].x },
    { property: "minVolume", value: curve.points[0].y },
  ];
}
