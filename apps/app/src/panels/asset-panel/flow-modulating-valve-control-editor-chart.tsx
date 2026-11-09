import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { FlowModulatingValvePoint } from "@epanet-js/hydraulic-model";
import { getLocale, localizeDecimal } from "@epanet-js/i18n";
import { colors } from "src/lib/constants";

const CHART_EDGE_MARGIN = 0.2;
const CHART_READOUT_OFFSET = 12;
const CHART_READOUT_DECIMALS = 2;

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

type CurveUnits = { flow: string; pressure: string };

export const pressureAt = (
  points: FlowModulatingValvePoint[],
  flow: number,
  interpolate: boolean,
): number | null => {
  const sorted = [...points].sort((a, b) => a.flow - b.flow);
  if (sorted.length === 0) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (flow <= first.flow) return first.pressure;
  if (flow >= last.flow) return last.pressure;

  const nextIndex = sorted.findIndex((point) => point.flow > flow);
  const before = sorted[nextIndex - 1];
  const after = sorted[nextIndex];
  if (!interpolate) return before.pressure;

  const ratio = (flow - before.flow) / (after.flow - before.flow);
  return before.pressure + ratio * (after.pressure - before.pressure);
};

export const formatCurveReadout = (
  { flow, pressure }: FlowModulatingValvePoint,
  units: CurveUnits,
): string => {
  const format = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: CHART_READOUT_DECIMALS,
    maximumFractionDigits: CHART_READOUT_DECIMALS,
  });
  const withUnit = (value: number, unit: string) => {
    const text = format.format(value);
    return unit ? `${text} ${unit}` : text;
  };
  return `${withUnit(flow, units.flow)}: ${withUnit(pressure, units.pressure)}`;
};

type CurveReadout = { x: number; y: number; text: string };

export const CurveChart = ({
  points,
  interpolate,
  flowLabel,
  pressureLabel,
  units,
}: {
  points: FlowModulatingValvePoint[];
  interpolate: boolean;
  flowLabel: string;
  pressureLabel: string;
  units: CurveUnits;
}) => {
  const option = useMemo(
    () =>
      buildCurveChartOption(points, interpolate, { flowLabel, pressureLabel }),
    [points, interpolate, flowLabel, pressureLabel],
  );

  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [readout, setReadout] = useState<CurveReadout | null>(null);

  const hideReadout = useCallback(() => setReadout(null), []);
  const updateReadout = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const chart = chartRef.current?.getEchartsInstance();
      const container = containerRef.current;
      if (!chart || !container) return setReadout(null);

      const chartRect = chart.getDom().getBoundingClientRect();
      const pixel = [
        event.clientX - chartRect.left,
        event.clientY - chartRect.top,
      ];
      if (!chart.containPixel({ gridIndex: 0 }, pixel)) return setReadout(null);

      const [flow] = chart.convertFromPixel({ gridIndex: 0 }, pixel);
      const pressure = pressureAt(points, flow, interpolate);
      if (pressure === null) return setReadout(null);

      const containerRect = container.getBoundingClientRect();
      setReadout({
        x: event.clientX - containerRect.left,
        y: event.clientY - containerRect.top,
        text: formatCurveReadout({ flow, pressure }, units),
      });
    },
    [points, interpolate, units],
  );

  useEffect(function resizeChart() {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance().resize();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const readoutOnLeft = readout !== null && readout.x > containerWidth / 2;

  return (
    <div
      ref={containerRef}
      className="relative h-[120px] w-full pt-2"
      onMouseMove={updateReadout}
      onMouseLeave={hideReadout}
    >
      <ReactECharts
        ref={chartRef}
        option={option}
        notMerge
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "svg" }}
      />
      {readout && (
        <div
          role="status"
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded border bg-popover px-2 py-1 text-size-small text-default tabular-nums shadow-xs"
          style={{
            left: readoutOnLeft
              ? readout.x - CHART_READOUT_OFFSET
              : readout.x + CHART_READOUT_OFFSET,
            top: Math.max(0, readout.y - CHART_READOUT_OFFSET),
            transform: readoutOnLeft ? "translateX(-100%)" : undefined,
          }}
        >
          {readout.text}
        </div>
      )}
    </div>
  );
};
