import { forwardRef } from "react";
import { render, screen } from "@testing-library/react";
import {
  QuickGraphChart,
  type QuickGraphSeries,
  calculateInterval,
} from "./quick-graph-chart";
import { legendItemsThatFit } from "./quick-graph-legend";

const echarts = vi.hoisted(() => ({
  props: null as null | {
    option: any;
    onChartReady: (chart: unknown) => void;
  },
}));

vi.mock("echarts-for-react", () => ({
  default: forwardRef(function ReactEChartsMock(props: any, _ref) {
    echarts.props = props;
    return <div data-testid="chart" />;
  }),
}));

const aChart = () => {
  const handlers: Record<string, (params: unknown) => void> = {};
  let secondsUnderPointer = 0;
  const chart = {
    isDisposed: () => false,
    setOption: vi.fn(),
    getZr: () => ({
      on: (event: string, handler: (params: unknown) => void) => {
        handlers[event] = handler;
      },
      setCursorStyle: vi.fn(),
    }),
    containPixel: () => true,
    convertFromPixel: () => [secondsUnderPointer, 0],
  };
  echarts.props!.onChartReady(chart);
  return {
    chart,
    clickAt: (seconds: number) => {
      secondsUnderPointer = seconds;
      handlers.click({ offsetX: 0, offsetY: 0 });
    },
  };
};

const aSeries = (
  values: number[],
  times: number[],
  label: string | null = null,
): QuickGraphSeries => ({
  label,
  values,
  times,
  style: { type: "line", color: "purple" },
});

describe("QuickGraphChart", () => {
  it("plots each series at its own times", () => {
    render(
      <QuickGraphChart
        series={[
          aSeries([1, 2, 3], [0, 3600, 7200], "simulation"),
          aSeries([4, 5], [900, 4500], "sensor"),
        ]}
        timeRange={{ start: 0, end: 7200 }}
        decimals={0}
      />,
    );

    const [simulation, sensor] = echarts.props!.option.series;
    expect(simulation.data).toEqual([
      [0, 1],
      [3600, 2],
      [7200, 3],
    ]);
    expect(sensor.data).toEqual([
      [900, 4],
      [4500, 5],
    ]);
  });

  it("leaves out points outside the time range", () => {
    render(
      <QuickGraphChart
        series={[aSeries([1, 2, 3, 4], [0, 3600, 7200, 10800])]}
        timeRange={{ start: 3600, end: 7200 }}
        decimals={0}
      />,
    );

    expect(echarts.props!.option.series[0].data).toEqual([
      [3600, 2],
      [7200, 3],
    ]);
  });

  it("shows no data when no series has a point in the range", () => {
    render(
      <QuickGraphChart
        series={[aSeries([1], [10800])]}
        timeRange={{ start: 0, end: 7200 }}
        decimals={0}
      />,
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument();
  });

  it("keeps the time axis open when the range is a single instant", () => {
    render(
      <QuickGraphChart
        series={[aSeries([1], [0])]}
        timeRange={{ start: 0, end: 0 }}
        decimals={0}
      />,
    );

    const { min, max } = echarts.props!.option.xAxis;
    expect(max).toBeGreaterThan(min);
  });

  it("draws the current time line at the current time", () => {
    render(
      <QuickGraphChart
        series={[aSeries([1, 2, 3], [0, 3600, 7200])]}
        timeRange={{ start: 0, end: 7200 }}
        currentSeconds={3600}
        decimals={0}
      />,
    );

    const { chart } = aChart();

    expect(chart.setOption).toHaveBeenLastCalledWith({
      series: [
        expect.objectContaining({
          markLine: expect.objectContaining({ data: [{ xAxis: 3600 }] }),
        }),
      ],
    });
  });

  it("ignores a chart that was disposed before it was ready", () => {
    render(
      <QuickGraphChart
        series={[aSeries([1, 2], [0, 3600])]}
        timeRange={{ start: 0, end: 3600 }}
        decimals={0}
        onTimeClick={vi.fn()}
      />,
    );
    const disposed = {
      isDisposed: () => true,
      setOption: vi.fn(),
      getZr: () => null,
    };

    expect(() => echarts.props!.onChartReady(disposed)).not.toThrow();
    expect(disposed.setOption).not.toHaveBeenCalled();
  });

  it("reports clicks to the latest click handler", () => {
    const series = [aSeries([1, 2, 3], [0, 3600, 7200])];
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <QuickGraphChart
        series={series}
        timeRange={{ start: 0, end: 7200 }}
        decimals={0}
        onTimeClick={first}
      />,
    );
    const { clickAt } = aChart();

    rerender(
      <QuickGraphChart
        series={series}
        timeRange={{ start: 0, end: 7200 }}
        decimals={0}
        onTimeClick={latest}
      />,
    );
    clickAt(5400);

    expect(latest).toHaveBeenCalledWith(5400);
    expect(first).not.toHaveBeenCalled();
  });
});

