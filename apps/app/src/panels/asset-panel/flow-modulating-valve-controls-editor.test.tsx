import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { EChartsOption } from "echarts";
import {
  FlowModulatingValveControl,
  LinkAsset,
  NodeAsset,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import {
  buildCurveChartOption,
  FlowModulatingValveTargets,
  ValveControlsEditor,
} from "./flow-modulating-valve-controls-editor";

vi.mock("echarts-for-react", () => ({
  default: ({ option }: { option: EChartsOption }) => (
    <div data-testid="curve-chart" data-option={JSON.stringify(option)} />
  ),
}));

const IDS = { V1: 1, J1: 2, J2: 3, J3: 4, P1: 5, PU1: 6 } as const;
const SETTING = 25;

const aNode = (id: number, label: string) =>
  ({
    id,
    label,
    type: "junction",
    isNode: true,
    isActive: true,
    coordinates: [0, 0],
    feature: { properties: { type: "junction" } },
  }) as unknown as NodeAsset;

const aLink = (id: number, label: string, type: string) =>
  ({ id, label, type, isNode: false, isActive: true }) as unknown as LinkAsset;

const TARGETS: FlowModulatingValveTargets = {
  nodes: [aNode(IDS.J1, "J1"), aNode(IDS.J2, "J2"), aNode(IDS.J3, "J3")],
  links: [
    aLink(IDS.V1, "V1", "valve"),
    aLink(IDS.P1, "P1", "pipe"),
    aLink(IDS.PU1, "PU1", "pump"),
  ],
  outletNodeId: IDS.J2,
  units: { pressure: "m", flow: "l/s" } as unknown as UnitsSpec,
};

const Harness = ({
  initialControl = null,
  onChange,
}: {
  initialControl?: FlowModulatingValveControl | null;
  onChange: (control: FlowModulatingValveControl | null) => void;
}) => {
  const [control, setControl] = useState(initialControl);
  return (
    <ValveControlsEditor
      valveId={IDS.V1}
      setting={SETTING}
      control={control}
      targets={TARGETS}
      onControlChange={(next) => {
        onChange(next);
        setControl(next);
      }}
    />
  );
};

const renderFlowModulated = async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  await selectOption(user, "Type", "Flow modulated");
  return { user, onChange, lastControl: () => lastControlOf(onChange) };
};

