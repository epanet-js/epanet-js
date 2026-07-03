import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Control, PumpStatus, Tank } from "@epanet-js/hydraulic-model";
import {
  resolvePermissions,
  type Permissions,
} from "src/hooks/use-permissions";
import { PumpControlsEditor } from "./pump-controls-editor";

const entitledPermissions = resolvePermissions("pro", false, false, false);
const permissionsRef: { current: Permissions } = {
  current: entitledPermissions,
};
const showPriorityAccessMock = vi.fn();

vi.mock("src/hooks/use-permissions", async () => {
  const actual = await vi.importActual<
    typeof import("src/hooks/use-permissions")
  >("src/hooks/use-permissions");
  return {
    ...actual,
    usePermissions: () => permissionsRef.current,
  };
});

vi.mock("src/hooks/use-priority-access", () => ({
  useShowPriorityAccessDialog: () => showPriorityAccessMock,
}));

beforeEach(() => {
  permissionsRef.current = entitledPermissions;
  showPriorityAccessMock.mockClear();
});

const INITIAL_SPEED = 1.5;
const PUMP_ID = 3;

const makeTank = (
  id: number,
  label: string,
  minLevel: number,
  maxLevel: number,
): Tank => ({ id, label, type: "tank", minLevel, maxLevel }) as unknown as Tank;

const DEFAULT_TANKS = [
  makeTank(10, "Tank 1", 2, 9),
  makeTank(11, "Tank 2", 1, 5),
];

const Harness = ({
  initialStatus = "on",
  initialSpeed = INITIAL_SPEED,
  tanks = DEFAULT_TANKS,
  initialControl = null,
  onChange,
}: {
  initialStatus?: PumpStatus;
  initialSpeed?: number;
  tanks?: Tank[];
  initialControl?: Control | null;
  onChange?: (control: Control | null) => void;
}) => {
  const [control, setControl] = useState<Control | null>(initialControl);
  return (
    <PumpControlsEditor
      linkId={PUMP_ID}
      initialStatus={initialStatus}
      initialSpeed={initialSpeed}
      control={control}
      tanks={tanks}
      onControlChange={(next) => {
        onChange?.(next);
        setControl(next);
      }}
    />
  );
};

const renderEditor = (
  initialStatus: PumpStatus = "on",
  onChange?: (control: Control | null) => void,
  tanks: Tank[] = DEFAULT_TANKS,
) =>
  render(
    <Harness initialStatus={initialStatus} onChange={onChange} tanks={tanks} />,
  );

const selectType = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(screen.getByRole("combobox", { name: "Type" }));
  await user.click(await screen.findByRole("option", { name }));
};

const selectTimeBased = (user: ReturnType<typeof userEvent.setup>) =>
  selectType(user, "Time-based");

const getRows = () => screen.getAllByRole("row").slice(1);

const getCell = (rowIndex: number, colIndex: number) => {
  const cells = within(getRows()[rowIndex]).getAllByRole("gridcell");
  return cells[colIndex];
};

const getTimeText = (rowIndex: number) => getCell(rowIndex, 0).textContent;
const getTimeInputValue = (rowIndex: number) =>
  within(getCell(rowIndex, 0)).getByRole<HTMLInputElement>("textbox").value;
const getStatusCell = (rowIndex: number) => getCell(rowIndex, 1);
const getSpeedCell = (rowIndex: number) => getCell(rowIndex, 2);

const startEditingTime = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
) => {
  const cell = getCell(rowIndex, 0);
  await user.click(cell);
  await user.dblClick(cell);
  const input = within(cell).getByRole<HTMLInputElement>("textbox");
  await user.clear(input);
  return input;
};

const getAddTimeStepButton = () =>
  screen.getByRole("button", { name: /add time step/i });

const openRowActions = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
) => {
  const buttons = screen.getAllByRole("button", { name: /actions/i });
  await user.click(buttons[rowIndex]);
};

