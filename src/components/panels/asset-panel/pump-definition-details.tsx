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
} from "src/hydraulic-model/curves";
import { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { getDecimals } from "src/lib/project-settings";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Pump, PumpDefintionType } from "src/hydraulic-model/asset-types/pump";
import {
  SelectRow,
  LibrarySelectRow,
  QuantityRow,
  TextField,
} from "./ui-components";
import type {
  PropertyComparison,
  PumpCurveComparison,
} from "src/hooks/use-asset-comparison";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { useShowPumpLibrary } from "src/commands/show-pump-library";
import {
  BlockComparisonField,
  InlineField,
  NestedSection,
} from "src/components/form/fields";

export type PumpDefinitionMode =
  | "power"
  | "designPointCurve"
  | "standardCurve"
  | "curveId";

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
    units,
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
        return onChange([
          { property: "definitionType", value: "power" },
          { property: "power", value: pump.power },
          { property: "curveId", value: undefined },
        ]);
      }

      if (newValue === "curveId") {
        if (pump.curveId)
          onChange([
            { property: "definitionType", value: "curveId" },
            { property: "curveId", value: pump.curveId },
          ]);
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
      const validPoints = extractValidPoints(currentPoints, newValue);

      if (!validPoints || getPumpCurveErrors(validPoints).length > 0) {
        return;
      }

      onChange([
        { property: "definitionType", value: "curve" },
        { property: "curve", value: validPoints },
        { property: "curveId", value: undefined },
      ]);
    },
    [curve, onChange, pump.power, pump.curveId],
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
}: {
  curve?: CurvePoint[];
  curveType: CurvePointsType;
  units: UnitsSpec;
  onCurveChange?: OnCurveChange;
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
    () => extractValidPoints(displayPoints, curveType),
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

        const validPoints = extractValidPoints(newPoints, curveType);
        if (validPoints && onCurveChange) {
          const errors = getPumpCurveErrors(validPoints);
          if (errors.length === 0) {
            onCurveChange(validPoints.map((p) => ({ flow: p.x, head: p.y })));
          }
        }

        return newPoints;
      });
    },
    [curveType, onCurveChange, setEditingPoints],
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
      positiveOnly: true,
      isNullable: true,
      decimals: flowDecimals,
      hasError: hasError(index, "flow"),
      handler: (newValue: number, isEmpty: boolean) =>
        handlePointChange(index, "flow", isEmpty ? undefined : newValue),
    },
    {
      label: `${pointLabels[index]}-y`,
      value: point.head ?? null,
      readOnly: !isEditable(index, "head"),
      positiveOnly: true,
      isNullable: true,
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
        <p className="text-sm font-semibold text-orange-800">
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
  onChange,
}: {
  power: number;
  units: UnitsSpec;
  onChange: (changes: PropertyChange[]) => void;
  readOnly: boolean;
}) => {
  const handlePowerChange = useCallback(
    (_name: string, newValue: number, _oldValue: number | null) => {
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
  onChange: (changes: PropertyChange[]) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const showPumpLibrary = useShowPumpLibrary();

  const selectedCurve = curveId === undefined ? null : curveId;
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
            curveId,
            initialSection: "pump",
          })
        }
        selected={selectedCurve}
        readOnly={readOnly}
        onChange={handleChange}
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
    | PumpDefintionType
    | undefined;
  const baseCurveLabel = baseCurve?.label;

  const lines: string[] = [];

  if (
    baseDefinitionType === "power" &&
    powerComparison?.baseValue != undefined
  ) {
    const powerUnit = units.power;
    lines.push(
      `${translate("power")}: ${localizeDecimal(powerComparison.baseValue as number)} ${powerUnit}`,
    );
  } else if (baseDefinitionType !== "power") {
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

const inferDefinitionMode = (
  modelType: PumpDefintionType,
  curve: CurvePoint[],
): PumpDefinitionMode => {
  if (modelType === "power") return "power";
  if (modelType === "curveId") {
    return "curveId";
  }
  const curveType = getCurvePointsType(curve);
  if (curveType === "multiPointCurve") return "curveId";
  return curveType;
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

const extractValidPoints = (
  displayPoints: MaybePumpCurvePoint[],
  curveType: CurvePointsType | PumpDefinitionMode,
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
