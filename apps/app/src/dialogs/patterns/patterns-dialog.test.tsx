import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { Store } from "src/state";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import type { ExportPatternsOptions } from "src/lib/operational-data-io/patterns/export-patterns";
import type { Patterns } from "src/hydraulic-model";
import { PatternsDialog } from "./patterns-dialog";

const exportToCsv =
  vi.fn<
    (patterns: Patterns, options: ExportPatternsOptions) => Promise<void>
  >();
const exportToXlsx =
  vi.fn<
    (patterns: Patterns, options: ExportPatternsOptions) => Promise<void>
  >();

vi.mock("src/commands/export-patterns", () => ({
  useExportPatterns: () => ({ exportToCsv, exportToXlsx }),
}));

const importPatterns = vi.fn();

vi.mock("src/commands/import-patterns", () => ({
  useImportPatterns: () => importPatterns,
}));

let isEditionBlocked = false;
vi.mock("src/hooks/use-is-edition-blocked", () => ({
  useIsEditionBlocked: () => isEditionBlocked,
}));

const importing = (
  patterns: {
    label: string;
    type?: string;
    intervalSeconds?: number;
    multipliers: number[];
  }[],
  overrides: { status?: string; errors?: { message: string }[] } = {},
) =>
  importPatterns.mockResolvedValue({
    status: overrides.status ?? "success",
    format: "csv",
    patterns,
    errors: overrides.errors ?? [],
  });

const clickImport = async (user: ReturnType<typeof setupUser>) =>
  user.click(screen.getByRole("button", { name: /^import$/i }));

const storeWith = (...args: [number, string, number[]][]) =>
  setInitialState({
    hydraulicModel: args
      .reduce(
        (b, [id, label, factors]) => b.aDemandPattern(id, label, factors),
        HydraulicModelBuilder.with(),
      )
      .build(),
  });

const renderDialog = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <PatternsDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

// Skip pointer events check because the spreadsheet table uses pointer-events: none on inactive cells
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const getMultiplierCell = (rowIndex: number) => {
  const gridCells = screen.getAllByRole("gridcell");
  // Columns: timestep (0), multiplier (1)
  // Row N multiplier is at index N * 2 + 1
  return gridCells[rowIndex * 2 + 1];
};

