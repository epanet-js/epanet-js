import { useState, useCallback, useMemo } from "react";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import { NumericField } from "src/components/form/numeric-field";
import {
  CurveId,
  CurvePoint,
  Curves,
  getPumpCurveType,
  PumpCurveType,
} from "src/hydraulic-model/curves";
import { Quantities } from "src/model-metadata/quantities-spec";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Pump, PumpDefintionType } from "src/hydraulic-model/asset-types/pump";
import { SelectRow, QuantityRow, TextField } from "./ui-components";
import type {
  PropertyComparison,
  PumpCurveComparison,
} from "src/hooks/use-asset-comparison";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, TContent } from "src/components/elements";
import { useShowPumpLibrary } from "src/commands/show-pump-curves";
import { InlineField } from "src/components/form/fields";
import { SelectorOption } from "src/components/form/selector";

export type PumpDefinitionMode =
  | "power"
  | "designPointCurve"
  | "standardCurve"
  | "curveId";

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

export type PumpDefinitionData =
  | { type: "power"; power: number }
  | { type: "curve"; curve: CurvePoint[] }
  | { type: "curveId"; curveId: CurveId };

interface MaybePumpCurvePoint {
  flow?: number;
  head?: number;
}

export const PumpDefinitionDetailsWithAllCurves = ({
  pump,
  quantities,
  curves,
  readonly = false,
  onChange,
  getComparison,
  getPumpCurveComparison,
}: {
  pump: Pump;
  quantities: Quantities;
  curves: Curves;
  readonly?: boolean;
  onChange: (newData: PumpDefinitionData) => void;
  getComparison?: (name: string, value: unknown) => PropertyComparison;
  getPumpCurveComparison?: (
    value: CurvePoint[] | undefined,
  ) => PumpCurveComparison;
}) => {
  const curve = useMemo(() => {
    if (pump.definitionType === "curveId" && pump.curveId) {
      const curve = curves.get(pump.curveId)!;
      if (getPumpCurveType(curve.points) !== "multiPointCurve") {
        return curve.points;
      }
    }
    if (pump.definitionType === "curve" && pump.curve) return pump.curve;
    return [{ x: 1, y: 1 }];
  }, [pump.curve, pump.curveId, pump.definitionType, curves]);

  const componentKey = `${getCurveHash(curve)}|${pump.definitionType}`;

  return (
    <PumpDefinitionDetailsInner
      key={componentKey}
      pump={pump}
      curve={curve}
      curves={curves}
      quantities={quantities}
      readonly={readonly}
      onChange={onChange}
      getComparison={getComparison}
      getPumpCurveComparison={getPumpCurveComparison}
    />
  );
};

