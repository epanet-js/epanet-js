import { useMemo } from "react";
import { CurvePoint, getPumpCurveType } from "src/hydraulic-model/curves";
import {
  generateSmoothPumpCurvePoints,
  synthesizeThreePoints,
} from "src/hydraulic-model/pump-curve-fitting";
import { LineGraph, StyledPointValue } from "src/components/graphs/line-graph";
import { useTranslate } from "src/hooks/use-translate";
import { colors } from "src/lib/constants";

interface CurveGraphProps {
  points: CurvePoint[];
  selectedPointIndex?: number | null;
  onPointClick?: (index: number | null) => void;
  isValid?: boolean;
}

export function CurveGraph({
  points,
  selectedPointIndex,
  onPointClick,
  isValid = true,
}: CurveGraphProps) {
  const translate = useTranslate();
  const curveType = getPumpCurveType(points);

  const styledPoints: StyledPointValue[] = useMemo(() => {
    const originalPoints: StyledPointValue[] = points.map((p, i) => ({
      x: p.x,
      y: p.y,
      itemStyle:
        i === selectedPointIndex ? { color: colors.fuchsia500 } : undefined,
    }));

    if (curveType !== "designPointCurve" || points.length !== 1) {
      return originalPoints;
    }

    const threePoints = synthesizeThreePoints(points[0]);
    const shutoff = threePoints[0];
    const maxFlow = threePoints[2];

    return [
      ...originalPoints,
      { x: shutoff.x, y: shutoff.y, itemStyle: { color: colors.gray400 } },
      { x: maxFlow.x, y: maxFlow.y, itemStyle: { color: colors.gray400 } },
    ];
  }, [points, selectedPointIndex, curveType]);

  const smoothCurvePoints: StyledPointValue[] | undefined = useMemo(() => {
    if (!isValid) return undefined;
    const curveType = getPumpCurveType(points);
    const smooth = generateSmoothPumpCurvePoints(points, curveType);
    if (!smooth) return undefined;
    return smooth.map((p) => ({ x: p.x, y: p.y }));
  }, [points, isValid]);

  return (
    <LineGraph
      points={styledPoints}
      smoothCurvePoints={smoothCurvePoints}
      onPointClick={onPointClick}
      xAxisLabel={translate("flow")}
      yAxisLabel={translate("head")}
    />
  );
}