describe("PatternsDialog", () => {
  beforeEach(() => {
    stubUserTracking();
    isEditionBlocked = false;
  });

  describe("save button state", () => {
    it("is disabled when there are no changes", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      renderDialog(store);

      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });

    it("is enabled when a pattern is modified", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      renderDialog(store);

      // Select the pattern
      await user.click(screen.getByRole("button", { name: "Pattern1" }));

      // Find and modify the first multiplier cell
      const firstMultiplierCell = getMultiplierCell(0);
      await user.dblClick(firstMultiplierCell);
      await waitFor(() => {
        expect(
          within(firstMultiplierCell).getByRole("textbox"),
        ).not.toHaveAttribute("readonly");
      });
      const input = within(firstMultiplierCell).getByRole("textbox");
      await user.clear(input);
      await user.type(input, "2.0{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });
    });
  });

  describe("saving patterns", () => {
    it("persists changes to the hydraulic model when save is clicked", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      renderDialog(store);

      // Select the pattern
      await user.click(screen.getByRole("button", { name: "Pattern1" }));

      // Modify the first multiplier
      const firstMultiplierCell = getMultiplierCell(0);
      await user.dblClick(firstMultiplierCell);
      await waitFor(() => {
        expect(
          within(firstMultiplierCell).getByRole("textbox"),
        ).not.toHaveAttribute("readonly");
      });
      const input = within(firstMultiplierCell).getByRole("textbox");
      await user.clear(input);
      await user.type(input, "2.0{Enter}");

      // Wait for save button to be enabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });

      // Click save
      await user.click(screen.getByRole("button", { name: /save/i }));

      // Verify the model was updated
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      const updatedPattern = hydraulicModel.patterns.get(100);
      expect(updatedPattern?.multipliers[0]).toBe(2.0);
    });
  });

  describe("cancel behavior", () => {
    it("closes dialog immediately when there are no changes", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      const { container } = renderDialog(store);

      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Dialog should be closed (container empty or dialog content gone)
      await waitFor(() => {
        expect(
          container.querySelector("[role='dialog']"),
        ).not.toBeInTheDocument();
      });
    });

    it("shows discard confirmation when there are unsaved changes", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      renderDialog(store);

      // Select the pattern and make changes
      await user.click(screen.getByRole("button", { name: "Pattern1" }));
      const firstMultiplierCell = getMultiplierCell(0);
      await user.dblClick(firstMultiplierCell);
      await waitFor(() => {
        expect(
          within(firstMultiplierCell).getByRole("textbox"),
        ).not.toHaveAttribute("readonly");
      });
      const input = within(firstMultiplierCell).getByRole("textbox");
      await user.clear(input);
      await user.type(input, "2.0{Enter}");

      // Wait for changes to be detected
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });

      // Click cancel
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Should show confirmation UI
      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /discard changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /keep editing/i }),
      ).toBeInTheDocument();
    });

    it("hides confirmation and stays in dialog when clicking keep editing", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      renderDialog(store);

      // Select the pattern and make changes
      await user.click(screen.getByRole("button", { name: "Pattern1" }));
      const firstMultiplierCell = getMultiplierCell(0);
      await user.dblClick(firstMultiplierCell);
      await waitFor(() => {
        expect(
          within(firstMultiplierCell).getByRole("textbox"),
        ).not.toHaveAttribute("readonly");
      });
      const input = within(firstMultiplierCell).getByRole("textbox");
      await user.clear(input);
      await user.type(input, "2.0{Enter}");

      // Wait for changes to be detected and click cancel
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Click keep editing
      await user.click(screen.getByRole("button", { name: /keep editing/i }));

      // Should be back to normal state
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
    });

    it("closes dialog without saving when clicking discard changes", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8, 0.6])
          .build(),
      });

      const { container } = renderDialog(store);

      // Select the pattern and make changes
      await user.click(screen.getByRole("button", { name: "Pattern1" }));
      const firstMultiplierCell = getMultiplierCell(0);
      await user.dblClick(firstMultiplierCell);
      await waitFor(() => {
        expect(
          within(firstMultiplierCell).getByRole("textbox"),
        ).not.toHaveAttribute("readonly");
      });
      const input = within(firstMultiplierCell).getByRole("textbox");
      await user.clear(input);
      await user.type(input, "2.0{Enter}");

      // Wait for changes and click cancel
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Click discard changes
      await user.click(
        screen.getByRole("button", { name: /discard changes/i }),
      );

      // Dialog should be closed
      await waitFor(() => {
        expect(
          container.querySelector("[role='dialog']"),
        ).not.toBeInTheDocument();
      });

      // Model should not have been updated
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      const pattern = hydraulicModel.patterns.get(100);
      expect(pattern?.multipliers[0]).toBe(1.0);
    });
  });

  describe("empty state", () => {
    it("shows empty state when there are no patterns", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderDialog(store);

      expect(screen.getByText(/patterns are empty/i)).toBeInTheDocument();
    });
  });

  describe("creating a new pattern", () => {
    it("adds a new pattern when clicking add pattern and entering a name", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderDialog(store);

      // Click add pattern button
      await user.click(
        screen.getByRole("button", { name: /add demand pattern/i }),
      );

      // Type the pattern name and confirm
      const nameInput = screen.getByRole("textbox");
      await user.type(nameInput, "NEWPATTERN");
      await user.keyboard("{Enter}");

      // The new pattern should appear in the sidebar and be selected
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "NEWPATTERN" }),
        ).toBeInTheDocument();
      });

      // Save button should be enabled since we added a new pattern
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });

    it("persists new pattern to the model when saved", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderDialog(store);

      // Add a new pattern
      await user.click(
        screen.getByRole("button", { name: /add demand pattern/i }),
      );
      const nameInput = screen.getByRole("textbox");
      await user.type(nameInput, "NEWPATTERN");
      await user.keyboard("{Enter}");

      // Wait for pattern to be added
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });

      // Save
      await user.click(screen.getByRole("button", { name: /save/i }));

      // Verify the model was updated with the new pattern
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      const newPatternId = store
        .get(modelFactoriesAtom)
        .labelManager.getIdByLabel("newpattern", "pattern")!;
      const newPattern = hydraulicModel.patterns.get(newPatternId);
      expect(newPattern).toEqual({
        id: newPatternId,
        label: "NEWPATTERN",
        type: "demand",
        multipliers: [1],
      });
    });

    it("assigns unique IDs when adding patterns to existing ones", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(1, "EXISTING1", [1.0])
          .aDemandPattern(2, "EXISTING2", [1.0, 0.8])
          .build(),
      });

      renderDialog(store);

      // Add a new pattern
      await user.click(
        screen.getByRole("button", { name: /add demand pattern/i }),
      );
      const nameInput = screen.getByRole("textbox");
      await user.type(nameInput, "NEWPATTERN");
      await user.keyboard("{Enter}");

      // Wait for pattern to be added
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "NEWPATTERN" }),
        ).toBeInTheDocument();
      });

      // Save the changes
      await user.click(screen.getByRole("button", { name: /save/i }));

      // Verify the model has all three patterns with unique IDs
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      const patterns = hydraulicModel.patterns;

      expect(patterns.size).toBe(3);

      // Get all pattern IDs
      const patternIds = Array.from(patterns.keys());
      const uniqueIds = new Set(patternIds);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(3);

      // The new pattern should have an ID that doesn't conflict with existing ones
      const newPattern = Array.from(patterns.values()).find(
        (p: { label: string; id: number }) => p.label === "NEWPATTERN",
      );
      expect(newPattern).toBeDefined();
      expect(newPattern?.id).not.toBe(1);
      expect(newPattern?.id).not.toBe(2);
    });
  });

  describe("deleting patterns", () => {
    it("deletes a pattern that is not in use", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8])
          .aDemandPattern(200, "Pattern2", [1.0, 1.2])
          .build(),
      });

      renderDialog(store);

      // Open actions menu for Pattern1 and click delete
      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      await user.click(actionsButtons[0]);
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      // Pattern1 should be removed from the list
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Pattern1" }),
        ).not.toBeInTheDocument();
      });

      // Pattern2 should still be there
      expect(
        screen.getByRole("button", { name: "Pattern2" }),
      ).toBeInTheDocument();

      // Save button should be enabled
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });

    it("persists deletion when saved", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8])
          .aDemandPattern(200, "Pattern2", [1.0, 1.2])
          .build(),
      });

      renderDialog(store);

      // Delete Pattern1
      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      await user.click(actionsButtons[0]);
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      // Wait for deletion and save
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });
      await user.click(screen.getByRole("button", { name: /save/i }));

      // Verify the model was updated
      const hydraulicModel = store.get(stagingModelDerivedAtom);
      expect(hydraulicModel.patterns.has(100)).toBe(false);
      expect(hydraulicModel.patterns.has(200)).toBe(true);
    });

    it("blocks deletion of a pattern used by a junction", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "UsedPattern", [1.0, 0.8])
          .aJunction(1)
          .aJunctionDemand(1, [{ baseDemand: 10, patternId: 100 }])
          .build(),
      });

      renderDialog(store);

      // Try to delete the pattern
      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      // Pattern should still be in the list
      expect(
        screen.getByRole("button", { name: "UsedPattern" }),
      ).toBeInTheDocument();

      // Save button should be disabled (no changes)
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });

    it("blocks deletion of a pattern used by a customer point", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "UsedPattern", [1.0, 0.8])
          .aCustomerPoint(1)
          .aCustomerPointDemand(1, [{ baseDemand: 5, patternId: 100 }])
          .build(),
      });

      renderDialog(store);

      // Try to delete the pattern
      await user.click(screen.getByRole("button", { name: /actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      // Pattern should still be in the list
      expect(
        screen.getByRole("button", { name: "UsedPattern" }),
      ).toBeInTheDocument();

      // Save button should be disabled (no changes)
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });

    it("clears selection when deleting the selected pattern", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "Pattern1", [1.0, 0.8])
          .build(),
      });

      renderDialog(store);

      // Select the pattern first
      await user.click(screen.getByRole("button", { name: "Pattern1" }));

      // Delete the selected pattern
      const actionsButtons = screen.getAllByRole("button", {
        name: /actions/i,
      });
      await user.click(actionsButtons[0]);
      await user.click(screen.getByRole("menuitem", { name: /delete/i }));

      // Pattern should be removed
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Pattern1" }),
        ).not.toBeInTheDocument();
      });

      // Should show empty state
      expect(screen.getByText(/patterns are empty/i)).toBeInTheDocument();
    });
  });

  describe("import/export toolbar", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_PATTERNS_IMPORT_EXPORT");
      importPatterns.mockReset();
    });

    it("is hidden when the flag is off", () => {
      stubFeatureOff("FLAG_PATTERNS_IMPORT_EXPORT");
      const store = storeWith([100, "Pattern1", [1, 0.8]]);

      renderDialog(store);

      expect(
        screen.queryByRole("button", { name: /export/i }),
      ).not.toBeInTheDocument();
    });

    it("shows imported patterns in the sidebar and persists them on save", async () => {
      const user = setupUser();
      const store = storeWith([100, "Pattern1", [1, 0.8]]);
      importing([
        { label: "Pattern1", type: "demand", multipliers: [5, 6] },
        { label: "NewOne", type: "demand", multipliers: [2, 3] },
      ]);

      renderDialog(store);
      await clickImport(user);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "NewOne" })).toBeVisible(),
      );
      expect(
        store.get(stagingModelDerivedAtom).patterns.get(100)?.multipliers,
      ).toEqual([1, 0.8]);

      await user.click(screen.getByRole("button", { name: /dismiss/i }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      const saved = store.get(stagingModelDerivedAtom).patterns;
      expect(saved.get(100)?.multipliers).toEqual([5, 6]);
      expect([...saved.values()].map((p) => p.label)).toContain("NewOne");
    });

    it("locks the table while the import is in flight", async () => {
      const user = setupUser();
      const store = storeWith([100, "Pattern1", [1]]);
      let finishImport!: (result: unknown) => void;
      importPatterns.mockReturnValue(
        new Promise((resolve) => {
          finishImport = resolve;
        }),
      );

      renderDialog(store);
      await user.click(screen.getByRole("button", { name: "Pattern1" }));
      await clickImport(user);

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /^import$/i }),
        ).toBeDisabled(),
      );
      const multiplierCell = getMultiplierCell(0);
      await user.dblClick(multiplierCell);
      expect(within(multiplierCell).getByRole("textbox")).toHaveAttribute(
        "readonly",
      );

      finishImport({
        status: "success",
        format: "csv",
        patterns: [{ label: "Pattern1", type: "demand", multipliers: [9] }],
        errors: [],
      });

      await waitFor(() =>
        expect(screen.getByText(/added|updated|identical/i)).toBeVisible(),
      );
    });

    it("disables importing when edition is blocked", () => {
      isEditionBlocked = true;
      const store = storeWith([100, "Pattern1", [1]]);

      renderDialog(store);

      expect(screen.getByRole("button", { name: /^import$/i })).toBeDisabled();
    });
  });
});
