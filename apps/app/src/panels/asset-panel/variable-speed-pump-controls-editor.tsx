import { useCallback, useEffect, useMemo } from "react";
import { useSetAtom } from "jotai";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  NodeAsset,
  Pipe,
  Pump,
  VariableSpeedPumpControl,
  VariableSpeedPumpSchedulePoint,
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
});

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
  const hasLagPumps = control.laggedPumpIds.length > 0;
  const hasSpeedRangeError = control.minSpeed > control.maxSpeed;
  const minSpeedLabel = translate("controls.variableSpeed.minSpeed");
  const maxSpeedLabel = translate("controls.variableSpeed.maxSpeed");

  const update = (changes: Partial<VariableSpeedPumpControl>) =>
    onControlChange({ ...control, ...changes });

  const highlightAsset = useAssetHighlight(targets);

  const lagCandidates = useMemo(
    () => targets.pumps.filter((pump) => pump.id !== control.linkId),
    [targets.pumps, control.linkId],
  );

  const handleVaryByTimeChange = (checked: boolean) => {
    update({
      schedule: checked ? [{ time: 0, target: control.target }] : [],
    });
  };

  const handleLagPumpsChange = (checked: boolean) => {
    if (!checked) {
      update({ laggedPumpIds: [] });
      return;
    }
    const first = lagCandidates[0];
    if (first) update({ laggedPumpIds: [first.id] });
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
            })
          }
          onHighlightChange={highlightAsset}
          readOnly={readOnly}
        />
      )}

      <InlineField name={quantityLabel} labelSize="md">
        {isScheduled ? (
          <TextField padding="md">
            {translate("controls.variableSpeed.setBySchedule")}
          </TextField>
        ) : (
          <NumericField
            label={quantityLabel}
            displayValue={localizeDecimal(control.target)}
            onChangeValue={(value, isEmpty) => {
              if (!isEmpty) update({ target: value });
            }}
            readOnly={readOnly}
            styleOptions={{ padding: "md", ghostBorder: readOnly }}
          />
        )}
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

      <div className="grid grid-cols-2 gap-2 pt-2">
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

      <div className="pt-2">
        <CheckboxRow
          label={translate("controls.variableSpeed.lagPumps")}
          checked={hasLagPumps}
          onChange={handleLagPumpsChange}
          disabled={readOnly || (!hasLagPumps && lagCandidates.length === 0)}
        />
      </div>

      {hasLagPumps && (
        <LagPumpsGrid
          laggedPumpIds={control.laggedPumpIds}
          candidates={lagCandidates}
          onChange={(laggedPumpIds) => update({ laggedPumpIds })}
          onHighlightChange={highlightAsset}
          readOnly={readOnly}
        />
      )}
    </NestedSection>
  );
};

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
  const options = useMemo(
    () =>
      nodes.map((node) => ({
        value: node.id,
        label: nodeOptionLabel(node, outletNodeId, translate),
      })),
    [nodes, outletNodeId, translate],
  );
  const selected = options.find((option) => option.value === control.targetId);

  return (
    <InlineField name={atNodeLabel} labelSize="md">
      <div
        className="w-full"
        onMouseEnter={() => onHighlightChange(control.targetId)}
        onMouseLeave={() => onHighlightChange(null)}
      >
        {readOnly ? (
          <TextField padding="md">{selected?.label ?? ""}</TextField>
        ) : (
          <Selector
            ariaLabel={atNodeLabel}
            options={options}
            selected={control.targetId}
            onChange={(nodeId) => {
              const node = nodes.find((n) => n.id === nodeId);
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
  const options = useMemo(
    () => [
      {
        value: control.linkId,
        label: translate("controls.variableSpeed.thisPump"),
      },
      ...pipes.map((pipe) => ({ value: pipe.id, label: pipe.label })),
    ],
    [pipes, control.linkId, translate],
  );
  const selected = options.find((option) => option.value === control.targetId);

  return (
    <InlineField name={flowThroughLabel} labelSize="md">
      <div
        className="w-full"
        onMouseEnter={() => onHighlightChange(control.targetId)}
        onMouseLeave={() => onHighlightChange(null)}
      >
        {readOnly ? (
          <TextField padding="md">{selected?.label ?? ""}</TextField>
        ) : (
          <Selector
            ariaLabel={flowThroughLabel}
            options={options}
            selected={control.targetId}
            onChange={onChange}
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
  <label className="flex items-center justify-between gap-4 py-1 text-size-base text-subtle">
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

const LagPumpsGrid = ({
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
  const rows = useMemo<LagRow[]>(
    () => laggedPumpIds.map((pumpId) => ({ pumpId })),
    [laggedPumpIds],
  );

  const persist = useCallback(
    (newRows: LagRow[]) =>
      onChange(
        newRows
          .map((row) => row.pumpId)
          .filter((id): id is AssetId => id !== null),
      ),
    [onChange],
  );

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
        placeholder: translate("pump"),
        emptyValue: null,
        onHighlightChange,
      }),
    ],
    [translate, options, onHighlightChange],
  );

  const createRow = useCallback((): LagRow => {
    const used = new Set(laggedPumpIds);
    const next = candidates.find((pump) => !used.has(pump.id));
    return { pumpId: next?.id ?? null };
  }, [laggedPumpIds, candidates]);

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist(rows.filter((_, i) => i !== rowIndex)),
        variant: "destructive" as const,
      },
    ],
    [translate, rows, persist],
  );

  return (
    <DataGrid<LagRow>
      data={rows}
      columns={columns}
      onChange={persist}
      createRow={createRow}
      rowActions={rowActions}
      addRowLabel={translate("controls.variableSpeed.addPump")}
      variant="inline"
      gutterColumn="numbered"
      readOnly={readOnly}
    />
  );
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
  outletNodeId: AssetId | null,
  translate: ReturnType<typeof useTranslate>,
): string => {
  if (node.id === outletNodeId)
    return translate("controls.variableSpeed.outletOfThisPump", node.label);
  if (node.type === "tank")
    return translate("controls.variableSpeed.tankNode", node.label);
  return node.label;
};
