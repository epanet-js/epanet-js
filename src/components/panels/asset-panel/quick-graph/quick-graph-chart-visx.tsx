import { useMemo, useCallback, useState } from "react";
import { scaleLinear } from "@visx/scale";
import { LinePath, AreaClosed } from "@visx/shape";
import { AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { localPoint } from "@visx/event";

interface TooltipState {
  x: number;
  y: number;
  data: DataPoint;
}

interface QuickGraphChartVisxProps {
  values: Float32Array | number[];
  timestepCount: number;
  reportingTimeStep: number; // seconds
  currentTimestepIndex?: number;
  onTimestepClick?: (timestepIndex: number) => void;
  isDarkMode?: boolean;
  noDataMessage?: string;
}

interface DataPoint {
  index: number;
  value: number;
  time: string;
}

const WIDTH = 180;
const HEIGHT = 100;
const MARGIN = { top: 8, right: 8, bottom: 4, left: 36 };

export function QuickGraphChartVisx({
  values,
  timestepCount,
  reportingTimeStep,
  currentTimestepIndex,
  onTimestepClick,
  isDarkMode = false,
  noDataMessage = "No data available",
}: QuickGraphChartVisxProps) {
  const [containerWidth, setContainerWidth] = useState(WIDTH);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(node);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Convert to data points array
  const data: DataPoint[] = useMemo(() => {
    const arr = Array.from(values);
    return arr.map((value, index) => {
      const totalSeconds = index * reportingTimeStep;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return {
        index,
        value,
        time: `${hours}:${minutes.toString().padStart(2, "0")}`,
      };
    });
  }, [values, reportingTimeStep]);

  // Dimensions
  const innerWidth = containerWidth - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Scales
  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, timestepCount - 1],
        range: [0, innerWidth],
      }),
    [timestepCount, innerWidth],
  );

  const yScale = useMemo(() => {
    const vals = Array.from(values);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const padding = (maxVal - minVal) * 0.1 || 1;
    return scaleLinear<number>({
      domain: [minVal - padding, maxVal + padding],
      range: [innerHeight, 0],
      nice: true,
    });
  }, [values, innerHeight]);

  // Accessors
  const getX = (d: DataPoint) => xScale(d.index) ?? 0;
  const getY = (d: DataPoint) => yScale(d.value) ?? 0;

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Colors
  const lineColor = "#8b5cf6"; // purple-500
  const areaColor = isDarkMode
    ? "rgba(139, 92, 246, 0.25)"
    : "rgba(139, 92, 246, 0.15)";
  const markLineColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const axisColor = isDarkMode ? "#9ca3af" : "#6b7280";

  // Handle mouse events
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event);
      if (!point) return;

      const x = point.x - MARGIN.left;
      const index = Math.round(xScale.invert(x));
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      const d = data[clampedIndex];

      if (d) {
        setTooltip({
          x: getX(d) + MARGIN.left,
          y: getY(d) + MARGIN.top,
          data: d,
        });
      }
    },
    [xScale, data, getX, getY],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (!onTimestepClick) return;

      const point = localPoint(event);
      if (!point) return;

      const x = point.x - MARGIN.left;
      const index = Math.round(xScale.invert(x));
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      onTimestepClick(clampedIndex);
    },
    [xScale, data, onTimestepClick],
  );

  // Format Y axis tick values
  const formatYTick = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    if (Math.abs(value) < 0.01 && value !== 0) {
      return value.toExponential(1);
    }
    return value.toFixed(Math.abs(value) < 1 ? 2 : 1);
  };

  if (timestepCount === 0 || data.length === 0) {
    return (
      <div className="h-[100px] flex items-center justify-center text-gray-400 text-xs">
        {noDataMessage}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width={containerWidth} height={HEIGHT}>
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Area fill */}
          <AreaClosed<DataPoint>
            data={data}
            x={getX}
            y={getY}
            yScale={yScale}
            fill={areaColor}
          />

          {/* Line */}
          <LinePath<DataPoint>
            data={data}
            x={getX}
            y={getY}
            stroke={lineColor}
            strokeWidth={1.5}
          />

          {/* Current timestep marker */}
          {currentTimestepIndex !== undefined && (
            <line
              x1={xScale(currentTimestepIndex)}
              x2={xScale(currentTimestepIndex)}
              y1={0}
              y2={innerHeight}
              stroke={markLineColor}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          )}

          {/* Y Axis */}
          <AxisLeft
            scale={yScale}
            numTicks={3}
            tickFormat={(v) => formatYTick(v as number)}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={{
              fill: axisColor,
              fontSize: 10,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            }}
          />

          {/* Invisible rect for mouse events */}
          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: onTimestepClick ? "pointer" : "default" }}
          />
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%) translateY(-8px)",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            border: "1px solid #e5e7eb",
            color: "#1f2937",
            fontSize: 11,
            padding: "4px 8px",
            borderRadius: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div>{tooltip.data.time}</div>
          <div>{tooltip.data.value.toFixed(3)}</div>
        </div>
      )}
    </div>
  );
}
