import { useState, useCallback, useMemo } from "react";
import { useAtomValue } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";
import { TranslateFn, useTranslate } from "src/hooks/use-translate";
import { NumericTable, type Cell } from "src/components/form/numeric-table";
import {
  CurveId,
  CurvePoint,
  Curves,
  getCurvePointsType,
  CurvePointsType,
  getPumpCurveErrors,
  CurveErrorPoint,
  Pump,
  PumpDefinitionType,
} from "@epanet-js/hydraulic-model";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { getDecimals } from "src/lib/project-settings";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { SelectRow, LibrarySelectRow, QuantityRow } from "./ui-components";
import {
  fieldValidator,
  numericChecks,
} from "src/lib/model-attributes-validation";
import type {
  PropertyComparison,
  PumpCurveComparison,
} from "src/hooks/use-asset-comparison";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { pumpDefinitionTypeChanges } from "src/hydraulic-model/model-operations";
import { useShowPumpLibrary } from "src/commands/show-pump-library";
import {
  BlockComparisonField,
  InlineField,
  NestedSection,
} from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

interface MaybePumpCurvePoint {
  flow?: number;
  head?: number;
}

export const PumpDefinitionDetails = ({
  pump,
  units,
  curves,
  readonly = false,
  onChange,
  getComparison,
  getPumpCurveComparison,
}: {
  pump: Pump;
  units: UnitsSpec;
  curves: Curves;
  readonly?: boolean;
  onChange: (changes: PropertyChange[]) => void;
  getComparison?: (name: string, value: unknown) => PropertyComparison;
  getPumpCurveComparison?: (
    value: CurvePoint[] | undefined,
  ) => PumpCurveComparison;
}) => {
  const curve = useMemo(() => {
    if (pump.definitionType === "curveId" && pump.curveId) {
      const curve = curves.get(pump.curveId)!;
      if (getCurvePointsType(curve.points) !== "multiPointCurve") {
        return curve.points;
      }
    }
    if (
      pump.definitionType === "designPointCurve" ||
      pump.definitionType === "standardCurve"
    )
      return pump.curve ?? [];
    return [{ x: 1, y: 1 }];
  }, [pump.curve, pump.curveId, pump.definitionType, curves]);

  const componentKey = `${getCurveHash(curve)}|${pump.definitionType}`;

  return (
    <PumpDefinitionDetailsInner
      key={componentKey}
      pump={pump}
      curve={curve}
      curves={curves}
      units={units}
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
  units,
  readonly = false,
  onChange,
  getComparison,
  getPumpCurveComparison,
}: {
  pump: Pump;
  curve: CurvePoint[];
  curves: Curves;
  units: UnitsSpec;
  readonly?: boolean;
  onChange: (changes: PropertyChange[]) => void;
  getComparison?: (name: string, value: unknown) => PropertyComparison;
  getPumpCurveComparison?: (
    value: CurvePoint[] | undefined,
  ) => PumpCurveComparison;
}) => {
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const translate = useTranslate();

  const [localDefinitionType, setLocalDefinitionType] =
    useState<PumpDefinitionType>(() => pump.definitionType);

  const definitionModeOptions = useMemo(
    () =>
      [
        { label: translate("constantPower"), value: "power" },
        { label: translate("designPointCurve"), value: "designPointCurve" },
        { label: translate("standardCurve"), value: "standardCurve" },
        { label: translate("namedCurve"), value: "curveId" },
      ] as { label: string; value: PumpDefinitionType }[],
    [translate],
  );

  const comparison = getDiffWithBaseModel({
    pump,
    curves,
    units,
    getComparison,
    getPumpCurveComparison,
    translate,
  });

  const handleDefinitionTypeChange = useCallback(
    (
      _name: string,
      newValue: PumpDefinitionType,
      oldValue: PumpDefinitionType,
    ) => {
      setLocalDefinitionType(newValue);

      if (allowsNullValues) {
        if (
          (newValue === "designPointCurve" || newValue === "standardCurve") &&
          (oldValue === "designPointCurve" || oldValue === "standardCurve")
        ) {
          const currentPoints = initialPointsFromCurve(curve, oldValue);
          const curvePoints = extractPointsForCurveType(
            currentPoints,
            newValue,
          );
          onChange([
            { property: "definitionType", value: newValue },
            ...(curvePoints
              ? [{ property: "curve", value: curvePoints } as PropertyChange]
              : []),
          ]);
          return;
        }
        onChange([{ property: "definitionType", value: newValue }]);
        return;
      }

      if (newValue === "power") {
        return onChange(
          pumpDefinitionTypeChanges("power", { power: pump.power }),
        );
      }

      if (newValue === "curveId") {
        if (pump.curveId)
          onChange(
            pumpDefinitionTypeChanges("curveId", { curveId: pump.curveId }),
          );
        return;
      }

      const curveType =
        oldValue !== "power" && oldValue !== "curveId"
          ? oldValue
          : (() => {
              const ct = getCurvePointsType(curve);
              return ct === "multiPointCurve" ? "designPointCurve" : ct;
            })();
      const currentPoints = initialPointsFromCurve(curve, curveType);
      const validPoints = extractPointsForCurveType(currentPoints, newValue);

      if (!validPoints || getPumpCurveErrors(validPoints).length > 0) {
        return;
      }

      onChange(
        pumpDefinitionTypeChanges(newValue, { curve: validPoints ?? null }),
      );
    },
    [curve, onChange, pump.power, pump.curveId, allowsNullValues],
  );

  const handleCurvePointsChange = useCallback(
    (rawPoints: PumpCurvePoint[]) => {
      if (localDefinitionType === "power") {
        return;
      }
      onChange([
        {
          property: "curve",
          value: rawPoints.map(({ flow, head }) => ({
            x: flow,
            y: head,
          })),
        },
      ]);
    },
    [localDefinitionType, onChange],
  );

  return (
    <BlockComparisonField
      hasChanged={comparison.hasChanged}
      baseDisplayValue={
        comparison.tooltipText ? (
          <div className="whitespace-pre-line">{comparison.tooltipText}</div>
        ) : undefined
      }
    >
      <SelectRow
        name="pumpType"
        selected={localDefinitionType}
        options={definitionModeOptions}
        readOnly={readonly}
        onChange={handleDefinitionTypeChange}
      />
      <NestedSection className="pb-2">
        {localDefinitionType === "power" && (
          <PowerDefinition
            power={pump.power}
            units={units}
            readOnly={readonly}
            allowsNullValues={allowsNullValues}
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
              units={units}
              onCurveChange={readonly ? undefined : handleCurvePointsChange}
              commitInvalidValues={allowsNullValues}
            />
          )}
      </NestedSection>
    </BlockComparisonField>
  );
};