const PumpDefinitionDetailsInner = ({
  pump,
  curve,
  curves,
  quantities,
  readonly = false,
  onChange,
  getComparison,
  getPumpCurveComparison,
}: {
  pump: Pump;
  curve: CurvePoint[];
  curves: Curves;
  quantities: Quantities;
  readonly?: boolean;
  onChange: (newData: PumpDefinitionData) => void;
  getComparison?: (name: string, value: unknown) => PropertyComparison;
  getPumpCurveComparison?: (
    value: CurvePoint[] | undefined,
  ) => PumpCurveComparison;
}) => {
  const translate = useTranslate();

  const [localDefinitionType, setLocalDefinitionType] =
    useState<PumpDefinitionMode>(() =>
      inferDefinitionMode(pump.definitionType, curve),
    );

  const definitionModeOptions = useMemo(
    () =>
      [
        { label: translate("constantPower"), value: "power" },
        { label: translate("designPointCurve"), value: "designPointCurve" },
        { label: translate("standardCurve"), value: "standardCurve" },
        { label: translate("namedCurve"), value: "curveId" },
      ] as { label: string; value: PumpDefinitionMode }[],
    [translate],
  );

  const comparison = getDiffWithBaseModel({
    pump,
    curves,
    quantities,
    getComparison,
    getPumpCurveComparison,
    translate,
  });

  const handleDefinitionTypeChange = useCallback(
    (
      _name: string,
      newValue: PumpDefinitionMode,
      oldValue: PumpDefinitionMode,
    ) => {
      setLocalDefinitionType(newValue);

      if (newValue === "power") {
        return onChange({ type: "power", power: pump.power });
      }

      if (newValue === "curveId") {
        if (pump.curveId) onChange({ type: "curveId", curveId: pump.curveId });
        return;
      }

      const curveType =
        oldValue !== "power" && oldValue !== "curveId"
          ? oldValue
          : (() => {
              const ct = getPumpCurveType(curve);
              return ct === "multiPointCurve" ? "designPointCurve" : ct;
            })();
      const currentPoints = initialPointsFromCurve(curve, curveType);
      const validationResult = validateCurve(currentPoints, newValue);

      if (!validationResult.valid) {
        return;
      }

      onChange({
        type: "curve",
        curve: validationResult.points.map(({ flow, head }) => ({
          x: flow,
          y: head,
        })),
      });
    },
    [curve, onChange, pump.power, pump.curveId],
  );

  const handleCurvePointsChange = useCallback(
    (rawPoints: PumpCurvePoint[]) => {
      if (localDefinitionType === "power") {
        return;
      }
      onChange({
        type: "curve",
        curve: rawPoints.map(({ flow, head }) => ({
          x: flow,
          y: head,
        })),
      });
    },
    [localDefinitionType, onChange],
  );

  const purpleLine = comparison?.hasChanged ? (
    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
  ) : null;

  const sectionContent = (
    <div className="relative">
      {purpleLine}
      <SelectRow
        name="pumpType"
        selected={localDefinitionType}
        options={definitionModeOptions}
        readOnly={readonly}
        onChange={handleDefinitionTypeChange}
      />
      <div className="bg-gray-50 p-2 py-1 mt-1 -mr-2 border-l-2 border-gray-400 rounded-sm">
        {localDefinitionType === "power" && (
          <PowerDefinition
            power={pump.power}
            quantities={quantities}
            readOnly={readonly}
            onChange={onChange}
          />
        )}
        {localDefinitionType == "curveId" && (
          <CurveIdSelector
            curveId={pump.curveId}
            curves={curves}
            onChange={onChange}
            readOnly={readonly}
          />
        )}
        {localDefinitionType !== "power" &&
          localDefinitionType !== "curveId" && (
            <PumpCurveTable
              curve={curve}
              curveType={localDefinitionType}
              quantities={quantities}
              onCurveChange={readonly ? undefined : handleCurvePointsChange}
            />
          )}
      </div>
    </div>
  );

  if (comparison.hasChanged && comparison.tooltipText) {
    return (
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>{sectionContent}</Tooltip.Trigger>
        <Tooltip.Portal>
          <TContent side="left" sideOffset={4}>
            <div className="whitespace-pre-line">
              {translate("scenarios.main")}:{"\n"}
              {comparison.tooltipText}
            </div>
          </TContent>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return sectionContent;
};

type OnCurveChange = (points: PumpCurvePoint[]) => void;

export const PumpCurveTable = ({
  curve,
  curveType,
  quantities,
  onCurveChange,
}: {
  curve?: CurvePoint[];
  curveType: PumpCurveType;
  quantities: Quantities;
  onCurveChange?: OnCurveChange;
}) => {
  const translate = useTranslate();

  const [editingPoints, setEditingPoints] = useState<MaybePumpCurvePoint[]>(
    () => initialPointsFromCurve(curve, curveType),
  );

  const flowDecimals = quantities.getDecimals("flow") ?? 2;
  const headDecimals = quantities.getDecimals("head") ?? 2;

  const displayPoints = calculateCurvePoints(editingPoints, curveType);
  const validationResult = validateCurve(editingPoints, curveType);

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

        if (curveType === "designPointCurve") {
          const designPoint = newPoints[1];

          newPoints = calculateCurvePoints([{}, designPoint, {}], curveType);
        }

        const result = validateCurve(newPoints, curveType);
        if (onCurveChange && result.valid) {
          onCurveChange(result.points);
        }

        return newPoints;
      });
    },
    [curveType, onCurveChange, setEditingPoints],
  );

  const getEditHandlers = (displayIndex: number) => {
    if (!onCurveChange) {
      return { onChangeFlow: undefined, onChangeHead: undefined };
    }

    if (curveType === "designPointCurve") {
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
        <span className="ml-1">({flowUnit})</span>
      </div>
      <div
        role="columnheader"
        className="pl-2 py-1 text-sm font-semibold text-gray-500 truncate"
      >
        <span>{translate("head")}</span>
        <span className="ml-1">({headUnit})</span>
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
        {onChangeFlow ? (
          <NumericField
            label={`${label}-x`}
            positiveOnly={true}
            isNullable={true}
            displayValue={displayFlow}
            onChangeValue={handleFlowChange}
            styleOptions={{
              padding: "sm",
              textSize: "sm",
              variant: flowHasError ? "warning" : "default",
            }}
          />
        ) : (
          <span className="block p-1 text-sm text-gray-700 dark:text-gray-100 tabular-nums border border-transparent">
            {displayFlow}
          </span>
        )}
      </div>

      <div role="cell" className="pl-2 pt-2">
        {onChangeHead ? (
          <NumericField
            label={`${label}-y`}
            positiveOnly={true}
            isNullable={true}
            displayValue={displayHead}
            onChangeValue={handleHeadChange}
            styleOptions={{
              padding: "sm",
              textSize: "sm",
              variant: headHasError ? "warning" : "default",
            }}
          />
        ) : (
          <span className="block p-1 text-sm text-gray-700 dark:text-gray-100 tabular-nums border border-transparent">
            {displayHead}
          </span>
        )}
      </div>
    </>
  );
};

