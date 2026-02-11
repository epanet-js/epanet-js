import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { CurveGraph } from "./curve-graph";
import {
  CurvePoint,
  PumpCurveType,
  getPumpCurveErrors,
} from "src/hydraulic-model/curves";
import {
  fitPumpCurve,
  generateSmoothPointsFromCoefficients,
  generateSmoothPumpCurvePoints,
} from "src/hydraulic-model/pump-curve-fitting";
import { type GridSelection } from "src/components/data-grid";
import { CurveTable, type CurveTableRef } from "./curve-table";
import { useTranslate } from "src/hooks/use-translate";
import { InlineField } from "src/components/form/fields";
import { NotificationBanner } from "src/components/notifications";
import { TriangleAlert } from "lucide-react";
import { Unit } from "src/quantity";

interface CurveDetailProps {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  readOnly?: boolean;
  flowUnit: Unit;
  headUnit: Unit;
}

export function CurveDetail({
  points,
  onChange,
  readOnly = false,
  flowUnit,
  headUnit,
}: CurveDetailProps) {
  const [selectedCells, setSelectedCells] = useState<GridSelection | null>(
    null,
  );
  const tableRef = useRef<CurveTableRef>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const handleGraphClick = useCallback(
    (pointIndex: number | null) => {
      if (pointIndex === null) {
        setSelectedCells(null);
        return;
      }
      const rowIndex = pointIndex % points.length;
      const newSelection = {
        min: { col: 0, row: rowIndex },
        max: { col: 1, row: rowIndex },
      };
      setSelectedCells(newSelection);
      tableRef.current?.selectCells({ rowIndex });
    },
    [points.length],
  );

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInsideTable = tableContainerRef.current?.contains(target);
      const isInsideGraph = graphContainerRef.current?.contains(target);
      if (!isInsideTable && !isInsideGraph) {
        setSelectedCells(null);
        tableRef.current?.clearSelection();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const translate = useTranslate();
  const graphSelectedIndex = selectedCells ? selectedCells.min.row : null;

  const errors = useMemo(() => getPumpCurveErrors(points), [points]);
  const isValid = errors.length === 0;

  const errorCells = useMemo(() => {
    const set = new Set<string>();
    for (const e of errors) {
      set.add(`${e.index}:${e.value}`);
    }
    return set;
  }, [errors]);

  const errorIndices = useMemo(() => {
    const set = new Set<number>();
    for (const e of errors) {
      set.add(e.index);
    }
    return set;
  }, [errors]);

  const { curveType, smoothCurvePoints } = useMemo(() => {
    if (points.length === 1) {
      const curveType: PumpCurveType = "designPointCurve";
      if (!isValid)
        return { curveType, smoothCurvePoints: null as CurvePoint[] | null };
      const smooth = generateSmoothPumpCurvePoints(points, curveType);
      return { curveType, smoothCurvePoints: smooth };
    }

    if (points.length === 3) {
      const coefficients = fitPumpCurve(points);
      if (coefficients) {
        const curveType: PumpCurveType = "standardCurve";
        if (!isValid)
          return { curveType, smoothCurvePoints: null as CurvePoint[] | null };
        const smooth = generateSmoothPointsFromCoefficients(coefficients);
        return { curveType, smoothCurvePoints: smooth };
      }
    }

    return {
      curveType: "multiPointCurve" as PumpCurveType,
      smoothCurvePoints: null as CurvePoint[] | null,
    };
  }, [points, isValid]);

  const warningMessage = useMemo(() => {
    if (errors.length === 0) return null;
    const hasFlowError = errors.some((e) => e.value === "flow");
    const hasHeadError = errors.some((e) => e.value === "head");
    if (hasFlowError && hasHeadError) {
      return `${translate("curveValidation.flowAscendingOrder")} ${translate("curveValidation.headDescendingOrder")}`;
    }
    if (hasFlowError) return translate("curveValidation.flowAscendingOrder");
    return translate("curveValidation.headDescendingOrder");
  }, [errors, translate]);

  const handleTableSelectionChange = useCallback(
    (selection: GridSelection | null) => {
      setSelectedCells(selection);
    },
    [],
  );

  return (
    <div className="flex flex-col h-full">
      {warningMessage && (
        <NotificationBanner
          variant="warning"
          title={translate("invalidCurve")}
          description={warningMessage}
          Icon={TriangleAlert}
          className="mb-2"
        />
      )}
      <div
        ref={tableContainerRef}
        className="flex-1 min-h-0 overflow-hidden mb-4"
      >
        <CurveTable
          ref={tableRef}
          points={points}
          onChange={onChange}
          onSelectionChange={handleTableSelectionChange}
          readOnly={readOnly}
          errorCells={errorCells}
          flowUnit={flowUnit}
          headUnit={headUnit}
        />
      </div>
      <InlineField name={translate("pumpType")} layout="label-flex-none">
        <span className="text-sm">
          {isValid ? translate(curveType) : translate("invalidCurve")}
        </span>
      </InlineField>
      <div className="flex-1 min-h-0 p-2 pt-4 border border-gray-200 dark:border-gray-700 mt-[.25rem]">
        <div ref={graphContainerRef} className="h-full">
          <CurveGraph
            points={points}
            curveType={curveType}
            fittedPoints={smoothCurvePoints}
            selectedPointIndex={graphSelectedIndex}
            onPointClick={handleGraphClick}
            errorIndices={errorIndices}
            flowUnit={flowUnit}
            headUnit={headUnit}
          />
        </div>
      </div>
    </div>
  );
}
