import { useState, useCallback, useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { NumericField } from "src/components/form/numeric-field";
import { CurveId, Curves, ICurve } from "src/hydraulic-model/curves";
import { Quantities } from "src/model-metadata/quantities-spec";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Pump, PumpDefintionType } from "src/hydraulic-model/asset-types/pump";
import { SelectRow, QuantityRow } from "./ui-components";

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

export type PumpDefinitionData =
  | { type: "power"; power: number }
  | { type: "design-point"; curveId: CurveId; points: PumpCurvePoint[] }
  | { type: "standard"; curveId: CurveId; points: PumpCurvePoint[] };

interface MaybePumpCurvePoint {
  flow?: number;
  head?: number;
}

export const PumpCurveDetails = ({
  pump,
  curves,
  quantities,
  onChange,
}: {
  pump: Pump;
  curves: Curves;
  quantities: Quantities;
  onChange: (newData: PumpDefinitionData) => void;
}) => {
  const curve = pump.curveId ? curves.get(pump.curveId) : undefined;
  const componentKey = `${getCurveHash(curve)}|${pump.definitionType}`;

  return (
    <PumpCurveDetailsInner
      key={componentKey}
      pump={pump}
      curve={curve}
      quantities={quantities}
      onChange={onChange}
    />
  );
};

const PumpCurveDetailsInner = ({
  pump,
  curve,
  quantities,
  onChange,
}: {
  pump: Pump;
  curve: ICurve | undefined;
  quantities: Quantities;
  onChange: (newData: PumpDefinitionData) => void;
}) => {
  const translate = useTranslate();

  const [localDefinitionType, setLocalDefinitionType] =
    useState<PumpDefintionType>(pump.definitionType);

  const definitionOptions = useMemo(
    () =>
      [
        { label: translate("constantPower"), value: "power" },
        { label: translate("designPoint"), value: "design-point" },
        { label: translate("standardCurve"), value: "standard" },
      ] as { label: string; value: PumpDefintionType }[],
    [translate],
  );

  const handleDefinitionTypeChange = useCallback(
    (
      _name: string,
      newValue: PumpDefintionType,
      oldValue: PumpDefintionType,
    ) => {
      if (newValue === "flow-vs-head") return;

      setLocalDefinitionType(newValue);

      if (newValue === "power") {
        return onChange({ type: "power", power: pump.power });
      }

      const curveType = oldValue !== "power" ? oldValue : inferCurveType(curve);
      const currentPoints = initialPointsFromCurve(curve, curveType);
      const validationResult = validateCurve(currentPoints, newValue);

      if (!validationResult.valid) {
        return;
      }

      onChange({
        type: newValue,
        curveId: curve?.id || String(pump.id),
        points: validationResult.points,
      });
    },
    [pump.id, pump.power, curve, onChange],
  );

  const handlePowerChange = useCallback(
    (_name: string, newValue: number, _oldValue: number | null) => {
      onChange({ type: "power", power: newValue });
    },
    [onChange],
  );

  const handleCurvePointsChange = useCallback(
    (points: PumpCurvePoint[]) => {
      if (
        localDefinitionType === "flow-vs-head" ||
        localDefinitionType === "power"
      ) {
        return;
      }
      const curveId = pump.curveId || String(pump.id);
      onChange({ type: localDefinitionType, curveId, points });
    },
    [onChange, pump, localDefinitionType],
  );

  return (
    <>
      <SelectRow
        name="pumpType"
        selected={localDefinitionType}
        options={definitionOptions}
        onChange={handleDefinitionTypeChange}
      />
      <div className="bg-gray-50 p-2 py-1 -mr-2 border-l-2 border-gray-400 rounded-sm">
        {localDefinitionType === "power" && (
          <QuantityRow
            name="power"
            value={pump.power}
            unit={quantities.getUnit("power")}
            decimals={quantities.getDecimals("power")}
            onChange={handlePowerChange}
          />
        )}
        {localDefinitionType !== "power" && (
          <PumpCurveTable
            curve={curve}
            definitionType={localDefinitionType}
            quantities={quantities}
            onCurveChange={handleCurvePointsChange}
          />
        )}
      </div>
    </>
  );
};

