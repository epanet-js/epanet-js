import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Selector } from "@epanet-js/ui-kit";
import {
  AssetId,
  buildDefaultFlowModulatingValve,
  FlowModulatingValveControl,
  FlowModulatingValvePoint,
  LinkAsset,
  NodeAsset,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import { localizeDecimal } from "@epanet-js/i18n";
import {
  DataGrid,
  type GridColumn,
  floatColumn,
} from "src/components/data-grid";
import {
  FLOW_MODULATING_VALVE_MIN_POINTS,
  getFlowModulatingValvePointErrors,
} from "src/lib/model-attributes-validation";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { DeleteIcon, AddIcon } from "src/icons";
import { InlineField, NestedSection } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { colors } from "src/lib/constants";
import { useUserTracking } from "src/infra/user-tracking";
import {
  CheckboxRow,
  useAssetHighlight,
} from "./variable-speed-pump-controls-editor";

export type FlowModulatingValveTargets = {
  nodes: NodeAsset[];
  links: LinkAsset[];
  outletNodeId: AssetId | null;
  units: UnitsSpec;
};

type ControlType = "none" | "flowModulated";

type PointRow = { flow: number; pressure: number };

const FLOW_STEP_WITHOUT_SLOPE = 1;
const CHART_EDGE_MARGIN = 0.2;

const selectorStyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
} as const;

