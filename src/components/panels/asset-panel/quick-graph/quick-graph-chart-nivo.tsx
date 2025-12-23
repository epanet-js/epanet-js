import { useMemo, useCallback } from "react";
import { ResponsiveLine } from "@nivo/line";

interface QuickGraphChartNivoProps {
  values: Float32Array | number[];
  timestepCount: number;
  reportingTimeStep: number; // seconds
  currentTimestepIndex?: number;
  onTimestepClick?: (timestepIndex: number) => void;
  isDarkMode?: boolean;
  noDataMessage?: string;
}

export function QuickGraphChartNivo({
  values,
  timestepCount,
  reportingTimeStep,
  currentTimestepIndex,
  onTimestepClick,
  isDarkMode = false,
  noDataMessage = "No data available",
}: QuickGraphChartNivoProps) {
  // Convert to Nivo data format
  const data = useMemo(() => {
    const arr = Array.from(values);
    const points = arr.map((value, index) => {
      const totalSeconds = index * reportingTimeStep;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return {
        x: `${hours}:${minutes.toString().padStart(2, "0")}`,
        y: value,
        index,
      };
    });

    return [
      {
        id: "values",
        data: points,
      },
    ];
  }, [values, reportingTimeStep]);

  // Colors
  const lineColor = "#8b5cf6"; // purple-500
  const areaColor = isDarkMode
    ? "rgba(139, 92, 246, 0.25)"
    : "rgba(139, 92, 246, 0.15)";
  const axisColor = isDarkMode ? "#9ca3af" : "#6b7280";
  const markLineColor = isDarkMode ? "#9ca3af" : "#6b7280";

  // Custom tooltip
  const CustomTooltip = useCallback(
    ({
      point,
    }: {
      point: { data: { x: string | number; y: number | null } };
    }) => (
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          border: "1px solid #e5e7eb",
          color: "#1f2937",
          fontSize: 11,
          padding: "4px 8px",
          borderRadius: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div>{point.data.x}</div>
        <div>
          {typeof point.data.y === "number" ? point.data.y.toFixed(3) : point.data.y}
        </div>
      </div>
    ),
    [],
  );

  // Handle click
  const handleClick = useCallback(
    (point: { data: { index?: number } }) => {
      if (onTimestepClick && typeof point.data.index === "number") {
        onTimestepClick(point.data.index);
      }
    },
    [onTimestepClick],
  ) as (point: unknown) => void;

  // Current timestep marker
  const markers = useMemo(() => {
    if (currentTimestepIndex === undefined) return [];

    const totalSeconds = currentTimestepIndex * reportingTimeStep;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeLabel = `${hours}:${minutes.toString().padStart(2, "0")}`;

    return [
      {
        axis: "x" as const,
        value: timeLabel,
        lineStyle: {
          stroke: markLineColor,
          strokeWidth: 1,
          strokeDasharray: "4,4",
        },
      },
    ];
  }, [currentTimestepIndex, reportingTimeStep, markLineColor]);

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

  if (timestepCount === 0 || values.length === 0) {
    return (
      <div className="h-[100px] flex items-center justify-center text-gray-400 text-xs">
        {noDataMessage}
      </div>
    );
  }

  return (
    <div style={{ height: 100, width: "100%" }}>
      <ResponsiveLine
        data={data}
        margin={{ top: 8, right: 8, bottom: 4, left: 36 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: "auto", max: "auto", nice: true }}
        curve="linear"
        enableArea={true}
        areaOpacity={1}
        colors={[lineColor]}
        lineWidth={1.5}
        enablePoints={false}
        enableGridX={false}
        enableGridY={false}
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={{
          tickSize: 0,
          tickPadding: 4,
          tickRotation: 0,
          format: formatYTick,
          tickValues: 3,
        }}
        markers={markers}
        tooltip={CustomTooltip}
        onClick={handleClick}
        useMesh={true}
        animate={false}
        theme={{
          axis: {
            ticks: {
              text: {
                fill: axisColor,
                fontSize: 10,
              },
            },
          },
        }}
        defs={[
          {
            id: "areaGradient",
            type: "linearGradient",
            colors: [
              { offset: 0, color: areaColor },
              { offset: 100, color: areaColor },
            ],
          },
        ]}
        fill={[{ match: "*", id: "areaGradient" }]}
      />
    </div>
  );
}
