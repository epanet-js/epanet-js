import { useMemo } from "react";
import { CurvePoint, PumpCurveType } from "src/hydraulic-model/curves";
import { synthesizeThreePoints } from "src/hydraulic-model/pump-curve-fitting";
import { LineGraph, StyledPointValue } from "src/components/graphs/line-graph";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { colors } from "src/lib/constants";
import { Unit } from "src/quantity";

interface CurveGraphProps {
  points: CurvePoint[];
  curveType: PumpCurveType;
  fittedPoints: CurvePoint[] | null;
  selectedPointIndex?: number | null;
  onPointClick?: (index: number | null) => void;
  errorIndices?: Set<number>;
  flowUnit: Unit;
  headUnit: Unit;
}

export function CurveGraph({
  points,
  curveType,
  fittedPoints,
  selectedPointIndex,
  onPointClick,
  errorIndices,
  flowUnit,
  headUnit,
}: CurveGraphProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const styledPoints: StyledPointValue[] = useMemo(() => {
    const originalPoints: StyledPointValue[] = points.map((p, i) => {
      const isError = errorIndices?.has(i);
      const isSelected = i === selectedPointIndex;
      return {
        x: p.x,
        y: p.y,
        itemStyle: isError
          ? { color: colors.orange500 }
          : isSelected
            ? { color: colors.fuchsia500 }
            : undefined,
        symbol: isError ? "triangle" : undefined,
        symbolSize: isError ? 10 : undefined,
      };
    });

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
  }, [points, selectedPointIndex, curveType, errorIndices]);

  const linePoints: StyledPointValue[] | undefined = useMemo(() => {
    if (curveType === "multiPointCurve") {
      return points.map((p, i) => ({
        x: p.x,
        y: p.y,
        lineStyle:
          i < points.length - 1 &&
          (points[i + 1].x <= points[i].x || points[i + 1].y >= points[i].y)
            ? { color: "transparent" }
            : undefined,
      }));
    }
    if (!fittedPoints) return undefined;
    return fittedPoints.map((p) => ({ x: p.x, y: p.y }));
  }, [points, fittedPoints, curveType]);

  return (
    <LineGraph
      points={styledPoints}
      linePoints={linePoints}
      onPointClick={onPointClick}
      xAxisLabel={
        flowUnit
          ? `${translate("flow")} (${translateUnit(flowUnit)})`
          : translate("flow")
      }
      yAxisLabel={
        headUnit
          ? `${translate("head")} (${translateUnit(headUnit)})`
          : translate("head")
      }
    />
  );
}
