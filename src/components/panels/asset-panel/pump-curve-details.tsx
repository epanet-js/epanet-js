import { useState, useCallback } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { NumericField } from "src/components/form/numeric-field";
import { ICurve } from "src/hydraulic-model/curves";
import { Quantities } from "src/model-metadata/quantities-spec";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Section } from "src/components/form/fields";
import { PumpDefintionType } from "src/hydraulic-model/asset-types/pump";

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

interface MaybePumpCurvePoint {
  flow?: number;
  head?: number;
}

type OnCurveChange = (points: PumpCurvePoint[]) => void;

export const PumpCurveDetails = ({
  curve,
  definitionType,
  quantities,
  onDefaultCurveChange,
}: {
  curve?: ICurve;
  definitionType: PumpDefintionType;
  quantities: Quantities;
  onDefaultCurveChange?: OnCurveChange;
}) => {
  const translate = useTranslate();
  return (
    <div className="bg-gray-50 p-2 -mx-2 rounded-md overflow-hidden">
      <Section title={translate("curveDetails")} variant="secondary">
        <PumpCurveTable
          curve={curve}
          definitionType={definitionType}
          quantities={quantities}
          onCurveChange={onDefaultCurveChange}
        />
      </Section>
    </div>
  );
};

const initialPointsFromCurve = (
  curve: ICurve | undefined,
  definitionType: PumpDefintionType,
): MaybePumpCurvePoint[] => {
  if (!curve || curve.points.length === 0) {
    return [{ flow: 0 }, {}, {}];
  }

  if (definitionType === "design-point") {
    const middleIndex = Math.floor(curve.points.length / 2);
    const designPoint = curve.points[middleIndex] ?? curve.points[0];
    const designFlow = designPoint.x;
    const designHead = designPoint.y;
    return calculateCurvePoints(
      [{}, { flow: designFlow, head: designHead }, {}],
      definitionType,
    );
  }

  const points: MaybePumpCurvePoint[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < curve.points.length) {
      const { x, y } = curve.points[i];
      points.push({ flow: x, head: y });
    } else {
      points.push({});
    }
  }

  points[0] = { ...points[0], flow: 0 };

  return points;
};

const calculateCurvePoints = (
  editingPoints: MaybePumpCurvePoint[],
  definitionType: PumpDefintionType,
): MaybePumpCurvePoint[] => {
  if (definitionType === "standard") {
    return editingPoints;
  }

  if (definitionType === "design-point") {
    const { flow: designFlow, head: designHead } = editingPoints[1];

    return [
      {
        flow: 0,
        head: designHead ? designHead * 1.33 : undefined,
      },
      { flow: designFlow, head: designHead },
      {
        flow: designFlow ? designFlow * 2 : undefined,
        head: 0,
      },
    ];
  }

  return editingPoints;
};

const isValidPoint = (point: MaybePumpCurvePoint): point is PumpCurvePoint => {
  return point.flow !== undefined && point.head !== undefined;
};

type ValidationErrorKey =
  | "curveValidation.fillDesignPoint"
  | "curveValidation.fillAllPoints"
  | "curveValidation.flowAscendingOrder";

type ValidationResult =
  | { valid: true; points: PumpCurvePoint[] }
  | { valid: false; error: ValidationErrorKey };

const validateDesignPointCurve = (
  points: MaybePumpCurvePoint[],
): ValidationResult => {
  const designPoint = points[1];
  if (
    !isValidPoint(designPoint) ||
    designPoint.flow <= 0 ||
    designPoint.head <= 0
  ) {
    return { valid: false, error: "curveValidation.fillDesignPoint" };
  }
  return { valid: true, points: [designPoint] };
};

const validateStandardCurve = (
  points: MaybePumpCurvePoint[],
): ValidationResult => {
  if (points.length !== 3) {
    return { valid: false, error: "curveValidation.fillAllPoints" };
  }
  const [shutoff, design, maxOp] = points;

  if (
    shutoff?.head === undefined ||
    design?.flow === undefined ||
    design?.head === undefined ||
    maxOp?.flow === undefined ||
    maxOp?.head === undefined
  ) {
    return { valid: false, error: "curveValidation.fillAllPoints" };
  }

  if (design.flow <= 0 || maxOp.flow <= design.flow) {
    return { valid: false, error: "curveValidation.flowAscendingOrder" };
  }

  if (shutoff.head <= 0 || design.head <= 0 || maxOp.head < 0) {
    return { valid: false, error: "curveValidation.fillAllPoints" };
  }

  return {
    valid: true,
    points: [
      { flow: 0, head: shutoff.head },
      { flow: design.flow, head: design.head },
      { flow: maxOp.flow, head: maxOp.head },
    ],
  };
};

const validateCurve = (
  points: MaybePumpCurvePoint[],
  definitionType: PumpDefintionType,
): ValidationResult => {
  if (definitionType === "design-point") {
    return validateDesignPointCurve(points);
  }
  if (definitionType === "standard") {
    return validateStandardCurve(points);
  }
  return { valid: false, error: "curveValidation.fillAllPoints" };
};