type OnCurveChange = (points: PumpCurvePoint[]) => void;

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
    [definitionType, onCurveChange, setEditingPoints],
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

  const getErrorStates = (
    displayIndex: number,
    validationResult: ValidationResult,
  ) => {
    const point = displayPoints[displayIndex];
    const { onChangeFlow, onChangeHead } = getEditHandlers(displayIndex);

    return {
      flowHasError:
        onChangeFlow !== undefined &&
        (point.flow === undefined ||
          (!validationResult.valid &&
            validationResult.error === "curveValidation.flowAscendingOrder")),
      headHasError:
        onChangeHead !== undefined &&
        (point.head === undefined ||
          (!validationResult.valid &&
            validationResult.error === "curveValidation.headDescendingOrder")),
    };
  };

  return (
    <>
      <div
        role="table"
        className="w-full grid grid-cols-[auto_1fr_1fr] items-center"
      >
        <GridHeader quantities={quantities} />
        {displayPoints.map((point, index) => {
          const { onChangeFlow, onChangeHead } = getEditHandlers(index);
          const { flowHasError, headHasError } = getErrorStates(
            index,
            validationResult,
          );
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
              flowHasError={flowHasError}
              headHasError={headHasError}
            />
          );
        })}
      </div>
      {!validationResult.valid && (
        <p className="text-sm font-semibold text-orange-800">
          {translate(validationResult.error)}
        </p>
      )}
    </>
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
        className="pl-2 py-1 text-sm font-semibold text-gray-500 truncate"
      >
        <span>{translate("flow")}</span>
        <span>({flowUnit})</span>
      </div>
      <div
        role="columnheader"
        className="pl-2 py-1 text-sm font-semibold text-gray-500 truncate"
      >
        <span>{translate("head")}</span>
        <span>({headUnit})</span>
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
  flowHasError,
  headHasError,
}: {
  label: string;
  displayFlow: string;
  displayHead: string;
  onChangeFlow?: (newValue: number | undefined) => void;
  onChangeHead?: (newValue: number | undefined) => void;
  flowHasError?: boolean;
  headHasError?: boolean;
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
      <div role="cell" className="pt-2 text-sm text-gray-500">
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
            variant: flowHasError ? "warning" : "default",
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
            variant: headHasError ? "warning" : "default",
          }}
        />
      </div>
    </>
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

type ValidationErrorKey =
  | "curveValidation.missingValues"
  | "curveValidation.flowAscendingOrder"
  | "curveValidation.headDescendingOrder";

type ValidationResult =
  | { valid: true; points: PumpCurvePoint[] }
  | { valid: false; error: ValidationErrorKey };

const validateDesignPointCurve = (
  points: MaybePumpCurvePoint[],
): ValidationResult => {
  const designPoint = points[1];
  if (designPoint.flow === undefined || designPoint.head === undefined) {
    return {
      valid: false,
      error: "curveValidation.missingValues",
    };
  }
  return { valid: true, points: [designPoint as PumpCurvePoint] };
};

const validateStandardCurve = (
  points: MaybePumpCurvePoint[],
): ValidationResult => {
  if (points.length !== 3) {
    return {
      valid: false,
      error: "curveValidation.missingValues",
    };
  }
  const [shutoff, design, maxOp] = points;

  if (
    shutoff?.head === undefined ||
    design?.flow === undefined ||
    design?.head === undefined ||
    maxOp?.flow === undefined ||
    maxOp?.head === undefined
  ) {
    return {
      valid: false,
      error: "curveValidation.missingValues",
    };
  }

  if (design.flow <= 0 || maxOp.flow <= design.flow) {
    return {
      valid: false,
      error: "curveValidation.flowAscendingOrder",
    };
  }

  if (shutoff.head <= design.head || design.head < maxOp.head) {
    return {
      valid: false,
      error: "curveValidation.headDescendingOrder",
    };
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
  return {
    valid: false,
    error: "curveValidation.missingValues",
  };
};

const getCurveHash = (curve: ICurve | undefined): string => {
  if (!curve || curve.points.length === 0) {
    return "no-curve";
  }
  return curve.points.map((p) => `${p.x},${p.y}`).join("|");
};

const inferCurveType = (curve: ICurve | undefined): PumpDefintionType => {
  if (!curve || curve.points.length === 0) {
    return "design-point";
  }
  if (curve.points.length === 1) {
    return "design-point";
  }
  return "standard";
};