type OnCurveChange = (points: PumpCurvePoint[]) => void;

export const PumpCurveTable = ({
  curve,
  curveType,
  units,
  onCurveChange,
  commitInvalidValues = false,
}: {
  curve?: CurvePoint[];
  curveType: CurvePointsType;
  units: UnitsSpec;
  onCurveChange?: OnCurveChange;
  commitInvalidValues?: boolean;
}) => {
  const translate = useTranslate();
  const { formatting } = useAtomValue(projectSettingsAtom);

  const [editingPoints, setEditingPoints] = useState<MaybePumpCurvePoint[]>(
    () => initialPointsFromCurve(curve, curveType),
  );

  const flowDecimals = getDecimals(formatting, "flow") ?? 2;
  const headDecimals = getDecimals(formatting, "head") ?? 2;

  const displayPoints = calculateCurvePoints(editingPoints, curveType);

  const validatedPoints = useMemo(
    () => extractPointsForCurveType(displayPoints, curveType),
    [displayPoints, curveType],
  );

  const pumpErrors = useMemo(
    () => (validatedPoints ? getPumpCurveErrors(validatedPoints) : []),
    [validatedPoints],
  );

  const hasMissingValues = validatedPoints === null;

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

        const curvePoints = extractPointsForCurveType(newPoints, curveType);
        if (curvePoints && onCurveChange) {
          if (
            commitInvalidValues ||
            getPumpCurveErrors(curvePoints).length === 0
          ) {
            onCurveChange(curvePoints.map((p) => ({ flow: p.x, head: p.y })));
          }
        }

        return newPoints;
      });
    },
    [curveType, onCurveChange, setEditingPoints, commitInvalidValues],
  );

  const isEditable = (index: number, field: "flow" | "head"): boolean => {
    if (!onCurveChange) return false;
    if (curveType === "designPointCurve") return index === 1;
    if (field === "flow" && index === 0) return false; // Shutoff flow is always 0
    return true;
  };

  const hasError = (index: number, field: "flow" | "head"): boolean => {
    if (!isEditable(index, field)) return false;
    const point = displayPoints[index];
    if (
      field === "flow" ? point.flow === undefined : point.head === undefined
    ) {
      return true;
    }
    const errorIndex = curveType === "designPointCurve" ? index - 1 : index;
    return pumpErrors.some(
      (e) =>
        e.index === errorIndex && e.value === (field === "flow" ? "x" : "y"),
    );
  };

  const flowUnit = units.flow;
  const headUnit = units.head;

  const cells: Array<[Cell, Cell]> = displayPoints.map((point, index) => [
    {
      label: `${pointLabels[index]}-x`,
      value: point.flow ?? null,
      readOnly: !isEditable(index, "flow"),
      validate: numericChecks.nonNegative,
      isRequired: true,
      commitInvalidValues: true,
      decimals: flowDecimals,
      hasError: hasError(index, "flow"),
      handler: (newValue: number, isEmpty: boolean) =>
        handlePointChange(index, "flow", isEmpty ? undefined : newValue),
    },
    {
      label: `${pointLabels[index]}-y`,
      value: point.head ?? null,
      readOnly: !isEditable(index, "head"),
      validate: numericChecks.nonNegative,
      isRequired: true,
      commitInvalidValues: true,
      decimals: headDecimals,
      hasError: hasError(index, "head"),
      handler: (newValue: number, isEmpty: boolean) =>
        handlePointChange(index, "head", isEmpty ? undefined : newValue),
    },
  ]);

  return (
    <>
      <NumericTable
        labels={{
          horizontal: [
            `${translate("flow")} (${flowUnit})`,
            `${translate("head")} (${headUnit})`,
          ],
          vertical: pointLabels,
        }}
        cells={cells}
      />
      {(hasMissingValues || pumpErrors.length > 0) && (
        <p className="text-size-base font-semibold text-orange-800">
          <PumpCurveWarning
            hasMissingValues={hasMissingValues}
            pumpErrors={pumpErrors}
            curveType={curveType}
          />
        </p>
      )}
    </>
  );
};