export const ValveControlsEditor = ({
  valveId,
  setting,
  control,
  targets,
  onControlChange,
  readOnly = false,
}: {
  valveId: AssetId;
  setting: number;
  control: FlowModulatingValveControl | null;
  targets: FlowModulatingValveTargets;
  onControlChange: (control: FlowModulatingValveControl | null) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const controlType: ControlType = control ? "flowModulated" : "none";
  const canBeFlowModulated = targets.outletNodeId !== null;

  const typeOptions = useMemo(
    () => [
      { value: "none" as const, label: translate("none") },
      {
        value: "flowModulated" as const,
        label: translate("controls.flowModulating.type"),
        disabled: !canBeFlowModulated,
      },
    ],
    [translate, canBeFlowModulated],
  );
  const selectedTypeOption = typeOptions.find((o) => o.value === controlType);

  const handleTypeChange = (newValue: ControlType) => {
    if (newValue === controlType) return;
    if (newValue === "flowModulated" && targets.outletNodeId !== null) {
      onControlChange(
        buildDefaultFlowModulatingValve(valveId, targets.outletNodeId, setting),
      );
      return;
    }
    onControlChange(null);
  };

  return (
    <>
      <InlineField name={translate("type")} labelSize="md">
        {readOnly ? (
          <TextField padding="md">{selectedTypeOption?.label ?? ""}</TextField>
        ) : (
          <div className="w-full">
            <Selector
              ariaLabel={translate("type")}
              options={typeOptions}
              selected={controlType}
              onChange={handleTypeChange}
              styleOptions={selectorStyleOptions}
            />
          </div>
        )}
      </InlineField>
      {control && (
        <FlowModulatingValveControlsEditor
          control={control}
          targets={targets}
          onControlChange={onControlChange}
          readOnly={readOnly}
        />
      )}
    </>
  );
};

export const FlowModulatingValveControlsEditor = ({
  control,
  targets,
  onControlChange,
  readOnly,
}: {
  control: FlowModulatingValveControl;
  targets: FlowModulatingValveTargets;
  onControlChange: (control: FlowModulatingValveControl) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const userTracking = useUserTracking();
  const highlightAsset = useAssetHighlight(targets.nodes);

  const withUnit = (label: string, unit: string) =>
    unit ? `${label} (${unit})` : label;
  const flowLabel = withUnit(
    translate("flow"),
    translateUnit(targets.units.flow),
  );
  const pressureLabel = withUnit(
    translate("pressure"),
    translateUnit(targets.units.pressure),
  );

  const update = (changes: Partial<FlowModulatingValveControl>) => {
    onControlChange({ ...control, ...changes });
  };

  const track = (fields: {
    hasRemoteSensor?: boolean;
    hasRemoteControlNode?: boolean;
    interpolate?: boolean;
    pointsCount?: number;
  }) => {
    userTracking.capture({
      name: "assetControl.flowModulatingControlChanged",
      ...fields,
    });
  };

  return (
    <NestedSection className="pb-2">
      <SensorLinkField
        control={control}
        links={targets.links}
        onChange={(sensorLinkId) => {
          update({ sensorLinkId });
          track({ hasRemoteSensor: sensorLinkId !== control.linkId });
        }}
        onHighlightChange={highlightAsset}
        readOnly={readOnly}
      />
      <ControlNodeField
        control={control}
        nodes={targets.nodes}
        outletNodeId={targets.outletNodeId}
        onChange={(controlNodeId) => {
          update({ controlNodeId });
          track({
            hasRemoteControlNode: controlNodeId !== targets.outletNodeId,
          });
        }}
        onHighlightChange={highlightAsset}
        readOnly={readOnly}
      />
      <CheckboxRow
        label={translate("controls.flowModulating.linearInterpolation")}
        checked={control.interpolate}
        onChange={(interpolate) => {
          update({ interpolate });
          track({ interpolate });
        }}
        disabled={readOnly}
      />
      <PointsGrid
        points={control.points}
        flowHeader={flowLabel}
        pressureHeader={pressureLabel}
        onChange={(points) => {
          update({ points });
          if (points.length !== control.points.length) {
            track({ pointsCount: points.length });
          }
        }}
        readOnly={readOnly}
      />
      <CurveChart
        points={control.points}
        interpolate={control.interpolate}
        flowLabel={flowLabel}
        pressureLabel={pressureLabel}
      />
    </NestedSection>
  );
};

export const buildCurveChartOption = (
  points: FlowModulatingValvePoint[],
  interpolate: boolean,
  { flowLabel, pressureLabel }: { flowLabel: string; pressureLabel: string },
): EChartsOption => {
  const sorted = [...points].sort((a, b) => a.flow - b.flow);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = first && last ? last.flow - first.flow : 0;
  const margin =
    (span > 0 ? span : Math.max(Math.abs(last?.flow ?? 0), 1)) *
    CHART_EDGE_MARGIN;
  const xMin = first ? Math.min(0, first.flow) : 0;
  const xMax = last ? last.flow + margin : 1;

  const edge = (flow: number, pressure: number) => ({
    value: [flow, pressure],
    symbol: "none",
  });
  const data =
    first && last
      ? [
          edge(xMin, first.pressure),
          ...sorted.map(({ flow, pressure }) => [flow, pressure]),
          edge(xMax, last.pressure),
        ]
      : [];

  const axis = (name: string) => ({
    type: "value" as const,
    name,
    nameLocation: "middle" as const,
    nameGap: 24,
    nameTextStyle: { color: colors.gray500, fontSize: 12 },
    scale: true,
    splitLine: {
      show: true,
      lineStyle: { color: colors.gray300, type: "dashed" as const },
    },
    axisLine: { show: true, lineStyle: { color: colors.gray300 } },
    axisTick: { show: true, lineStyle: { color: colors.gray300 } },
    axisLabel: {
      color: colors.gray500,
      fontSize: 12,
      hideOverlap: true,
      formatter: (value: number) => localizeDecimal(value),
    },
  });

  return {
    animation: false,
    grid: { top: 8, right: 8, bottom: 36, left: 48, containLabel: false },
    xAxis: { ...axis(flowLabel), min: xMin, max: xMax },
    yAxis: { ...axis(pressureLabel), nameGap: 36 },
    tooltip: { trigger: "item" },
    series: [
      {
        type: "line",
        data,
        step: interpolate ? false : "end",
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: colors.purple500, width: 2 },
        itemStyle: { color: colors.purple500 },
        smooth: false,
      },
    ],
  };
};

const CurveChart = ({
  points,
  interpolate,
  flowLabel,
  pressureLabel,
}: {
  points: FlowModulatingValvePoint[];
  interpolate: boolean;
  flowLabel: string;
  pressureLabel: string;
}) => {
  const option = useMemo(
    () =>
      buildCurveChartOption(points, interpolate, { flowLabel, pressureLabel }),
    [points, interpolate, flowLabel, pressureLabel],
  );

  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(function resizeChart() {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance().resize();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-[120px] w-full pt-2">
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
};

const PointsGrid = ({
  points,
  flowHeader,
  pressureHeader,
  onChange,
  readOnly,
}: {
  points: FlowModulatingValvePoint[];
  flowHeader: string;
  pressureHeader: string;
  onChange: (points: FlowModulatingValvePoint[]) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();

  const persist = useCallback(
    (rows: PointRow[]) =>
      onChange(rows.map((row) => ({ flow: row.flow, pressure: row.pressure }))),
    [onChange],
  );

  const invalidCells = useMemo(
    () => getFlowModulatingValvePointErrors(points),
    [points],
  );
  const cellHasWarning = useCallback(
    (rowIndex: number, columnId: string) =>
      columnId === "flow"
        ? invalidCells.flow.has(rowIndex)
        : columnId === "pressure" && invalidCells.pressure.has(rowIndex),
    [invalidCells],
  );

  const isFlowValid = useCallback(
    (value: number, rowIndex: number) =>
      isValueInSequence(points, rowIndex, value, "flow"),
    [points],
  );
  const isPressureValid = useCallback(
    (value: number, rowIndex: number) =>
      isValueInSequence(points, rowIndex, value, "pressure"),
    [points],
  );

  const columns: GridColumn<PointRow>[] = useMemo(
    () => [
      floatColumn("flow", {
        header: flowHeader,
        size: 80,
        validate: isFlowValid,
        commitInvalidValues: true,
      }),
      floatColumn("pressure", {
        header: pressureHeader,
        size: 80,
        validate: isPressureValid,
        commitInvalidValues: true,
      }),
    ],
    [flowHeader, pressureHeader, isFlowValid, isPressureValid],
  );

  const createRow = useCallback(
    (): PointRow => nextRowAfter(points, points.length - 1),
    [points],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist(points.filter((_, i) => i !== rowIndex)),
        hidden: (rowIndex: number) =>
          rowIndex === 0 || points.length <= FLOW_MODULATING_VALVE_MIN_POINTS,
        variant: "destructive" as const,
      },
      {
        label: translate("insertRowAbove"),
        icon: <AddIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist([
            ...points.slice(0, rowIndex),
            rowBefore(points, rowIndex),
            ...points.slice(rowIndex),
          ]),
        hidden: (rowIndex: number) => rowIndex === 0 && points[0].flow <= 0,
      },
      {
        label: translate("insertRowBelow"),
        icon: <AddIcon size="sm" />,
        onSelect: (rowIndex: number) =>
          persist([
            ...points.slice(0, rowIndex + 1),
            nextRowAfter(points, rowIndex),
            ...points.slice(rowIndex + 1),
          ]),
      },
    ],
    [translate, points, persist],
  );

  return (
    <DataGrid<PointRow>
      data={points}
      columns={columns}
      onChange={persist}
      createRow={createRow}
      rowActions={rowActions}
      addRowLabel={translate("controls.flowModulating.addPoint")}
      variant="inline"
      gutterColumn="numbered"
      readOnly={readOnly}
      cellHasWarning={cellHasWarning}
    />
  );
};

const SensorLinkField = ({
  control,
  links,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  control: FlowModulatingValveControl;
  links: LinkAsset[];
  onChange: (sensorLinkId: AssetId) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const flowThroughLabel = translate("controls.flowModulating.flowThrough");
  const thisValveLabel = translate("controls.flowModulating.thisValve");
  const options = useMemo(
    () =>
      links
        .filter(
          (link) =>
            link.id !== control.linkId &&
            (link.isActive || link.id === control.sensorLinkId),
        )
        .map((link) => ({ value: link.id, label: link.label })),
    [links, control.linkId, control.sensorLinkId],
  );
  const isValveSelected = control.sensorLinkId === control.linkId;
  const selectedLabel = isValveSelected
    ? thisValveLabel
    : options.find((option) => option.value === control.sensorLinkId)?.label;

  return (
    <InlineField name={flowThroughLabel} labelSize="md">
      <div
        className="w-full"
        onMouseEnter={() => onHighlightChange(control.sensorLinkId)}
        onMouseLeave={() => onHighlightChange(null)}
      >
        {readOnly ? (
          <TextField padding="md">{selectedLabel ?? ""}</TextField>
        ) : (
          <Selector
            ariaLabel={flowThroughLabel}
            options={options}
            selected={isValveSelected ? null : control.sensorLinkId}
            nullable
            placeholder={thisValveLabel}
            clearLabel={thisValveLabel}
            onChange={(linkId) => onChange(linkId ?? control.linkId)}
            onActiveOptionChange={onHighlightChange}
            styleOptions={selectorStyleOptions}
          />
        )}
      </div>
    </InlineField>
  );
};

const ControlNodeField = ({
  control,
  nodes,
  outletNodeId,
  onChange,
  onHighlightChange,
  readOnly,
}: {
  control: FlowModulatingValveControl;
  nodes: NodeAsset[];
  outletNodeId: AssetId | null;
  onChange: (controlNodeId: AssetId) => void;
  onHighlightChange: (assetId: AssetId | null) => void;
  readOnly: boolean;
}) => {
  const translate = useTranslate();
  const controlNodeLabel = translate("controls.flowModulating.controlNode");
  const outletNode = nodes.find((node) => node.id === outletNodeId);
  const outletLabel = outletNode
    ? translate("controls.flowModulating.outletOfThisValve", outletNode.label)
    : "";
  const options = useMemo(
    () =>
      nodes
        .filter(
          (node) =>
            node.id !== outletNodeId &&
            (node.isActive || node.id === control.controlNodeId),
        )
        .map((node) => ({ value: node.id, label: node.label })),
    [nodes, outletNodeId, control.controlNodeId],
  );
  const isOutletSelected = control.controlNodeId === outletNodeId;
  const selectedLabel = isOutletSelected
    ? outletLabel
    : options.find((option) => option.value === control.controlNodeId)?.label;

  return (
    <InlineField name={controlNodeLabel} labelSize="md">
      <div
        className="w-full"
        onMouseEnter={() => onHighlightChange(control.controlNodeId)}
        onMouseLeave={() => onHighlightChange(null)}
      >
        {readOnly ? (
          <TextField padding="md">{selectedLabel ?? ""}</TextField>
        ) : (
          <Selector
            ariaLabel={controlNodeLabel}
            options={options}
            selected={isOutletSelected ? null : control.controlNodeId}
            nullable
            placeholder={outletLabel}
            clearLabel={outletLabel}
            onChange={(nodeId) => {
              const next = nodeId ?? outletNodeId;
              if (next !== null) onChange(next);
            }}
            onActiveOptionChange={onHighlightChange}
            styleOptions={selectorStyleOptions}
          />
        )}
      </div>
    </InlineField>
  );
};

const isValueInSequence = (
  points: FlowModulatingValvePoint[],
  rowIndex: number,
  value: number,
  column: keyof FlowModulatingValvePoint,
) => {
  const candidate = points.map((point, i) =>
    i === rowIndex ? { ...point, [column]: value } : point,
  );
  return !getFlowModulatingValvePointErrors(candidate)[column].has(rowIndex);
};

const rowBefore = (
  points: FlowModulatingValvePoint[],
  rowIndex: number,
): PointRow => {
  const row = points[rowIndex];
  const previousFlow = rowIndex > 0 ? points[rowIndex - 1].flow : 0;
  return { flow: (previousFlow + row.flow) / 2, pressure: row.pressure };
};

const nextRowAfter = (
  points: FlowModulatingValvePoint[],
  rowIndex: number,
): PointRow => {
  const row = points[rowIndex];
  const next = points[rowIndex + 1];
  if (next) {
    return { flow: (row.flow + next.flow) / 2, pressure: row.pressure };
  }
  const previous = points[rowIndex - 1];
  const slope = previous ? row.flow - previous.flow : 0;
  return {
    flow: row.flow + (slope > 0 ? slope : FLOW_STEP_WITHOUT_SLOPE),
    pressure: row.pressure,
  };
};
