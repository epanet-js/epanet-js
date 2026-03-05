import { CurvePoint, CurveType } from "src/hydraulic-model/curves";
import { getCurveTypeConfig } from "./curve-type-config";
import { useTranslate } from "src/hooks/use-translate";
import { NotificationBanner } from "src/components/notifications";
import { TriangleAlert } from "lucide-react";

interface CurveErrorBannerProps {
  points: CurvePoint[];
  curveType?: CurveType;
}

export function CurveErrorBanner({ points, curveType }: CurveErrorBannerProps) {
  const translate = useTranslate();
  const curveConfig = getCurveTypeConfig(curveType);
  const errors = curveConfig.getErrors(points);

  if (errors.length === 0) return null;

  const hasXError = errors.some((e) => e.value === "x");
  const hasYError = errors.some((e) => e.value === "y");
  const xLabel = translate(curveConfig.xLabel);
  const yLabel = translate(curveConfig.yLabel);

  // When every error is at index 0 with both x and y flagged, the curve
  // simply needs more points (e.g. volume, headloss, generic curves).
  const needsMorePoints =
    points.length === 1 &&
    hasXError &&
    hasYError &&
    errors.every((e) => e.index === 0);

  if (needsMorePoints) {
    return (
      <NotificationBanner
        variant="warning"
        title={translate("curves.invalidCurve")}
        description={translate("curveValidation.needsMorePoints")}
        Icon={TriangleAlert}
        className="mt-2"
      />
    );
  }

  let description: string;

  if (points.length === 1) {
    const parts: string[] = [];
    if (hasXError)
      parts.push(translate("curveValidation.needsNonZeroValue", xLabel));
    if (hasYError)
      parts.push(translate("curveValidation.needsNonZeroValue", yLabel));
    description = parts.join(" ");
  } else {
    const parts: string[] = [];
    if (hasXError)
      parts.push(translate("curveValidation.valueAscendingOrder", xLabel));
    if (hasYError) {
      const yKey =
        curveType === "pump"
          ? "curveValidation.valueDescendingOrder"
          : "curveValidation.valueAscendingOrder";
      parts.push(translate(yKey, yLabel));
    }
    description = parts.join(" ");
  }

  return (
    <NotificationBanner
      variant="warning"
      title={translate("curves.invalidCurve")}
      description={description}
      Icon={TriangleAlert}
      className="mt-2"
    />
  );
}