describe("calculateInterval", () => {
  describe("edge cases", () => {
    it("returns zeros for empty values array", () => {
      const result = calculateInterval(2, []);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(0);
      expect(result.interval).toBeCloseTo(0);
    });

    it("handles single value", () => {
      const result = calculateInterval(2, [5.5]);
      expect(result.min).toBeCloseTo(5.3);
      expect(result.max).toBeCloseTo(5.7);
      expect(result.interval).toBeCloseTo(0.1);
    });

    it("handles all identical values", () => {
      const result = calculateInterval(2, [10, 10, 10, 10]);
      expect(result.min).toBeCloseTo(9.8);
      expect(result.max).toBeCloseTo(10.1);
      expect(result.interval).toBeCloseTo(0.1);
    });
  });

  describe("respects decimal precision", () => {
    it("rounds min down and max up to specified decimals", () => {
      const result = calculateInterval(2, [1.234, 5.678]);
      expect(result.min).toBeCloseTo(1);
      expect(result.max).toBeCloseTo(6);
      expect(result.interval).toBeCloseTo(1);
    });

    it("handles 0 decimals", () => {
      const result = calculateInterval(0, [1.5, 8.7]);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(40);
      expect(result.interval).toBeCloseTo(10);
    });

    it("handles high precision (3 decimals)", () => {
      const result = calculateInterval(3, [0.1234, 0.5678]);
      expect(result.min).toBeCloseTo(0.1);
      expect(result.max).toBeCloseTo(0.6);
      expect(result.interval).toBeCloseTo(0.1);
    });
  });

  describe("nice interval calculation", () => {
    it("produces a nice interval for typical pressure values", () => {
      const result = calculateInterval(2, [10.5, 15.2, 12.8, 14.1]);
      expect(result.min).toBeCloseTo(10);
      expect(result.max).toBeCloseTo(16);
      expect(result.interval).toBeCloseTo(1);
    });

    it("produces appropriate interval for large range", () => {
      const result = calculateInterval(0, [0, 100, 50, 75, 25]);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(25);
    });

    it("produces appropriate interval for small range", () => {
      const result = calculateInterval(2, [10.01, 10.02, 10.03, 10.04]);
      expect(result.min).toBeCloseTo(9.9);
      expect(result.max).toBeCloseTo(10.2);
      expect(result.interval).toBeCloseTo(0.1);
    });
  });

  describe("min/max boundaries", () => {
    it("includes all data points within min/max", () => {
      const values = [3.7, 8.2, 5.1, 6.9, 4.3];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(3);
      expect(result.max).toBeCloseTo(9);
      expect(result.interval).toBeCloseTo(1);
    });

    it("handles negative values", () => {
      const values = [-5.5, -2.3, 1.2, 4.8];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(-7.5);
      expect(result.max).toBeCloseTo(5);
      expect(result.interval).toBeCloseTo(2.5);
    });

    it("handles all negative values", () => {
      const values = [-10.5, -8.2, -5.1, -3.7];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(-12);
      expect(result.max).toBeCloseTo(-2);
      expect(result.interval).toBeCloseTo(2);
    });
  });

  describe("interval count", () => {
    it("produces roughly the target number of intervals", () => {
      const values = [0, 100];
      const result = calculateInterval(0, values, 5);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(25);
    });

    it("respects custom target interval count of 3", () => {
      const values = [0, 100];
      const result = calculateInterval(0, values, 3);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(50);
    });

    it("respects custom target interval count of 7", () => {
      const values = [0, 100];
      const result = calculateInterval(0, values, 7);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(20);
    });
  });

  describe("real-world scenarios", () => {
    it("handles flow values (typical range 0-50 L/s)", () => {
      const values = [5.2, 12.8, 8.4, 15.1, 3.7, 22.5];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(25);
      expect(result.interval).toBeCloseTo(5);
    });

    it("handles pressure values (typical range 20-80 psi)", () => {
      const values = [45.32, 52.18, 48.76, 51.03, 47.55];
      const result = calculateInterval(2, values);
      expect(result.min).toBeCloseTo(44);
      expect(result.max).toBeCloseTo(54);
      expect(result.interval).toBeCloseTo(2);
    });

    it("handles velocity values (small numbers)", () => {
      const values = [0.52, 0.78, 0.65, 0.91, 0.43];
      const result = calculateInterval(2, values);
      expect(result.min).toBeCloseTo(0.4);
      expect(result.max).toBeCloseTo(1.0);
      expect(result.interval).toBeCloseTo(0.1);
    });

    it("handles tank level values", () => {
      const values = [2.5, 3.8, 4.2, 3.1, 2.9, 4.5, 3.6];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(2);
      expect(result.max).toBeCloseTo(5);
      expect(result.interval).toBeCloseTo(1);
    });
  });

  describe("precision edge cases", () => {
    it("caps the zoom at a 0.1 interval for very small values", () => {
      const values = [0.001, 0.002, 0.003];
      const result = calculateInterval(3, values);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(0.4);
      expect(result.interval).toBeCloseTo(0.1);
    });

    it("handles very large values", () => {
      const values = [1000000, 2000000, 1500000];
      const result = calculateInterval(0, values);
      expect(result.min).toBeCloseTo(1000000);
      expect(result.max).toBeCloseTo(2000000);
      expect(result.interval).toBeCloseTo(250000);
    });

    it("handles mix of zero and positive values", () => {
      const values = [0, 0, 0, 5, 10];
      const result = calculateInterval(0, values);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(40);
      expect(result.interval).toBeCloseTo(10);
    });
  });
});

describe("legendItemsThatFit", () => {
  it("shows every item when they all fit", () => {
    expect(legendItemsThatFit([50, 50], 112, 60, 12)).toEqual(2);
  });

  it("keeps room for the trigger when some items do not fit", () => {
    expect(legendItemsThatFit([50, 50, 50], 140, 60, 12)).toEqual(1);
  });

  it("collapses every item when not even one fits beside the trigger", () => {
    expect(legendItemsThatFit([100, 50], 120, 60, 12)).toEqual(0);
  });
});
