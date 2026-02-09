import { useMemo } from "react";
import { CurvePoint, getPumpCurveType } from "src/hydraulic-model/curves";
import { generateSmoothPumpCurvePoints } from "src/hydraulic-model/pump-curve-fitting";
import { LineGraph, StyledPointValue } from "src/components/graphs/line-graph";
import { useTranslate } from "src/hooks/use-translate";
import { colors } from "src/lib/constants";

interface CurveGraphProps {
  points: CurvePoint[];
  selectedPointIndex?: number | null;
  onPointClick?: (index: number | null) => void;
}

export function CurveGraph({
  points,
  selectedPointIndex,
  onPointClick,
}: CurveGraphProps) {
  const translate = useTranslate();

  const styledPoints: StyledPointValue[] = points.map((p, i) => ({
    x: p.x,
    y: p.y,
    itemStyle:
      i === selectedPointIndex ? { color: colors.fuchsia500 } : undefined,
  }));

  const smoothCurvePoints: StyledPointValue[] | undefined = useMemo(() => {
    const curveType = getPumpCurveType(points);
    const smooth = generateSmoothPumpCurvePoints(points, curveType);
    if (!smooth) return undefined;
    return smooth.map((p) => ({ x: p.x, y: p.y }));
  }, [points]);

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