describe("valve controls editor", () => {
  it("creates the control with its defaults and removes it", async () => {
    const { user, onChange } = await renderFlowModulated();

    expect(onChange).toHaveBeenLastCalledWith({
      id: expect.any(String),
      type: "flow-modulating-valve",
      linkId: IDS.V1,
      points: [
        { flow: 0, pressure: SETTING },
        { flow: 1, pressure: SETTING + 1 },
      ],
      interpolate: true,
      sensorLinkId: IDS.V1,
      controlNodeId: IDS.J2,
    });

    await selectOption(user, "Type", "None");

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("adds a point past the last flow, edits it and deletes it", async () => {
    const { user, lastControl } = await renderFlowModulated();

    await user.click(screen.getByRole("button", { name: /add point/i }));
    expect(lastControl().points).toEqual([
      { flow: 0, pressure: SETTING },
      { flow: 1, pressure: SETTING + 1 },
      { flow: 2, pressure: SETTING + 1 },
    ]);

    await editCell(user, 2, 0, "4");
    await editCell(user, 2, 1, "30");
    await user.click(screen.getByRole("button", { name: /add point/i }));
    expect(lastControl().points).toEqual([
      { flow: 0, pressure: SETTING },
      { flow: 1, pressure: SETTING + 1 },
      { flow: 4, pressure: 30 },
      { flow: 7, pressure: 30 },
    ]);

    await openRowActions(user, 2);
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(lastControl().points).toEqual([
      { flow: 0, pressure: SETTING },
      { flow: 1, pressure: SETTING + 1 },
      { flow: 7, pressure: 30 },
    ]);
  });

  it("keeps an out-of-sequence value and flags the cell until the table is fixed", async () => {
    const { user, lastControl } = await renderFlowModulated();

    await editCell(user, 0, 1, "30");
    expect(lastControl().points.map((p) => p.pressure)).toEqual([
      30,
      SETTING + 1,
    ]);
    expect(getCell(0, 1)).toHaveClass("bg-warning-subtle");
    expect(getCell(1, 1)).toHaveClass("bg-warning-subtle");

    await editCell(user, 1, 1, "40");
    expect(lastControl().points.map((p) => p.pressure)).toEqual([30, 40]);
    expect(getCell(0, 1)).not.toHaveClass("bg-warning-subtle");
    expect(getCell(1, 1)).not.toHaveClass("bg-warning-subtle");
  });

  it("inserts a row below halfway to the next flow", async () => {
    const { user, lastControl } = await renderFlowModulated();
    await editCell(user, 1, 0, "6");

    await openRowActions(user, 0);
    await user.click(
      screen.getByRole("menuitem", { name: /insert row below/i }),
    );

    expect(lastControl().points.map((p) => p.flow)).toEqual([0, 3, 6]);
  });

  it("reads the flow from another link and returns to the valve", async () => {
    const { user, lastControl } = await renderFlowModulated();

    await selectOption(user, "Flow through", "PU1");
    expect(lastControl().sensorLinkId).toBe(IDS.PU1);

    await clearSelector(user, "Flow through", "This valve");
    expect(lastControl().sensorLinkId).toBe(IDS.V1);
  });

  it("holds a remote node and returns to the outlet", async () => {
    const { user, lastControl } = await renderFlowModulated();

    await selectOption(user, "Control node", "J3");
    expect(lastControl().controlNodeId).toBe(IDS.J3);

    await clearSelector(user, "Control node", "J2 (outlet of this valve)");
    expect(lastControl().controlNodeId).toBe(IDS.J2);
  });

  it("draws a step curve when linear interpolation is off", async () => {
    const { user, lastControl } = await renderFlowModulated();
    expect(chartSeries().step).toBe(false);

    await user.click(
      screen.getByRole("checkbox", { name: "Linear interpolation" }),
    );

    expect(lastControl().interpolate).toBe(false);
    expect(chartSeries().step).toBe("end");
  });
});

describe("buildCurveChartOption", () => {
  it("extends the first and last pressures flat to the chart edges", () => {
    const option = buildCurveChartOption(
      [
        { flow: 7, pressure: 30 },
        { flow: 3, pressure: 20 },
      ],
      true,
      { flowLabel: "Flow", pressureLabel: "Pressure" },
    );
    const [series] = option.series as { data: unknown[] }[];

    expect(series.data).toEqual([
      { value: [0, 20], symbol: "none" },
      [3, 20],
      [7, 30],
      { value: [7.8, 30], symbol: "none" },
    ]);
    expect(option.xAxis).toMatchObject({ min: 0, max: 7.8, name: "Flow" });
  });
});

const lastControlOf = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.lastCall![0] as FlowModulatingValveControl;

const chartSeries = () => {
  const option = JSON.parse(
    screen.getByTestId("curve-chart").getAttribute("data-option")!,
  ) as { series: { step: false | string }[] };
  return option.series[0];
};

const selectOption = async (
  user: ReturnType<typeof userEvent.setup>,
  combobox: string,
  option: string,
) => {
  await user.click(screen.getByRole("combobox", { name: combobox }));
  await user.click(await screen.findByRole("option", { name: option }));
};

const clearSelector = async (
  user: ReturnType<typeof userEvent.setup>,
  combobox: string,
  clearLabel: string,
) => {
  await user.click(screen.getByRole("combobox", { name: combobox }));
  await user.click(await screen.findByRole("button", { name: clearLabel }));
};

const getRows = () => screen.getAllByRole("row").slice(1);

const getCell = (rowIndex: number, colIndex: number) =>
  within(getRows()[rowIndex]).getAllByRole("gridcell")[colIndex];

const editCell = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
  colIndex: number,
  value: string,
) => {
  const cell = getCell(rowIndex, colIndex);
  await user.click(cell);
  await user.dblClick(cell);
  const input = within(cell).getByRole<HTMLInputElement>("textbox");
  await user.clear(input);
  await user.keyboard(`${value}{Enter}`);
};

const openRowActions = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
) => {
  const buttons = screen.getAllByRole("button", { name: /actions/i });
  await user.click(buttons[rowIndex]);
};