const PowerDefinition = ({
  power,
  units,
  readOnly,
  allowsNullValues,
  onChange,
}: {
  power: number | null;
  units: UnitsSpec;
  onChange: (changes: PropertyChange[]) => void;
  readOnly: boolean;
  allowsNullValues?: boolean;
}) => {
  const handlePowerChange = useCallback(
    (_name: string, newValue: number | null, _oldValue: number | null) => {
      onChange([{ property: "power", value: newValue }]);
    },
    [onChange],
  );

  return (
    <QuantityRow
      name="power"
      value={power}
      unit={units.power}
      readOnly={readOnly}
      commitInvalidValues={allowsNullValues}
      onChange={handlePowerChange}
      validate={fieldValidator("pump", "power")}
    />
  );
};

const CurveIdSelector = ({
  curveId,
  curves,
  onChange,
  readOnly,
}: {
  curveId?: CurveId | null;
  curves: Curves;
  onChange: (changes: PropertyChange[]) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const showPumpLibrary = useShowPumpLibrary();

  const selectedCurve = curveId ?? null;
  const curve = selectedCurve ? curves.get(selectedCurve) : undefined;
  const curveType = curve ? getCurvePointsType(curve.points) : undefined;

  const handleChange = useCallback(
    (_: string, newValue: number | null) => {
      if (newValue === null) return;
      onChange([
        { property: "definitionType", value: "curveId" },
        { property: "curveId", value: newValue },
      ]);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <LibrarySelectRow
        name="pumpName"
        collection={curves}
        filterByType="pump"
        libraryLabel={translate("openPumpLibrary")}
        onOpenLibrary={() =>
          showPumpLibrary({
            source: "pump",
            curveId: curveId ?? undefined,
            initialSection: "pump",
          })
        }
        selected={selectedCurve}
        readOnly={readOnly}
        onChange={handleChange}
        isOptional={false}
      />
      {curveType && (
        <InlineField name={translate("curveType")} labelSize="md">
          <TextField padding="md">{translate(curveType)}</TextField>
        </InlineField>
      )}
    </div>
  );
};

interface DefinitionDiff {
  hasChanged: boolean;
  tooltipText?: string;
}

const getDiffWithBaseModel = ({
  pump,
  curves,
  units,
  getComparison,
  getPumpCurveComparison,
  translate,
}: {
  pump: Pump;
  curves: Curves;
  units: UnitsSpec;
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
    | PumpDefinitionType
    | undefined;
  const baseCurveLabel = baseCurve?.label;

  const lines: string[] = [];

  if (baseDefinitionType === "power") {
    const powerUnit = units.power;
    lines.push(
      powerComparison?.baseValue != undefined
        ? `${translate("power")}: ${localizeDecimal(powerComparison.baseValue as number)} ${powerUnit}`
        : `${translate("power")}: ${translate("none")}`,
    );
  } else {
    if (baseCurveLabel) {
      lines.push(`${translate("curve")}: ${baseCurveLabel}`);
    }
    if (baseCurvePoints) {
      const flowUnit = units.flow;
      const headUnit = units.head;
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

const initialPointsFromCurve = (
  curve: CurvePoint[] | undefined,
  curveType: CurvePointsType,
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
  definitionType: CurvePointsType,
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

const extractPointsForCurveType = (
  displayPoints: MaybePumpCurvePoint[],
  curveType: CurvePointsType,
): CurvePoint[] | null => {
  if (curveType === "designPointCurve") {
    const dp = displayPoints[1];
    if (dp.flow === undefined || dp.head === undefined) return null;
    return [{ x: dp.flow, y: dp.head }];
  }

  const points: CurvePoint[] = [];
  for (const p of displayPoints) {
    if (p.flow === undefined || p.head === undefined) return null;
    points.push({ x: p.flow, y: p.head });
  }
  return points;
};

const PumpCurveWarning = ({
  hasMissingValues,
  pumpErrors,
  curveType,
}: {
  hasMissingValues: boolean;
  pumpErrors: CurveErrorPoint[];
  curveType: CurvePointsType;
}) => {
  const translate = useTranslate();

  if (hasMissingValues) {
    return <>{translate("curveValidation.missingValues")}</>;
  }

  const hasXError = pumpErrors.some((e) => e.value === "x");
  const hasYError = pumpErrors.some((e) => e.value === "y");
  const flowLabel = translate("flow");
  const headLabel = translate("head");

  if (curveType === "designPointCurve") {
    const parts: string[] = [];
    if (hasXError)
      parts.push(translate("curveValidation.valueMustBeNonZero", flowLabel));
    if (hasYError)
      parts.push(translate("curveValidation.valueMustBeNonZero", headLabel));
    return <>{parts.join(" ")}</>;
  }

  const parts: string[] = [];
  if (hasXError)
    parts.push(translate("curveValidation.valueAscendingOrder", flowLabel));
  if (hasYError)
    parts.push(translate("curveValidation.valueDescendingOrder", headLabel));
  return <>{parts.join(" ")}</>;
};

const getCurveHash = (curve: CurvePoint[]): string => {
  return curve.map((p) => `${p.x},${p.y}`).join("|");
};