const PowerDefinition = ({
  power,
  quantities,
  readOnly,
  onChange,
}: {
  power: number;
  quantities: Quantities;
  onChange: (change: { type: "power"; power: number }) => void;
  readOnly: boolean;
}) => {
  const handlePowerChange = useCallback(
    (_name: string, newValue: number, _oldValue: number | null) => {
      onChange({ type: "power", power: newValue });
    },
    [onChange],
  );

  return (
    <QuantityRow
      name="power"
      value={power}
      unit={quantities.getUnit("power")}
      decimals={quantities.getDecimals("power")}
      readOnly={readOnly}
      onChange={handlePowerChange}
    />
  );
};

const CurveIdSelector = ({
  curveId,
  curves,
  onChange,
  readOnly,
}: {
  curveId?: CurveId;
  curves: Curves;
  onChange: (change: { type: "curveId"; curveId: CurveId }) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const showPumpLibrary = useShowPumpLibrary();

  const selectedCurve = curveId === undefined ? null : curveId;
  const curve = selectedCurve ? curves.get(selectedCurve) : undefined;
  const curveType = curve ? getPumpCurveType(curve.points) : undefined;

  const curveOptions = useMemo(() => {
    const pumpLibraryGroup: SelectorOption<CurveId>[] = [
      { label: translate("openPumpLibrary"), value: 0 },
    ];

    const curveGroup: SelectorOption<CurveId>[] = [];
    for (const [, curve] of curves) {
      if (curve.type === "pump") {
        curveGroup.push({ label: curve.label, value: curve.id });
      }
    }

    return [pumpLibraryGroup, curveGroup];
  }, [curves, translate]);

  const handleChange = (_: string, newValue: number | null) => {
    if (newValue === null) return;
    if (newValue) onChange({ type: "curveId", curveId: newValue });
    if (newValue === 0) showPumpLibrary({ source: "pump", curveId });
  };

  return curveOptions[1].length > 0 ? (
    <div className="flex flex-col gap-2">
      <SelectRow
        name="pumpName"
        selected={selectedCurve}
        nullable={true}
        options={curveOptions}
        listClassName="first:italic"
        stickyFirstGroup
        placeholder={`${translate("select")}...`}
        readOnly={readOnly}
        onChange={handleChange}
      />
      {curveType && (
        <InlineField name={translate("curveType")} labelSize="md">
          <TextField padding="md">{translate(curveType)}</TextField>
        </InlineField>
      )}
    </div>
  ) : (
    <InlineField name={translate("pumpName")} labelSize="md">
      <Button
        onClick={() => showPumpLibrary({ source: "pump" })}
        className="w-full h8"
      >
        {translate("openPumpLibrary")}
      </Button>
    </InlineField>
  );
};

interface DefinitionDiff {
  hasChanged: boolean;
  tooltipText?: string;
}

const getDiffWithBaseModel = ({
  pump,
  curves,
  quantities,
  getComparison,
  getPumpCurveComparison,
  translate,
}: {
  pump: Pump;
  curves: Curves;
  quantities: Quantities;
  getComparison?: (name: string, value: unknown) => PropertyComparison;
  getPumpCurveComparison?: (
    value: CurvePoint[] | undefined,
  ) => PumpCurveComparison;
  translate: TranslateFn;
}): DefinitionDiff => {
  if (!getComparison || !getPumpCurveComparison) return { hasChanged: false };
  const definitionTypeComparison = getComparison?.(
    "definitionType",
    pump.definitionType,
  );
  const powerComparison = getComparison("power", pump.power);
  const curveIdComparison = getComparison("curveId", pump.curveId);
  const curveComparison = getPumpCurveComparison(pump.getCurvePoints(curves));
  const curveIdHasChanged =
    pump.definitionType === "curveId" && curveIdComparison.hasChanged;
  const curveHasChanged =
    pump.definitionType !== "power" && curveComparison.hasChanged;
  const baseCurvePoints = curveComparison.baseValue;
  const baseCurve = curveComparison.curve;
  const powerHasChanged =
    pump.definitionType === "power" && (powerComparison?.hasChanged ?? false);
  const definitionHasChanged =
    definitionTypeComparison.hasChanged ||
    curveHasChanged ||
    powerHasChanged ||
    curveIdHasChanged;

  if (!definitionHasChanged) {
    return { hasChanged: false };
  }

  const baseDefinitionType = definitionTypeComparison?.baseValue as
    | PumpDefintionType
    | undefined;
  const baseCurveLabel = baseCurve?.label;

  const lines: string[] = [];

  if (
    baseDefinitionType === "power" &&
    powerComparison?.baseValue != undefined
  ) {
    const powerUnit = quantities.getUnit("power");
    lines.push(
      `${translate("power")}: ${localizeDecimal(powerComparison.baseValue as number)} ${powerUnit}`,
    );
  } else if (baseDefinitionType !== "power") {
    if (baseCurveLabel) {
      lines.push(`${translate("curve")}: ${baseCurveLabel}`);
    }
    if (baseCurvePoints) {
      const flowUnit = quantities.getUnit("flow");
      const headUnit = quantities.getUnit("head");
      const pointLabels: string[] =
        baseCurvePoints.length === 1
          ? [translate("designPointLabel")]
          : baseCurvePoints.length === 3
            ? [
                translate("shutoffPoint"),
                translate("designPointLabel"),
                translate("maxOperatingPoint"),
              ]
            : baseCurvePoints.map((_, i) => `Point ${i + 1}`);
      pointLabels.forEach((label, i) => {
        lines.push(
          `${label}: ${localizeDecimal(baseCurvePoints[i].x)} ${flowUnit}, ${localizeDecimal(baseCurvePoints[i].y)} ${headUnit}`,
        );
      });
    }
  }

  return {
    hasChanged: true,
    tooltipText: lines.length > 0 ? lines.join("\n") : undefined,
  };
};

const inferDefinitionMode = (
  modelType: PumpDefintionType,
  curve: CurvePoint[],
): PumpDefinitionMode => {
  if (modelType === "power") return "power";
  if (modelType === "curveId") {
    return "curveId";
  }
  const curveType = getPumpCurveType(curve);
  if (curveType === "multiPointCurve") return "curveId";
  return curveType;
};

const initialPointsFromCurve = (
  curve: CurvePoint[] | undefined,
  curveType: PumpCurveType,
): MaybePumpCurvePoint[] => {
  if (!curve || curve.length === 0) {
    return [{ flow: 0 }, {}, {}];
  }

  if (curveType === "designPointCurve") {
    const middleIndex = Math.floor(curve.length / 2);
    const designPoint = curve[middleIndex] ?? curve[0];
    const designFlow = designPoint.x;
    const designHead = designPoint.y;
    return calculateCurvePoints(
      [{}, { flow: designFlow, head: designHead }, {}],
      curveType,
    );
  }

  const points: MaybePumpCurvePoint[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < curve.length) {
      const { x, y } = curve[i];
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
  definitionType: PumpCurveType,
): MaybePumpCurvePoint[] => {
  if (definitionType === "standardCurve") {
    return editingPoints;
  }

  if (definitionType === "designPointCurve") {
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
  curveType: PumpCurveType,
): ValidationResult => {
  if (curveType === "designPointCurve") {
    return validateDesignPointCurve(points);
  }
  if (curveType === "standardCurve") {
    return validateStandardCurve(points);
  }
  return {
    valid: false,
    error: "curveValidation.missingValues",
  };
};

const getCurveHash = (curve: CurvePoint[]): string => {
  return curve.map((p) => `${p.x},${p.y}`).join("|");
};
