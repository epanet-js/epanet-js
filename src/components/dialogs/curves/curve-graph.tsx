import { useMemo } from "react";
import { CurvePoint, CurvePointsType } from "src/hydraulic-model/curves";
import { synthesizeThreePoints } from "src/hydraulic-model/curve-fitting";
import { LineGraph, StyledPointValue } from "src/components/graphs/line-graph";
import { colors } from "src/lib/constants";

interface CurveGraphProps {
  points: CurvePoint[];
  curveType: CurvePointsType;
  fittedPoints: CurvePoint[] | null;
  selectedPointIndex?: number | null;
  onPointClick?: (index: number | null) => void;
  errorIndices?: Set<number>;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function CurveGraph({
  points,
  curveType,
  fittedPoints,
  selectedPointIndex,
  onPointClick,
  errorIndices,
  xAxisLabel,
  yAxisLabel,
}: CurveGraphProps) {
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
          errorIndices?.has(i) &&
          errorIndices?.has(i + 1)
            ? { color: "transparent" }
            : undefined,
      }));
    }
    if (!fittedPoints) return undefined;
    return fittedPoints.map((p) => ({ x: p.x, y: p.y }));
  }, [points, fittedPoints, curveType, errorIndices]);

  return (
    <LineGraph
      points={styledPoints}
      linePoints={linePoints}
      onPointClick={onPointClick}
      xAxisLabel={xAxisLabel}
      yAxisLabel={yAxisLabel}
    />
  );
}