export const PumpCurveTable = ({
  curve,
  definitionType,
  quantities,
  onCurveChange,
}: {
  curve?: ICurve;
  definitionType: PumpDefintionType;
  quantities: Quantities;
  onCurveChange?: OnCurveChange;
}) => {
  const translate = useTranslate();

  const [editingPoints, setEditingPoints] = useState<MaybePumpCurvePoint[]>(
    () => initialPointsFromCurve(curve, definitionType),
  );

  const flowDecimals = quantities.getDecimals("flow") ?? 2;
  const headDecimals = quantities.getDecimals("head") ?? 2;

  const displayPoints = calculateCurvePoints(editingPoints, definitionType);
  const validationResult = validateCurve(editingPoints, definitionType);

  const pointLabels = [
    translate("shutoffPoint"),
    translate("designPointLabel"),
    translate("maxOperatingPoint"),
  ];

  const handlePointChange = useCallback(
    (
      displayIndex: number,
      field: "flow" | "head",
      value: number | undefined,
    ) => {
      setEditingPoints((prevPoints) => {
        let newPoints = prevPoints.map((point, idx) =>
          idx === displayIndex ? { ...point, [field]: value } : point,
        );

        if (definitionType === "design-point") {
          const designPoint = newPoints[1];

          newPoints = calculateCurvePoints(
            [{}, designPoint, {}],
            definitionType,
          );
        }

        const result = validateCurve(newPoints, definitionType);
        if (onCurveChange && result.valid) {
          onCurveChange(result.points);
        }

        return newPoints;
      });
    },
    [definitionType, onCurveChange],
  );

  const getEditHandlers = (displayIndex: number) => {
    if (!onCurveChange) {
      return { onChangeFlow: undefined, onChangeHead: undefined };
    }

    if (definitionType === "design-point") {
      if (displayIndex === 1) {
        return {
          onChangeFlow: (value: number | undefined) =>
            handlePointChange(displayIndex, "flow", value),
          onChangeHead: (value: number | undefined) =>
            handlePointChange(displayIndex, "head", value),
        };
      }
      return { onChangeFlow: undefined, onChangeHead: undefined };
    }

    return {
      onChangeFlow:
        displayIndex === 0
          ? undefined // Shutoff flow is always 0
          : (value: number | undefined) =>
              handlePointChange(displayIndex, "flow", value),
      onChangeHead: (value: number | undefined) =>
        handlePointChange(displayIndex, "head", value),
    };
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="table"
        className="w-full grid grid-cols-[auto_1fr_1fr] items-center"
      >
        <GridHeader quantities={quantities} />
        {displayPoints.map((point, index) => {
          const { onChangeFlow, onChangeHead } = getEditHandlers(index);
          return (
            <GridRow
              key={pointLabels[index]}
              label={pointLabels[index]}
              displayFlow={
                point.flow !== undefined
                  ? localizeDecimal(point.flow, { decimals: flowDecimals })
                  : ""
              }
              displayHead={
                point.head !== undefined
                  ? localizeDecimal(point.head, { decimals: headDecimals })
                  : ""
              }
              onChangeFlow={onChangeFlow}
              onChangeHead={onChangeHead}
            />
          );
        })}
      </div>
      {!validationResult.valid && (
        <p className="text-sm font-semibold text-orange-800">
          {translate(validationResult.error)}
        </p>
      )}
    </div>
  );
};

const GridHeader = ({ quantities }: { quantities: Quantities }) => {
  const translate = useTranslate();
  const flowUnit = quantities.getUnit("flow");
  const headUnit = quantities.getUnit("head");

  return (
    <>
      <div role="columnheader"></div>

      <div
        role="columnheader"
        className="pl-2 py-1 text-sm font-semibold text-gray-500 flex items-center gap-1"
      >
        <span className="min-w-0 truncate">{translate("flow")}</span>
        <span className="flex-shrink-0">({flowUnit})</span>
      </div>
      <div
        role="columnheader"
        className="pl-2 py-1 text-sm font-semibold text-gray-500 flex items-center gap-1"
      >
        <span className="min-w-0">{translate("head")}</span>
        <span className="flex-shrink-0">({headUnit})</span>
      </div>
    </>
  );
};

const GridRow = ({
  label,
  displayFlow,
  displayHead,
  onChangeFlow,
  onChangeHead,
}: {
  label: string;
  displayFlow: string;
  displayHead: string;
  onChangeFlow?: (newValue: number | undefined) => void;
  onChangeHead?: (newValue: number | undefined) => void;
}) => {
  const handleFlowChange = onChangeFlow
    ? (value: number, isEmpty: boolean) =>
        onChangeFlow(isEmpty ? undefined : value)
    : undefined;
  const handleHeadChange = onChangeHead
    ? (value: number, isEmpty: boolean) =>
        onChangeHead(isEmpty ? undefined : value)
    : undefined;

  return (
    <>
      <div role="cell" className="pt-2 text-sm font-semibold text-gray-500">
        {label}
      </div>

      <div role="cell" className="pl-2 pt-2">
        <NumericField
          label={`${label}-x`}
          positiveOnly={true}
          isNullable={true}
          readOnly={!onChangeFlow}
          displayValue={displayFlow}
          onChangeValue={handleFlowChange}
          styleOptions={{
            padding: "sm",
            ghostBorder: !onChangeFlow,
            textSize: "sm",
          }}
        />
      </div>

      <div role="cell" className="pl-2 pt-2">
        <NumericField
          label={`${label}-y`}
          positiveOnly={true}
          isNullable={true}
          readOnly={!onChangeHead}
          displayValue={displayHead}
          onChangeValue={handleHeadChange}
          styleOptions={{
            padding: "sm",
            ghostBorder: !onChangeHead,
            textSize: "sm",
          }}
        />
      </div>
    </>
  );
};
