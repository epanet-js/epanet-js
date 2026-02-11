import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { Store, stagingModelAtom } from "src/state/jotai";
import { PumpCurvesDialog } from "./pump-curves-dialog";

const renderDialog = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <PumpCurvesDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

// Skip pointer events check because the spreadsheet table uses pointer-events: none on inactive cells
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const getCurveCell = (rowIndex: number, colIndex: number) => {
  const gridCells = screen.getAllByRole("gridcell");
  // Columns per row: flow (0), head (1), actions (2)
  return gridCells[rowIndex * 3 + colIndex];
};

const editCell = async (
  user: ReturnType<typeof setupUser>,
  rowIndex: number,
  colIndex: number,
  value: string,
) => {
  const cell = getCurveCell(rowIndex, colIndex);
  await user.dblClick(cell);
  await waitFor(() => {
    expect(within(cell).getByRole("textbox")).not.toHaveAttribute("readonly");
  });
  const input = within(cell).getByRole("textbox");
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
};

describe("PumpCurvesDialog — trailing empty rows", () => {
  beforeEach(() => {
    stubUserTracking();
  });

  it("does not show a warning when a valid point is followed by trailing (0,0) rows", async () => {
    const user = setupUser();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aPumpCurve({
          id: 1,
          label: "Curve1",
          points: [{ x: 0, y: 0 }],
        })
        .build(),
    });

    renderDialog(store);

    // Select the curve
    await user.click(screen.getByRole("button", { name: "Curve1" }));

    // Enter a valid design point
    await editCell(user, 0, 0, "5");
    await editCell(user, 0, 1, "10");

    // The auto-added trailing row is (0,0) — no warning should appear
    await waitFor(() => {
      expect(screen.queryByText(/invalid curve/i)).not.toBeInTheDocument();
    });
  });

  it("shows a warning when all points are (0,0)", async () => {
    const user = setupUser();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aPumpCurve({
          id: 1,
          label: "Curve1",
          points: [{ x: 1, y: 1 }],
        })
        .build(),
    });

    renderDialog(store);

    // Select the curve
    await user.click(screen.getByRole("button", { name: "Curve1" }));

    // Set the only meaningful point to (0,0)
    await editCell(user, 0, 0, "0");
    await editCell(user, 0, 1, "0");

    await waitFor(() => {
      expect(screen.getByText(/invalid curve/i)).toBeInTheDocument();
    });
  });

  it("shows a warning for genuinely invalid ordering, not trailing empties", async () => {
    const user = setupUser();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aPumpCurve({
          id: 1,
          label: "Curve1",
          points: [
            { x: 5, y: 10 },
            { x: 10, y: 5 },
          ],
        })
        .build(),
    });

    renderDialog(store);

    // Select the curve
    await user.click(screen.getByRole("button", { name: "Curve1" }));

    // Make the ordering invalid: set row 1 flow lower than row 0
    await editCell(user, 1, 0, "3");

    await waitFor(() => {
      expect(screen.getByText(/invalid curve/i)).toBeInTheDocument();
    });
  });

  it("strips trailing empty rows when saving", async () => {
    const user = setupUser();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aPumpCurve({
          id: 1,
          label: "Curve1",
          points: [{ x: 1, y: 1 }],
        })
        .build(),
    });

    renderDialog(store);

    // Select the curve
    await user.click(screen.getByRole("button", { name: "Curve1" }));

    // Edit to a valid point, which will auto-add a trailing (0,0)
    await editCell(user, 0, 0, "5");
    await editCell(user, 0, 1, "10");

    // Save
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: /save/i }));

    // Verify the saved curve has no trailing (0,0) points
    const hydraulicModel = store.get(stagingModelAtom);
    const savedCurve = hydraulicModel.curves.get(1);
    expect(savedCurve?.points).toEqual([{ x: 5, y: 10 }]);
  });

  it("saves only meaningful points for a multi-point curve with trailing empties", async () => {
    const user = setupUser();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aPumpCurve({
          id: 1,
          label: "Curve1",
          points: [{ x: 1, y: 1 }],
        })
        .build(),
    });

    renderDialog(store);

    // Select the curve
    await user.click(screen.getByRole("button", { name: "Curve1" }));

    // Build a valid 3-point standard curve
    await editCell(user, 0, 0, "0");
    await editCell(user, 0, 1, "20");
    await editCell(user, 1, 0, "10");
    await editCell(user, 1, 1, "15");
    await editCell(user, 2, 0, "20");
    await editCell(user, 2, 1, "5");

    // No warning should be showing (trailing auto-added row ignored)
    await waitFor(() => {
      expect(screen.queryByText(/invalid curve/i)).not.toBeInTheDocument();
    });

    // Save
    await user.click(screen.getByRole("button", { name: /save/i }));

    // Verify only the 3 meaningful points are saved
    const hydraulicModel = store.get(stagingModelAtom);
    const savedCurve = hydraulicModel.curves.get(1);
    expect(savedCurve?.points).toEqual([
      { x: 0, y: 20 },
      { x: 10, y: 15 },
      { x: 20, y: 5 },
    ]);
  });
});
