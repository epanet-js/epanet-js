import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PumpStatus } from "@epanet-js/hydraulic-model";
import { PumpControlsEditor } from "./pump-controls-editor";

const renderEditor = (initialStatus: PumpStatus = "on") =>
  render(<PumpControlsEditor initialStatus={initialStatus} />);

const selectTimeBased = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("combobox", { name: "Type" }));
  await user.click(await screen.findByRole("option", { name: "Time-based" }));
};

const getRows = () => screen.getAllByRole("row").slice(1); // skip header

const getCell = (rowIndex: number, colIndex: number) => {
  const cells = within(getRows()[rowIndex]).getAllByRole("gridcell");
  return cells[colIndex];
};

const getTimeText = (rowIndex: number) => getCell(rowIndex, 0).textContent;
const getTimeInputValue = (rowIndex: number) =>
  within(getCell(rowIndex, 0)).getByRole<HTMLInputElement>("textbox").value;
const getStatusCell = (rowIndex: number) => getCell(rowIndex, 1);

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

  it("shows a read-only first row at 0:00 with the pump initial status when time-based", async () => {
    const user = userEvent.setup();
    renderEditor("on");

    await selectTimeBased(user);

    expect(getRows()).toHaveLength(1);
    expect(getTimeText(0)).toContain("0:00");
    expect(getStatusCell(0)).toHaveTextContent("On");
    // Read-only first row renders plain text, not an editable input.
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

  it("inserts a row below incrementing the time by one hour, keeping the status", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);
    await user.click(getAddTimeStepButton()); // row 1: 1:00, Off

    await openRowActions(user, 1);
    await user.click(
      screen.getByRole("menuitem", { name: /insert row below/i }),
    );

    expect(getRows()).toHaveLength(3);
    expect(getTimeInputValue(2)).toBe("2:00");
    expect(getStatusCell(2)).toHaveTextContent("Off");
  });

  it("inserts a row above copying the source row time and status", async () => {
    const user = userEvent.setup();
    renderEditor("on");
    await selectTimeBased(user);
    await user.click(getAddTimeStepButton()); // row 1: 1:00, Off

    await openRowActions(user, 1);
    await user.click(
      screen.getByRole("menuitem", { name: /insert row above/i }),
    );

    expect(getRows()).toHaveLength(3);
    expect(getTimeInputValue(1)).toBe("1:00");
    expect(getTimeInputValue(2)).toBe("1:00");
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
});
