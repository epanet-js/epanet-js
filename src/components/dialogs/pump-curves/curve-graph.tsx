import { CurvePoint } from "src/hydraulic-model/curves";
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

  return (
    <LineGraph
      points={styledPoints}
      onPointClick={onPointClick}
      xAxisLabel={translate("flow")}
      yAxisLabel={translate("head")}
    />
  );
}
