import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { getDefaultStore } from "jotai";
import {
  buildVariableSpeedPump,
  NodeAsset,
  Pipe,
  Pump,
  VariableSpeedPumpControl,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import { highlightsAtom } from "src/state/highlights";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import {
  VariableSpeedPumpControlsEditor,
  VariableSpeedPumpTargets,
} from "./variable-speed-pump-controls-editor";

const IDS = { J1: 1, J2: 2, T1: 3, PU1: 4, PU2: 5, PU3: 6, P1: 7 } as const;

const aNode = (
  id: number,
  label: string,
  type: NodeAsset["type"],
  levels: { minLevel?: number; maxLevel?: number } = {},
) =>
  ({
    id,
    label,
    type,
    isNode: true,
    coordinates: [0, 0],
    feature: { properties: { type } },
    ...levels,
  }) as unknown as NodeAsset;

const aLink = <T,>(id: number, label: string, type: string) =>
  ({ id, label, type, isNode: false }) as unknown as T;

const TARGETS: VariableSpeedPumpTargets = {
  isValid: () => true,
  nodes: [
    aNode(IDS.J1, "J1", "junction"),
    aNode(IDS.J2, "J2", "junction"),
    aNode(IDS.T1, "T1", "tank", { minLevel: 1, maxLevel: 5 }),
  ],
  pipes: [aLink<Pipe>(IDS.P1, "P1", "pipe")],
  pumps: [
    aLink<Pump>(IDS.PU1, "PU1", "pump"),
    aLink<Pump>(IDS.PU2, "PU2", "pump"),
    aLink<Pump>(IDS.PU3, "PU3", "pump"),
  ],
  outletNodeId: IDS.J2,
  units: { pressure: "m", flow: "l/s", minLevel: "m" } as unknown as UnitsSpec,
};

const T1_LEVELS = { tankId: IDS.T1, offLevel: 5, onLevel: 1 };

const aPressureTarget = (changes: Partial<VariableSpeedPumpControl> = {}) =>
  buildVariableSpeedPump({
    linkId: IDS.PU1,
    quantity: "pressure",
    targetId: IDS.J2,
    target: 0,
    minSpeed: 0,
    maxSpeed: 1,
    laggedPumpIds: [],
    schedule: [],
    ...changes,
  });

const aLevelTarget = (changes: Partial<VariableSpeedPumpControl> = {}) =>
  aPressureTarget({ quantity: "level", targetId: IDS.T1, ...changes });

const aFlowTarget = (changes: Partial<VariableSpeedPumpControl> = {}) =>
  aPressureTarget({ quantity: "flow", targetId: IDS.PU1, ...changes });

const Harness = ({
  initialControl,
  targets,
  onChange,
}: {
  initialControl: VariableSpeedPumpControl;
  targets: VariableSpeedPumpTargets;
  onChange: (control: VariableSpeedPumpControl) => void;
}) => {
  const [control, setControl] = useState(initialControl);
  return (
    <VariableSpeedPumpControlsEditor
      control={control}
      targets={targets}
      onControlChange={(next) => {
        onChange(next);
        setControl(next);
      }}
    />
  );
};

const renderEditor = (
  initialControl: VariableSpeedPumpControl,
  targets = TARGETS,
) => {
  const onChange = vi.fn();
  render(
    <Harness
      initialControl={initialControl}
      targets={targets}
      onChange={onChange}
    />,
  );
  return onChange;
};

const lastControl = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.lastCall?.[0] as VariableSpeedPumpControl;

const combobox = (name: string) => screen.getByLabelText(name);
const checkbox = (name: string) => screen.getByLabelText(name);

const select = (comboboxName: string, option: string) => {
  fireEvent.click(combobox(comboboxName));
  fireEvent.click(screen.getByRole("option", { name: option }));
};

const clearSelection = (comboboxName: string, clearLabel: string) => {
  fireEvent.click(combobox(comboboxName));
  fireEvent.click(screen.getByRole("button", { name: clearLabel }));
};

const toggle = (checkboxName: string) =>
  fireEvent.click(checkbox(checkboxName));

const enterValue = (label: string, value: string) => {
  const input = screen.getByLabelText(`Value for: ${label}`);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
};

const pickLaggedPump = (currentLabel: string, pump: string) => {
  const cell = screen.getByRole("button", { name: currentLabel });
  fireEvent.mouseDown(cell);
  fireEvent.click(cell);
  fireEvent.click(screen.getByRole("option", { name: pump }));
};

const highlights = () => getDefaultStore().get(highlightsAtom);

const scheduleCell = (rowIndex: number, colIndex: number) =>
  within(screen.getAllByRole("row").slice(1)[rowIndex]).getAllByRole(
    "gridcell",
  )[colIndex];

const enterScheduleValue = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
  colIndex: number,
  value: string,
) => {
  const cell = scheduleCell(rowIndex, colIndex);
  await user.click(cell);
  await user.dblClick(cell);
  const input = within(cell).getByRole<HTMLInputElement>("textbox");
  await user.clear(input);
  await user.keyboard(`${value}{Enter}`);
};

