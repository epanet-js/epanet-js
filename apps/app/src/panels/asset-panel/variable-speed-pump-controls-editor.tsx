import { useCallback, useEffect, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  NodeAsset,
  Pipe,
  Pump,
  Tank,
  VariableSpeedPumpControl,
  VariableSpeedPumpSchedulePoint,
  VariableSpeedPumpTankLevels,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import { localizeDecimal } from "@epanet-js/i18n";
import { numericChecks } from "src/lib/model-attributes-validation";
import {
  DataGrid,
  type GridColumn,
  timeColumn,
  floatColumn,
  filterableSelectColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { DeleteIcon, AddIcon } from "src/icons";
import {
  InlineField,
  NestedSection,
  VerticalField,
} from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { TextField } from "src/components/form/text-field";
import { Checkbox } from "src/components/form/Checkbox";
import { highlightsAtom } from "src/state/highlights";
import { validateLevelSetting } from "./pump-level-based-controls";

export type VariableSpeedPumpTargets = {
  nodes: NodeAsset[];
  pipes: Pipe[];
  pumps: Pump[];
  outletNodeId: AssetId | null;
  units: UnitsSpec;
};

type ScheduleRow = { time: number; target: number };
type LagRow = { pumpId: AssetId | null };

const ONE_HOUR_IN_SECONDS = 3600;

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

export const buildDefaultPressureTarget = (
  linkId: AssetId,
  targets: VariableSpeedPumpTargets,
  base?: VariableSpeedPumpControl,
): Omit<VariableSpeedPumpControl, "id" | "type"> | null => {
  const node =
    targets.nodes.find((n) => n.id === targets.outletNodeId) ??
    targets.nodes[0];
  if (!node) return null;
  return {
    linkId,
    quantity: node.type === "tank" ? "level" : "pressure",
    targetId: node.id,
    target: 0,
    minSpeed: base?.minSpeed ?? 0,
    maxSpeed: base?.maxSpeed ?? 1,
    laggedPumpIds: base?.laggedPumpIds ?? [],
    schedule: [],
    tankLevels: tankLevelsOn(node, base?.tankLevels),
  };
};

export const buildDefaultFlowTarget = (
  linkId: AssetId,
  base?: VariableSpeedPumpControl,
): Omit<VariableSpeedPumpControl, "id" | "type"> => ({
  linkId,
  quantity: "flow",
  targetId: linkId,
  target: 0,
  minSpeed: base?.minSpeed ?? 0,
  maxSpeed: base?.maxSpeed ?? 1,
  laggedPumpIds: base?.laggedPumpIds ?? [],
  schedule: [],
  tankLevels: base?.tankLevels,
});

const tankLevelsOn = (
  node: NodeAsset,
  tankLevels: VariableSpeedPumpTankLevels | undefined,
) =>
  node.type === "tank" && tankLevels?.tankId === node.id
    ? tankLevels
    : undefined;

export const VariableSpeedPumpControlsEditor = ({
  control,
  targets,
  onControlChange,
  readOnly = false,
}: {
  control: VariableSpeedPumpControl;
  targets: VariableSpeedPumpTargets;
  onControlChange: (control: VariableSpeedPumpControl) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const quantityName =
    control.quantity === "level"
      ? translate("level")
      : control.quantity === "flow"
        ? translate("flow")
        : translate("pressure");
  const quantityUnit = translateUnit(
    control.quantity === "level"
      ? targets.units.minLevel
      : control.quantity === "flow"
        ? targets.units.flow
        : targets.units.pressure,
  );
  const quantityLabel = quantityUnit
    ? `${quantityName} (${quantityUnit})`
    : quantityName;

  const isScheduled = control.schedule.length > 0;
  const hasSpeedRangeError = control.minSpeed > control.maxSpeed;
  const minSpeedLabel = translate("controls.variableSpeed.minSpeed");
  const maxSpeedLabel = translate("controls.variableSpeed.maxSpeed");

  const update = (changes: Partial<VariableSpeedPumpControl>) =>
    onControlChange({ ...control, ...changes });

  const highlightAsset = useAssetHighlight(targets);

  const tanks = useMemo(
    () => targets.nodes.filter((node): node is Tank => node.type === "tank"),
    [targets.nodes],
  );

  const lagCandidates = useMemo(
    () => targets.pumps.filter((pump) => pump.id !== control.linkId),
    [targets.pumps, control.linkId],
  );

  const handleVaryByTimeChange = (checked: boolean) => {
    update({
      schedule: checked ? [{ time: 0, target: control.target }] : [],
    });
  };

  return (
    <NestedSection className="pb-2">
      {control.quantity === "flow" ? (
        <FlowTargetField
          control={control}
          pipes={targets.pipes}
          onChange={(targetId) => update({ targetId })}
          onHighlightChange={highlightAsset}
          readOnly={readOnly}
        />
      ) : (
        <NodeTargetField
          control={control}
          nodes={targets.nodes}
          outletNodeId={targets.outletNodeId}
          onChange={(node) =>
            update({
              targetId: node.id,
              quantity: node.type === "tank" ? "level" : "pressure",
              tankLevels: tankLevelsOn(node, control.tankLevels),
            })
          }
          onHighlightChange={highlightAsset}
          readOnly={readOnly}
        />
      )}

      <InlineField name={quantityLabel} labelSize="md">
        <NumericField
          label={quantityLabel}
          displayValue={isScheduled ? "" : localizeDecimal(control.target)}
          placeholder={
            isScheduled
              ? translate("controls.variableSpeed.setBySchedule")
              : undefined
          }
          disabled={isScheduled}
          onChangeValue={(value, isEmpty) => {
            if (!isEmpty) update({ target: value });
          }}
          readOnly={readOnly}
          styleOptions={{ padding: "md", ghostBorder: readOnly }}
        />
      </InlineField>

      <CheckboxRow
        label={translate("controls.variableSpeed.varyByTimeOfDay")}
        checked={isScheduled}
        onChange={handleVaryByTimeChange}
        disabled={readOnly}
      />

      {isScheduled && (
        <ScheduleGrid
          schedule={control.schedule}
          valueHeader={quantityLabel}
          onChange={(schedule) => update({ schedule })}
          readOnly={readOnly}
        />
      )}

      <hr className=" my-1" />
      <div className="flex flex-col gap-1 py-1">
        <div className="grid grid-cols-2 gap-2">
          <VerticalField name={minSpeedLabel}>
            <NumericField
              label={minSpeedLabel}
              displayValue={localizeDecimal(control.minSpeed)}
              validate={numericChecks.nonNegative}
              onChangeValue={(value, isEmpty) => {
                if (!isEmpty) update({ minSpeed: value });
              }}
              readOnly={readOnly}
              styleOptions={{
                padding: "md",
                ghostBorder: readOnly,
                variant: hasSpeedRangeError ? "warning" : "default",
              }}
            />
          </VerticalField>
          <VerticalField name={maxSpeedLabel}>
            <NumericField
              label={maxSpeedLabel}
              displayValue={localizeDecimal(control.maxSpeed)}
              validate={numericChecks.positive}
              onChangeValue={(value, isEmpty) => {
                if (!isEmpty) update({ maxSpeed: value });
              }}
              readOnly={readOnly}
              styleOptions={{
                padding: "md",
                ghostBorder: readOnly,
                variant: hasSpeedRangeError ? "warning" : "default",
              }}
            />
          </VerticalField>
        </div>
        {hasSpeedRangeError && (
          <p className="text-size-base font-semibold text-orange-800">
            {translate("controls.variableSpeed.speedRangeError")}
          </p>
        )}
      </div>

      <hr className=" my-1" />
      <LagPumpsSection
        laggedPumpIds={control.laggedPumpIds}
        candidates={lagCandidates}
        onChange={(laggedPumpIds) => update({ laggedPumpIds })}
        onHighlightChange={highlightAsset}
        readOnly={readOnly}
      />

      {control.quantity !== "pressure" && (
        <>
          <hr className=" my-1" />
          <TankLevelsSection
            tankLevels={control.tankLevels}
            tanks={tanks}
            fixedTankId={control.quantity === "level" ? control.targetId : null}
            levelUnit={translateUnit(targets.units.minLevel)}
            onChange={(tankLevels) => update({ tankLevels })}
            onHighlightChange={highlightAsset}
            readOnly={readOnly}
          />
        </>
      )}
    </NestedSection>
  );
};

type LevelsDraft =
  | { tankId: AssetId; offLevel: number; onLevel: number }
  | typeof NO_TANK;

const NO_TANK = { tankId: null } as const;

const defaultLevelsFor = (tank: Tank): VariableSpeedPumpTankLevels => ({
  tankId: tank.id,
  offLevel: tank.maxLevel ?? 0,
  onLevel: tank.minLevel ?? 0,
});

const TankLevelsSection = ({
  tankLevels,
  tanks,
  fixedTankId,
  levelUnit,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  tankLevels: VariableSpeedPumpTankLevels | undefined;
  tanks: Tank[];
  fixedTankId: AssetId | null;
  levelUnit: string;
  onChange: (tankLevels: VariableSpeedPumpTankLevels | undefined) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const [synced, setSynced] = useState(tankLevels);
  const [draft, setDraft] = useState<LevelsDraft | null>(tankLevels ?? null);
  if (tankLevels !== synced) {
    setSynced(tankLevels);
    const isAwaitingTank =
      tankLevels === undefined && draft === NO_TANK && fixedTankId === null;
    if (!isAwaitingTank) setDraft(tankLevels ?? null);
  }

  const tank =
    draft && draft.tankId !== null
      ? tanks.find((t) => t.id === draft.tankId)
      : undefined;
  const errors =
    draft && draft.tankId !== null && tank
      ? validateLevelSetting({
          onLevel: draft.onLevel,
          offLevel: draft.offLevel,
          minLevel: tank.minLevel ?? 0,
          maxLevel: tank.maxLevel ?? 0,
        })
      : [];

  const commit = (next: LevelsDraft) => {
    setDraft(next);
    if (next.tankId === null) {
      if (tankLevels !== undefined) onChange(undefined);
      return;
    }
    const nextTank = tanks.find((t) => t.id === next.tankId);
    if (!nextTank) return;
    const nextErrors = validateLevelSetting({
      onLevel: next.onLevel,
      offLevel: next.offLevel,
      minLevel: nextTank.minLevel ?? 0,
      maxLevel: nextTank.maxLevel ?? 0,
    });
    if (nextErrors.length === 0) onChange(next);
  };

  const defaultTank =
    fixedTankId !== null ? tanks.find((t) => t.id === fixedTankId) : tanks[0];

  const handleEnabledChange = (checked: boolean) => {
    if (!checked) {
      setDraft(null);
      onChange(undefined);
      return;
    }
    if (fixedTankId === null) commit(NO_TANK);
    else if (defaultTank) commit(defaultLevelsFor(defaultTank));
  };

  const withUnit = (label: string) =>
    levelUnit ? `${label} (${levelUnit})` : label;
  const offLabel = withUnit(translate("controls.variableSpeed.offAbove"));
  const onLabel = withUnit(translate("controls.variableSpeed.onBelow"));
  const tankLabel = translate("tank");
  const noTankLabel = translate("none");

  const tankOptions = useMemo(
    () => tanks.map((t) => ({ value: t.id, label: t.label })),
    [tanks],
  );

  const hasOrderError = errors.includes("order");
  const hasOffError = errors.includes("offOutOfRange") || hasOrderError;
  const hasOnError = errors.includes("onOutOfRange") || hasOrderError;

  const messageParts: string[] = [];
  if (
    tank &&
    (errors.includes("onOutOfRange") || errors.includes("offOutOfRange"))
  ) {
    messageParts.push(
      translate(
        "controls.levelValidation.outOfRange",
        localizeDecimal(tank.minLevel ?? 0),
        localizeDecimal(tank.maxLevel ?? 0),
      ),
    );
  }
  if (hasOrderError) {
    messageParts.push(translate("controls.levelValidation.onBelowOff"));
  }

  return (
    <div className="flex flex-col gap-1">
      <CheckboxRow
        label={translate("controls.variableSpeed.tankLevels")}
        checked={draft !== null}
        onChange={handleEnabledChange}
        disabled={readOnly || (draft === null && !defaultTank)}
      />
      {draft && (
        <>
          {fixedTankId === null && (
            <InlineField name={tankLabel} labelSize="md">
              <div
                className="w-full"
                onMouseEnter={() => onHighlightChange(draft.tankId)}
                onMouseLeave={() => onHighlightChange(null)}
              >
                {readOnly ? (
                  <TextField padding="md">
                    {tank?.label ?? noTankLabel}
                  </TextField>
                ) : (
                  <Selector
                    ariaLabel={tankLabel}
                    options={tankOptions}
                    selected={draft.tankId}
                    nullable
                    placeholder={noTankLabel}
                    clearLabel={noTankLabel}
                    onChange={(tankId) => {
                      const next = tanks.find((t) => t.id === tankId);
                      commit(next ? defaultLevelsFor(next) : NO_TANK);
                    }}
                    onActiveOptionChange={onHighlightChange}
                    styleOptions={selectorStyleOptions}
                  />
                )}
              </div>
            </InlineField>
          )}
          {draft.tankId !== null && (
            <>
              <LevelField
                label={offLabel}
                value={draft.offLevel}
                hasError={hasOffError}
                onChange={(offLevel) => commit({ ...draft, offLevel })}
                readOnly={readOnly}
              />
              <LevelField
                label={onLabel}
                value={draft.onLevel}
                hasError={hasOnError}
                onChange={(onLevel) => commit({ ...draft, onLevel })}
                readOnly={readOnly}
              />
            </>
          )}
          {messageParts.length > 0 && (
            <p className="text-size-base font-semibold text-orange-800">
              {messageParts.join(" ")}
            </p>
          )}
        </>
      )}
    </div>
  );
};

const LevelField = ({
  label,
  value,
  hasError,
  onChange,
  readOnly,
}: {
  label: string;
  value: number;
  hasError: boolean;
  onChange: (value: number) => void;
  readOnly: boolean;
}) => (
  <InlineField name={label} labelSize="md">
    <NumericField
      label={label}
      displayValue={localizeDecimal(value)}
      onChangeValue={(newValue, isEmpty) => {
        if (!isEmpty) onChange(newValue);
      }}
      readOnly={readOnly}
      styleOptions={{
        padding: "md",
        ghostBorder: readOnly,
        variant: hasError ? "warning" : "default",
      }}
    />
  </InlineField>
);

const NodeTargetField = ({
  control,
  nodes,
  outletNodeId,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  control: VariableSpeedPumpControl;
  nodes: NodeAsset[];
  outletNodeId: AssetId | null;
  onChange: (node: NodeAsset) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const atNodeLabel = translate("controls.variableSpeed.atNode");
  const outletNode = nodes.find((node) => node.id === outletNodeId);
  const outletLabel = outletNode
    ? translate("controls.variableSpeed.outletOfThisPump", outletNode.label)
    : undefined;
  const options = useMemo(
    () =>
      nodes
        .filter((node) => node.id !== outletNode?.id)
        .map((node) => ({
          value: node.id,
          label: nodeOptionLabel(node, translate),
        })),
    [nodes, outletNode, translate],
  );
  const isOutletSelected = control.targetId === outletNode?.id;
  const selectedLabel = isOutletSelected
    ? outletLabel
    : options.find((option) => option.value === control.targetId)?.label;

  return (
    <InlineField name={atNodeLabel} labelSize="md">
      <div
        className="w-full"
        onMouseEnter={() => onHighlightChange(control.targetId)}
        onMouseLeave={() => onHighlightChange(null)}
      >
        {readOnly ? (
          <TextField padding="md">{selectedLabel ?? ""}</TextField>
        ) : (
          <Selector
            ariaLabel={atNodeLabel}
            options={options}
            selected={isOutletSelected ? null : control.targetId}
            nullable
            placeholder={outletLabel ?? ""}
            clearLabel={outletLabel}
            onChange={(nodeId) => {
              const node =
                nodeId === null
                  ? outletNode
                  : nodes.find((n) => n.id === nodeId);
              if (node) onChange(node);
            }}
            onActiveOptionChange={onHighlightChange}
            styleOptions={selectorStyleOptions}
          />
        )}
      </div>
    </InlineField>
  );
};

const FlowTargetField = ({
  control,
  pipes,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  control: VariableSpeedPumpControl;
  pipes: Pipe[];
  onChange: (targetId: AssetId) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const flowThroughLabel = translate("controls.variableSpeed.flowThrough");
  const thisPumpLabel = translate("controls.variableSpeed.thisPump");
  const options = useMemo(
    () => pipes.map((pipe) => ({ value: pipe.id, label: pipe.label })),
    [pipes],
  );
  const isPumpSelected = control.targetId === control.linkId;
  const selectedLabel = isPumpSelected
    ? thisPumpLabel
    : options.find((option) => option.value === control.targetId)?.label;

  return (
    <InlineField name={flowThroughLabel} labelSize="md">
      <div
        className="w-full"
        onMouseEnter={() => onHighlightChange(control.targetId)}
        onMouseLeave={() => onHighlightChange(null)}
      >
        {readOnly ? (
          <TextField padding="md">{selectedLabel ?? ""}</TextField>
        ) : (
          <Selector
            ariaLabel={flowThroughLabel}
            options={options}
            selected={isPumpSelected ? null : control.targetId}
            nullable
            placeholder={thisPumpLabel}
            clearLabel={thisPumpLabel}
            onChange={(pipeId) => onChange(pipeId ?? control.linkId)}
            onActiveOptionChange={onHighlightChange}
            styleOptions={selectorStyleOptions}
          />
        )}
      </div>
    </InlineField>
  );
};

const CheckboxRow = ({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) => (
  <label
    className={`flex items-center justify-between gap-4 py-1 text-size-base ${disabled ? "text-disabled" : "text-subtle"}`}
  >
    <span>{label}</span>
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

const ScheduleGrid = ({
  schedule,
  valueHeader,
  onChange,
  readOnly,
}: {
  schedule: VariableSpeedPumpSchedulePoint[];
  valueHeader: string;
  onChange: (schedule: VariableSpeedPumpSchedulePoint[]) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();

  const persist = useCallback(
    (rows: ScheduleRow[]) =>
      onChange(rows.map((row) => ({ time: row.time, target: row.target }))),
    [onChange],
  );

  const isTimeInSequence = useCallback(
    (value: number, rowIndex: number) => {
      const prev = rowIndex > 0 ? schedule[rowIndex - 1].time : -Infinity;
      const next =
        rowIndex < schedule.length - 1 ? schedule[rowIndex + 1].time : Infinity;
      return value >= prev && value <= next;
    },
    [schedule],
  );

  const columns: GridColumn<ScheduleRow>[] = useMemo(
    () => [
      timeColumn("time", {
        header: translate("controls.time"),
        size: 80,
        emptyValue: 0,
        isReadOnly: (rowIndex) => rowIndex === 0,
        validate: isTimeInSequence,
      }),
      floatColumn("target", {
        header: valueHeader,
        size: 80,
        emptyValue: 0,
      }),
    ],
    [translate, isTimeInSequence, valueHeader],
  );

  const nextRowAfter = (row: ScheduleRow): ScheduleRow => ({
    time: row.time + ONE_HOUR_IN_SECONDS,
    target: row.target,
  });

  const createRow = useCallback(
    (): ScheduleRow => nextRowAfter(schedule[schedule.length - 1]),
    [schedule],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist(schedule.filter((_, i) => i !== rowIndex)),
        hidden: (rowIndex: number) => rowIndex === 0,
        variant: "destructive" as const,
      },
      {
        label: translate("insertRowAbove"),
        icon: <AddIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist([
            ...schedule.slice(0, rowIndex),
            { ...schedule[rowIndex] },
            ...schedule.slice(rowIndex),
          ]),
        hidden: (rowIndex: number) => rowIndex === 0,
      },
      {
        label: translate("insertRowBelow"),
        icon: <AddIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist([
            ...schedule.slice(0, rowIndex + 1),
            nextRowAfter(schedule[rowIndex]),
            ...schedule.slice(rowIndex + 1),
          ]),
      },
    ],
    [translate, schedule, persist],
  );

  return (
    <DataGrid<ScheduleRow>
      data={schedule}
      columns={columns}
      onChange={persist}
      createRow={createRow}
      rowActions={rowActions}
      addRowLabel={translate("controls.addTimeStep")}
      variant="inline"
      gutterColumn="numbered"
      readOnly={readOnly}
    />
  );
};

const LagPumpsSection = ({
  laggedPumpIds,
  candidates,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  laggedPumpIds: AssetId[];
  candidates: Pump[];
  onChange: (laggedPumpIds: AssetId[]) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const [synced, setSynced] = useState(laggedPumpIds);
  const [rows, setRows] = useState<LagRow[]>(() => toLagRows(laggedPumpIds));
  if (laggedPumpIds !== synced) {
    setSynced(laggedPumpIds);
    if (!haveSamePumps(laggedPumpIds, selectedPumpIds(rows)))
      setRows(toLagRows(laggedPumpIds));
  }

  const commit = (nextRows: LagRow[]) => {
    setRows(nextRows);
    const nextIds = selectedPumpIds(nextRows);
    if (!haveSamePumps(nextIds, laggedPumpIds)) onChange(nextIds);
  };

  const isEnabled = rows.length > 0;

  return (
    <>
      <CheckboxRow
        label={translate("controls.variableSpeed.lagPumps")}
        checked={isEnabled}
        onChange={(checked) => commit(checked ? [{ pumpId: null }] : [])}
        disabled={readOnly || (!isEnabled && candidates.length === 0)}
      />
      {isEnabled && (
        <LagPumpsGrid
          rows={rows}
          candidates={candidates}
          onChange={commit}
          onHighlightChange={onHighlightChange}
          readOnly={readOnly}
        />
      )}
    </>
  );
};

const toLagRows = (laggedPumpIds: AssetId[]): LagRow[] =>
  laggedPumpIds.map((pumpId) => ({ pumpId }));

const selectedPumpIds = (rows: LagRow[]): AssetId[] =>
  rows.map((row) => row.pumpId).filter((id): id is AssetId => id !== null);

const haveSamePumps = (a: AssetId[], b: AssetId[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

const LagPumpsGrid = ({
  rows,
  candidates,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  rows: LagRow[];
  candidates: Pump[];
  onChange: (rows: LagRow[]) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();

  const options = useMemo(
    () => candidates.map((pump) => ({ value: pump.id, label: pump.label })),
    [candidates],
  );

  const columns: GridColumn<LagRow>[] = useMemo(
    () => [
      filterableSelectColumn<AssetId, LagRow>("pumpId", {
        header: translate("pump"),
        size: 160,
        options,
        placeholder: translate("none"),
        emptyOptionLabel: translate("none"),
        emptyValue: null,
        onHighlightChange,
      }),
    ],
    [translate, options, onHighlightChange],
  );

  const createRow = useCallback((): LagRow => ({ pumpId: null }), []);

  const duplicateRows = useMemo(() => duplicatePumpRows(rows), [rows]);
  const cellHasWarning = useCallback(
    (rowIndex: number) => duplicateRows.has(rowIndex),
    [duplicateRows],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          onChange(rows.filter((_, i) => i !== rowIndex)),
        variant: "destructive" as const,
      },
    ],
    [translate, rows, onChange],
  );

  return (
    <DataGrid<LagRow>
      data={rows}
      columns={columns}
      onChange={onChange}
      createRow={createRow}
      rowActions={rowActions}
      addRowLabel={translate("controls.variableSpeed.addPump")}
      variant="inline"
      gutterColumn="numbered"
      readOnly={readOnly}
      cellHasWarning={cellHasWarning}
    />
  );
};

const duplicatePumpRows = (rows: LagRow[]): Set<number> => {
  const rowsByPump = new Map<AssetId, number[]>();
  rows.forEach(({ pumpId }, rowIndex) => {
    if (pumpId === null) return;
    const indices = rowsByPump.get(pumpId);
    if (indices) indices.push(rowIndex);
    else rowsByPump.set(pumpId, [rowIndex]);
  });
  const duplicates = new Set<number>();
  for (const indices of rowsByPump.values()) {
    if (indices.length > 1) indices.forEach((i) => duplicates.add(i));
  }
  return duplicates;
};

const useAssetHighlight = (targets: VariableSpeedPumpTargets) => {
  const setHighlights = useSetAtom(highlightsAtom);

  const highlightAsset = useCallback(
    (assetId: AssetId | null) => {
      if (assetId === null) {
        setHighlights([]);
        return;
      }
      const node = targets.nodes.find((n) => n.id === assetId);
      if (node) {
        const [lng, lat] = node.coordinates;
        setHighlights([
          {
            type: "marker",
            coordinates: [lng, lat],
            nodeType: node.feature.properties.type,
          },
        ]);
        return;
      }
      setHighlights([{ type: "asset", assetId }]);
    },
    [targets.nodes, setHighlights],
  );

  useEffect(() => () => setHighlights([]), [setHighlights]);

  return highlightAsset;
};

const nodeOptionLabel = (
  node: NodeAsset,
  translate: ReturnType<typeof useTranslate>,
): string => {
  if (node.type === "tank")
    return translate("controls.variableSpeed.tankNode", node.label);
  return node.label;
};
