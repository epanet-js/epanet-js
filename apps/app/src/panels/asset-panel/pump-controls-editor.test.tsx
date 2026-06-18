import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PumpStatus, TimedSettingStep } from "@epanet-js/hydraulic-model";
import { PumpControlsEditor } from "./pump-controls-editor";

const INITIAL_SPEED = 1.5;

const Harness = ({
  initialStatus = "on",
  initialSpeed = INITIAL_SPEED,
  onChange,
}: {
  initialStatus?: PumpStatus;
  initialSpeed?: number;
  onChange?: (steps: TimedSettingStep[] | null) => void;
}) => {
  const [steps, setSteps] = useState<TimedSettingStep[] | null>(null);
  return (
    <PumpControlsEditor
      initialStatus={initialStatus}
      initialSpeed={initialSpeed}
      steps={steps}
      onStepsChange={(next) => {
        onChange?.(next);
        setSteps(next);
      }}
    />
  );
};

const renderEditor = (
  initialStatus: PumpStatus = "on",
  onChange?: (steps: TimedSettingStep[] | null) => void,
) => render(<Harness initialStatus={initialStatus} onChange={onChange} />);

const selectTimeBased = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("combobox", { name: "Type" }));
  await user.click(await screen.findByRole("option", { name: "Time-based" }));
};

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

  it("enables time-based with no extra steps when selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor("on", onChange);

    await selectTimeBased(user);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("persists an added step with its status and the initial speed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor("on", onChange);
    await selectTimeBased(user);

    await user.click(getAddTimeStepButton());

    expect(onChange).toHaveBeenLastCalledWith([
      { time: 3600, status: "off", setting: INITIAL_SPEED },
    ]);
  });

  it("clears the controls when switching back to None", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderEditor("on", onChange);
    await selectTimeBased(user);
    onChange.mockClear();

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "None" }));

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

    it("defaults an added step's speed to the initial speed", async () => {
      const user = userEvent.setup();
      renderEditor("on");
      await selectTimeBased(user);

      await user.click(getAddTimeStepButton());

      expect(getSpeedCell(1)).toHaveTextContent("1.5");
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

      expect(onChange).toHaveBeenLastCalledWith([
        { time: 3600, status: "on", setting: 2 },
      ]);
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

      expect(input.parentElement).toHaveClass("bg-orange-100");

      await user.click(getCell(0, 0));

      expect(getTimeInputValue(1)).toBe("1:00");
    });

    it("warns and reverts a time smaller than the previous row on blur", async () => {
      const user = userEvent.setup();
      await withTwoSteps(user);

      const input = await startEditingTime(user, 2);
      await user.keyboard("0:30");

      expect(input.parentElement).toHaveClass("bg-orange-100");

      await user.click(getCell(0, 0));

      expect(getTimeInputValue(2)).toBe("2:00");
    });

    it("persists a valid in-sequence time", async () => {
      const user = userEvent.setup();
      await withTwoSteps(user);

      const input = await startEditingTime(user, 1);
      await user.keyboard("1:30{Enter}");

      expect(input.parentElement).not.toHaveClass("bg-orange-100");
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
