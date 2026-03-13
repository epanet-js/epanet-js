import { forwardRef } from "react";
import { CurvePoint, CurvePointsType } from "src/hydraulic-model/curves";
import {
  fitCurve,
  synthesizeThreePoints,
  generateSmoothPointsFromCoefficients,
} from "src/hydraulic-model/curve-fitting";
import { LineGraph, StyledPointValue } from "src/components/graphs/line-graph";
import { colors } from "src/lib/constants";
import { CurveType } from "src/hydraulic-model/curves";
import { getCurveTypeConfig } from "./curve-type-config";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { InlineFieldLegacy } from "src/components/form/fields";
import type { UnitsSpec } from "src/model-metadata/quantities-spec";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

interface CurveGraphProps {
  points: CurvePoint[];
  curveType?: CurveType;
  units: UnitsSpec;
  selectedPointIndex?: number | null;
  onPointClick?: (index: number | null) => void;
}

export const CurveGraph = forwardRef<HTMLDivElement, CurveGraphProps>(
  function CurveGraph(
    { points, curveType, units, selectedPointIndex, onPointClick },
    ref,
  ) {
    const translate = useTranslate();
    const translateUnit = useTranslateUnit();
    const curveConfig = getCurveTypeConfig(curveType);

    const xAxisLabel = (() => {
      const label = translate(curveConfig.xLabel);
      const unit = curveConfig.xQuantity
        ? units[curveConfig.xQuantity]
        : undefined;
      return unit ? `${label} (${translateUnit(unit)})` : label;
    })();

    const yAxisLabel = (() => {
      const label = translate(curveConfig.yLabel);
      const unit = curveConfig.yQuantity
        ? units[curveConfig.yQuantity]
        : undefined;
      return unit ? `${label} (${translateUnit(unit)})` : label;
    })();

    const errorIndices = getErrorIndices(curveType, points);
    const { line, curvePointsType } = getLinePoints(
      curveType,
      points,
      errorIndices,
    );

    const styledPoints: StyledPointValue[] = points.map((p, i) => {
      const isError = errorIndices.has(i);
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

    if (curvePointsType === "designPointCurve" && points.length === 1) {
      const threePoints = synthesizeThreePoints(points[0]);
      const shutoff = threePoints[0];
      const maxFlow = threePoints[2];
      styledPoints.push(
        { x: shutoff.x, y: shutoff.y, itemStyle: { color: colors.gray400 } },
        { x: maxFlow.x, y: maxFlow.y, itemStyle: { color: colors.gray400 } },
      );
    }
    const isModalsOn = useFeatureFlag("FLAG_MODALS");

    return (
      <>
        <div className="mb-[.25rem] w-full">
          <InlineFieldLegacy name={translate("curveType")} layout="label-flex-none">
            <span className="text-sm">{translate(curvePointsType)}</span>
          </InlineFieldLegacy>
        </div>
        <div
          className={`flex-1 min-h-0 ${isModalsOn ? "p-2" : "p-2 pt-4 border border-gray-200 dark:border-gray-700"}`}
        >
          <div ref={ref} className="h-full">
            <LineGraph
              points={styledPoints}
              linePoints={line}
              onPointClick={onPointClick}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
            />
          </div>
        </div>
      </>
    );
  },
);

const getErrorIndices = (
  curveType: CurveType | undefined,
  points: CurvePoint[],
): Set<number> => {
  const config = getCurveTypeConfig(curveType);
  const errors = config.getErrors(points);
  const indices = new Set<number>();
  for (const e of errors) {
    indices.add(e.index);
  }
  return indices;
};

const getLinePoints = (
  curveType: CurveType | undefined,
  points: CurvePoint[],
  errorIndices: Set<number>,
): {
  line: StyledPointValue[] | undefined;
  curvePointsType: CurvePointsType;
} => {
  const isValid = errorIndices.size === 0;

  // Pump curves: power function for 1/3-point design and standard curves
  if (curveType === "pump") {
    let curvePointsType: CurvePointsType = "multiPointCurve";
    let coefficients = null;

    if (points.length === 1) {
      curvePointsType = "designPointCurve";
      coefficients = fitCurve(synthesizeThreePoints(points[0]));
    } else if (points.length === 3) {
      coefficients = fitCurve(points);
      if (coefficients) curvePointsType = "standardCurve";
    }

    if (isValid && coefficients) {
      const smooth = generateSmoothPointsFromCoefficients(coefficients);
      return {
        line: smooth?.map((p) => ({ x: p.x, y: p.y })),
        curvePointsType,
      };
    }

    // Fitting failed or invalid: fall through to piecewise-linear
  }

  // Piecewise-linear for all other cases
  const dataLine: StyledPointValue[] = points.map((p, i) => ({
    x: p.x,
    y: p.y,
    lineStyle:
      i < points.length - 1 && errorIndices.has(i) && errorIndices.has(i + 1)
        ? { color: "transparent" }
        : undefined,
  }));

  // PCV valve: extrapolation from (0,0) to first point and from last point to (100,100)
  if (curveType === "valve" && points.length > 0 && !errorIndices.size) {
    const extraStyle = { color: colors.gray400 };
    const last = dataLine[dataLine.length - 1];
    return {
      line: [
        { x: 0, y: 0, lineStyle: extraStyle },
        { ...dataLine[0], lineStyle: extraStyle },
        ...dataLine,
        { x: last.x, y: last.y, lineStyle: extraStyle },
        { x: 100, y: 100, lineStyle: extraStyle },
      ],
      curvePointsType: "multiPointCurve",
    };
  }

  return { line: dataLine, curvePointsType: "multiPointCurve" };
};