const HOURLY_SCHEDULE = [
  { time: 0, target: 30 },
  { time: 3600, target: 30 },
  { time: 7200, target: 30 },
];

describe("VariableSpeedPumpControlsEditor", () => {
  beforeEach(() => {
    stubFeatureOff("FLAG_MODEL_VALIDATIONS");
  });

  describe("pressure target", () => {
    it("becomes a level target when a tank is chosen", () => {
      const onChange = renderEditor(aPressureTarget());
      expect(combobox("At node")).toHaveTextContent("J2 (outlet of this pump)");
      expect(screen.getByText("Pressure (m)")).toBeInTheDocument();

      select("At node", "T1 (tank)");

      expect(lastControl(onChange)).toMatchObject({
        quantity: "level",
        targetId: IDS.T1,
      });
      expect(screen.getByText("Level (m)")).toBeInTheDocument();
    });

    it("drops the tank levels when it returns to the outlet", () => {
      const onChange = renderEditor(aLevelTarget({ tankLevels: T1_LEVELS }));

      clearSelection("At node", "J2 (outlet of this pump)");

      expect(lastControl(onChange)).toMatchObject({
        quantity: "pressure",
        targetId: IDS.J2,
        tankLevels: undefined,
      });
      expect(
        screen.queryByRole("checkbox", { name: "Start/stop at tank level" }),
      ).not.toBeInTheDocument();
    });

    it("highlights the target node on hover", () => {
      renderEditor(aLevelTarget());

      fireEvent.mouseEnter(combobox("At node"));
      expect(highlights()).toEqual([
        { type: "marker", coordinates: [0, 0], nodeType: "tank" },
      ]);

      fireEvent.mouseLeave(combobox("At node"));
      expect(highlights()).toEqual([]);
    });
  });

  describe("flow target", () => {
    it("targets the flow through a pipe", () => {
      const onChange = renderEditor(aFlowTarget());
      expect(screen.getByText("Flow (l/s)")).toBeInTheDocument();

      select("Flow through", "P1");

      expect(lastControl(onChange)).toMatchObject({
        quantity: "flow",
        targetId: IDS.P1,
      });
    });

    it("returns to the flow through the pump itself", () => {
      const onChange = renderEditor(aFlowTarget({ targetId: IDS.P1 }));

      clearSelection("Flow through", "This pump");

      expect(lastControl(onChange)).toMatchObject({ targetId: IDS.PU1 });
    });

    it("highlights the target pipe on hover", () => {
      renderEditor(aFlowTarget({ targetId: IDS.P1 }));

      fireEvent.mouseEnter(combobox("Flow through"));

      expect(highlights()).toEqual([{ type: "asset", assetId: IDS.P1 }]);
    });
  });

  describe("tank levels", () => {
    it("starts and stops at the levels of the target tank", () => {
      const onChange = renderEditor(aLevelTarget());

      toggle("Start/stop at tank level");

      expect(lastControl(onChange).tankLevels).toEqual(T1_LEVELS);
      expect(
        screen.queryByRole("combobox", { name: "Tank" }),
      ).not.toBeInTheDocument();
    });

    it("keeps an on level above the off level out of the control", () => {
      const onChange = renderEditor(aLevelTarget({ tankLevels: T1_LEVELS }));

      enterValue("On below (m)", "6");
      expect(onChange).not.toHaveBeenCalled();
      expect(
        screen.getByText(/On level must be below the off level/),
      ).toBeInTheDocument();

      enterValue("On below (m)", "2");
      expect(lastControl(onChange).tankLevels).toEqual({
        ...T1_LEVELS,
        onLevel: 2,
      });
    });

    it("waits for a tank to be chosen on a flow target", () => {
      const onChange = renderEditor(aFlowTarget());

      toggle("Start/stop at tank level");
      expect(onChange).not.toHaveBeenCalled();
      expect(checkbox("Start/stop at tank level")).toBeChecked();
      expect(combobox("Tank")).toHaveTextContent("None");
      expect(
        screen.queryByRole("textbox", { name: "Value for: Off above (m)" }),
      ).not.toBeInTheDocument();

      select("Tank", "T1");
      expect(lastControl(onChange).tankLevels).toEqual(T1_LEVELS);
    });

    it("stays enabled when the tank is cleared", () => {
      const onChange = renderEditor(aFlowTarget({ tankLevels: T1_LEVELS }));

      clearSelection("Tank", "None");

      expect(lastControl(onChange).tankLevels).toBeUndefined();
      expect(checkbox("Start/stop at tank level")).toBeChecked();
    });
  });

  describe("schedule", () => {
    it("seeds the schedule from the target and clears it when disabled", () => {
      const onChange = renderEditor(aPressureTarget({ target: 3 }));

      toggle("Vary by time of day");
      expect(lastControl(onChange).schedule).toEqual([{ time: 0, target: 3 }]);
      expect(screen.getByPlaceholderText("Set by schedule")).toBeDisabled();

      toggle("Vary by time of day");
      expect(lastControl(onChange).schedule).toEqual([]);
    });
  });

  describe("lag pumps", () => {
    it("lags another pump", () => {
      const onChange = renderEditor(aPressureTarget());

      toggle("Lag pumps");
      expect(onChange).not.toHaveBeenCalled();
      expect(checkbox("Lag pumps")).toBeChecked();

      pickLaggedPump("None", "PU2");
      expect(lastControl(onChange).laggedPumpIds).toEqual([IDS.PU2]);
    });

    it("is unavailable without other pumps", () => {
      renderEditor(aPressureTarget(), {
        ...TARGETS,
        pumps: [aLink<Pump>(IDS.PU1, "PU1", "pump")],
      });

      expect(checkbox("Lag pumps")).toBeDisabled();
    });
  });

  describe("speed range", () => {
    it("warns when the min speed exceeds the max speed", () => {
      const onChange = renderEditor(aPressureTarget());

      enterValue("Min speed", "1.2");

      expect(lastControl(onChange).minSpeed).toBe(1.2);
      expect(
        screen.getByText("Min speed must not be above max speed."),
      ).toBeInTheDocument();
    });

    it("keeps an out-of-order schedule time out of the control", async () => {
      const user = userEvent.setup();
      const onChange = renderEditor(
        aPressureTarget({ schedule: HOURLY_SCHEDULE }),
      );

      await enterScheduleValue(user, 1, 0, "3:00");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps a pressure target of zero out of the control", () => {
      const onChange = renderEditor(aPressureTarget({ target: 30 }));

      enterValue("Pressure (m)", "0");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("keeps a negative min speed and a zero max speed out of the control", () => {
      const onChange = renderEditor(aPressureTarget());

      enterValue("Min speed", "-1");
      enterValue("Max speed", "0");

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("with FLAG_MODEL_VALIDATIONS on", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_MODEL_VALIDATIONS");
    });

    it("keeps a negative min speed in the control and marks the field", () => {
      const onChange = renderEditor(aPressureTarget());

      enterValue("Min speed", "-1");

      expect(lastControl(onChange).minSpeed).toBe(-1);
      expect(screen.getByLabelText("Value for: Min speed")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });

    it("keeps a pressure target of zero in the control and marks the field", () => {
      const onChange = renderEditor(aPressureTarget({ target: 30 }));

      enterValue("Pressure (m)", "0");

      expect(lastControl(onChange).target).toBe(0);
      expect(screen.getByLabelText("Value for: Pressure (m)")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });

    it("keeps an out-of-order schedule time in the control and marks the cells", async () => {
      const user = userEvent.setup();
      const onChange = renderEditor(
        aPressureTarget({ schedule: HOURLY_SCHEDULE }),
      );

      await enterScheduleValue(user, 1, 0, "3:00");

      expect(lastControl(onChange).schedule.map(({ time }) => time)).toEqual([
        0, 10800, 7200,
      ]);
      expect(scheduleCell(1, 0)).toHaveClass("bg-warning-subtle");
    });

    it("keeps a pressure schedule target of zero in the control and marks the cell", async () => {
      const user = userEvent.setup();
      const onChange = renderEditor(
        aPressureTarget({ schedule: HOURLY_SCHEDULE }),
      );

      await enterScheduleValue(user, 1, 1, "0");

      expect(lastControl(onChange).schedule[1]).toEqual({
        time: 3600,
        target: 0,
      });
      expect(scheduleCell(1, 1)).toHaveClass("bg-warning-subtle");
    });

    it("keeps a zero max speed in the control", () => {
      const onChange = renderEditor(aPressureTarget());

      enterValue("Max speed", "0");

      expect(lastControl(onChange).maxSpeed).toBe(0);
    });

    it("keeps an on level above the off level in the control and warns", () => {
      const onChange = renderEditor(aLevelTarget({ tankLevels: T1_LEVELS }));

      enterValue("On below (m)", "6");

      expect(lastControl(onChange).tankLevels).toEqual({
        ...T1_LEVELS,
        onLevel: 6,
      });
      expect(
        screen.getByText(/On level must be below the off level/),
      ).toBeInTheDocument();
    });
  });
});