describe("PumpControlsEditor", () => {
  it("lists the control types with level-based before time-based", async () => {
    const user = userEvent.setup();
    renderEditor("on");

    await user.click(screen.getByRole("combobox", { name: "Type" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "None",
      "Level-based",
      "Time-based",
    ]);
  });

  it("defaults to type None with no controls table", () => {
    renderEditor("on");

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent(
      "None",
    );
    expect(
      screen.queryByRole("button", { name: /add time step/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  describe("priority access", () => {
    beforeEach(() => {
      permissionsRef.current = resolvePermissions("free", false, false, false);
    });

    it("blocks selecting time-based and does not change the control", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("on", onChange);

      await selectTimeBased(user);

      expect(showPriorityAccessMock).toHaveBeenCalledWith({
        featureName: "native controls",
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("blocks selecting level-based and does not change the control", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("on", onChange);

      await selectType(user, "Level-based");

      expect(showPriorityAccessMock).toHaveBeenCalledWith({
        featureName: "native controls",
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("still allows clearing an existing control to None", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Harness
          initialControl={{
            id: "ctrl-1",
            type: "timed-setting",
            linkId: PUMP_ID,
            steps: [],
          }}
          onChange={onChange}
        />,
      );

      await selectType(user, "None");

      expect(showPriorityAccessMock).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe("level-based", () => {
    it("disables the level-based option when there are no tanks", async () => {
      const user = userEvent.setup();
      renderEditor("on", undefined, []);

      await user.click(screen.getByRole("combobox", { name: "Type" }));

      expect(
        await screen.findByRole("option", { name: "Level-based" }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("builds a default control from the first tank when selected", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("on", onChange);

      await selectType(user, "Level-based");

      expect(onChange).toHaveBeenCalledWith({
        id: expect.any(String),
        type: "level-setting",
        linkId: PUMP_ID,
        tankId: 10,
        on: { level: 2, setting: INITIAL_SPEED },
        off: { level: 9 },
      });
    });

    it("shows On/Off rows with the tank levels and on-speed", async () => {
      const user = userEvent.setup();
      renderEditor("on");

      await selectType(user, "Level-based");

      expect(screen.getByRole("combobox", { name: "Tank" })).toHaveTextContent(
        "Tank 1",
      );
      const cells = screen.getAllByRole("cell");
      expect(cells.some((c) => c.textContent === "On")).toBe(true);
      expect(cells.some((c) => c.textContent === "Off")).toBe(true);
    });

    it("updates the levels when a different tank is selected", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("on", onChange);
      await selectType(user, "Level-based");
      onChange.mockClear();

      await user.click(screen.getByRole("combobox", { name: "Tank" }));
      await user.click(await screen.findByRole("option", { name: "Tank 2" }));

      expect(onChange).toHaveBeenCalledWith({
        id: expect.any(String),
        type: "level-setting",
        linkId: PUMP_ID,
        tankId: 11,
        on: { level: 1, setting: INITIAL_SPEED },
        off: { level: 5 },
      });
    });

    it("clears the control when switching back to None", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("on", onChange);
      await selectType(user, "Level-based");
      onChange.mockClear();

      await selectType(user, "None");

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  it("enables time-based with no extra steps when selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor("on", onChange);

    await selectTimeBased(user);

    expect(onChange).toHaveBeenCalledWith({
      id: expect.any(String),
      type: "timed-setting",
      linkId: PUMP_ID,
      steps: [],
    });
  });

  it("persists an added off step with a speed of 0", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor("on", onChange);
    await selectTimeBased(user);

    await user.click(getAddTimeStepButton());

    expect(onChange).toHaveBeenLastCalledWith({
      id: expect.any(String),
      type: "timed-setting",
      linkId: PUMP_ID,
      steps: [{ time: 3600, status: "off", setting: 0 }],
    });
  });

  it("clears the controls when switching back to None", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor("on", onChange);
    await selectTimeBased(user);
    onChange.mockClear();

    await selectType(user, "None");

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows a read-only first row at 0:00 with the pump initial status when time-based", async () => {
    const user = userEvent.setup();
    renderEditor("on");

    await selectTimeBased(user);

    expect(getRows()).toHaveLength(1);
    expect(getTimeText(0)).toContain("0:00");
    expect(getStatusCell(0)).toHaveTextContent("On");
    expect(
      within(getCell(0, 0)).queryByRole("textbox"),
    ).not.toBeInTheDocument();
  });

  it("derives the first row status from the initial status (source of truth)", async () => {
    const user = userEvent.setup();
    renderEditor("off");

    await selectTimeBased(user);

    expect(getStatusCell(0)).toHaveTextContent("Off");
  });

  describe("speed column", () => {
    it("shows the initial speed in the read-only first row", async () => {
      const user = userEvent.setup();
      renderEditor("on");

      await selectTimeBased(user);

      expect(getSpeedCell(0)).toHaveTextContent("1.5");
      expect(
        within(getSpeedCell(0)).queryByRole("textbox"),
      ).not.toBeInTheDocument();
    });

    it("defaults an added off step's speed to 0", async () => {
      const user = userEvent.setup();
      renderEditor("on");
      await selectTimeBased(user);

      await user.click(getAddTimeStepButton());

      expect(getSpeedCell(1)).toHaveTextContent("0");
    });

    it("defaults an added on step's speed to the initial speed", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("off", onChange);
      await selectTimeBased(user);

      await user.click(getAddTimeStepButton());

      expect(onChange).toHaveBeenLastCalledWith({
        id: expect.any(String),
        type: "timed-setting",
        linkId: PUMP_ID,
        steps: [{ time: 3600, status: "on", setting: INITIAL_SPEED }],
      });
    });

    it("keeps speed read-only while the step status is off", async () => {
      const user = userEvent.setup();
      renderEditor("on");
      await selectTimeBased(user);
      await user.click(getAddTimeStepButton());

      const cell = getSpeedCell(1);
      await user.dblClick(cell);

      expect(within(cell).queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("allows editing speed when the step status is on", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      renderEditor("off", onChange);
      await selectTimeBased(user);
      await user.click(getAddTimeStepButton());
      onChange.mockClear();

      const cell = getSpeedCell(1);
      await user.dblClick(cell);
      const input = within(cell).getByRole<HTMLInputElement>("textbox");
      await user.clear(input);
      await user.keyboard("2{Enter}");

      expect(onChange).toHaveBeenLastCalledWith({
        id: expect.any(String),
        type: "timed-setting",
        linkId: PUMP_ID,
        steps: [{ time: 3600, status: "on", setting: 2 }],
      });
    });
  });

  it("adds a time step one hour after the last, with the opposite status", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);

    await user.click(getAddTimeStepButton());

    expect(getRows()).toHaveLength(2);
    expect(getTimeInputValue(1)).toBe("1:00");
    expect(getStatusCell(1)).toHaveTextContent("Off");

    await user.click(getAddTimeStepButton());

    expect(getRows()).toHaveLength(3);
    expect(getTimeInputValue(2)).toBe("2:00");
    expect(getStatusCell(2)).toHaveTextContent("On");
  });

  it("deletes an added step", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);
    await user.click(getAddTimeStepButton());
    expect(getRows()).toHaveLength(2);

    await openRowActions(user, 1);
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    expect(getRows()).toHaveLength(1);
  });

  it("inserts a row below incrementing the time by one hour, inverting the status", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);
    await user.click(getAddTimeStepButton());

    await openRowActions(user, 1);
    await user.click(
      screen.getByRole("menuitem", { name: /insert row below/i }),
    );

    expect(getRows()).toHaveLength(3);
    expect(getTimeInputValue(2)).toBe("2:00");
    expect(getStatusCell(1)).toHaveTextContent("Off");
    expect(getStatusCell(2)).toHaveTextContent("On");
  });

  it("inserts a row above copying the source row time and status", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);
    await user.click(getAddTimeStepButton());

    await openRowActions(user, 1);
    await user.click(
      screen.getByRole("menuitem", { name: /insert row above/i }),
    );

    expect(getRows()).toHaveLength(3);
    expect(getTimeInputValue(1)).toBe("1:00");
    expect(getTimeInputValue(2)).toBe("1:00");
    expect(getStatusCell(1)).toHaveTextContent("Off");
    expect(getStatusCell(2)).toHaveTextContent("Off");
  });

  it("does not offer delete or insert-above on the read-only first row", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);

    await openRowActions(user, 0);

    expect(
      screen.getByRole("menuitem", { name: /insert row below/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /delete/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /insert row above/i }),
    ).not.toBeInTheDocument();
  });

  describe("time sequence validation", () => {
    const withTwoSteps = async (user: ReturnType<typeof userEvent.setup>) => {
      renderEditor("on");
      await selectTimeBased(user);
      await user.click(getAddTimeStepButton());
      await user.click(getAddTimeStepButton());
    };

    it("warns and reverts a time greater than the next row on blur", async () => {
      const user = userEvent.setup();
      await withTwoSteps(user);

      const input = await startEditingTime(user, 1);
      await user.keyboard("3:00");

      expect(input.parentElement).toHaveClass("bg-warning-subtle");

      await user.click(getCell(0, 0));

      expect(getTimeInputValue(1)).toBe("1:00");
    });

    it("warns and reverts a time smaller than the previous row on blur", async () => {
      const user = userEvent.setup();
      await withTwoSteps(user);

      const input = await startEditingTime(user, 2);
      await user.keyboard("0:30");

      expect(input.parentElement).toHaveClass("bg-warning-subtle");

      await user.click(getCell(0, 0));

      expect(getTimeInputValue(2)).toBe("2:00");
    });

    it("persists a valid in-sequence time", async () => {
      const user = userEvent.setup();
      await withTwoSteps(user);

      const input = await startEditingTime(user, 1);
      await user.keyboard("1:30{Enter}");

      expect(input.parentElement).not.toHaveClass("bg-warning-subtle");
      expect(getTimeInputValue(1)).toBe("1:30");
    });

    it("allows a repeated time equal to a neighbor", async () => {
      const user = userEvent.setup();
      await withTwoSteps(user);

      await startEditingTime(user, 1);
      await user.keyboard("2:00{Enter}");

      expect(getRows()).toHaveLength(3);
      expect(getTimeInputValue(1)).toBe("2:00");
    });
  });
});
