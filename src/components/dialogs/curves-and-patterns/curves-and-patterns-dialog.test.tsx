import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { MemPersistenceDeprecated } from "src/lib/persistence/memory-deprecated";
import { PersistenceContext } from "src/lib/persistence/context";
import { Store, dataAtom } from "src/state/jotai";
import { CurvesAndPatternsDialog } from "./curves-and-patterns-dialog";

const renderDialog = (store: Store) => {
  const persistence = new MemPersistenceDeprecated(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <CurvesAndPatternsDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

// Skip pointer events check because react-datasheet-grid uses pointer-events: none on inactive cells
const setupUser = () => userEvent.setup({ pointerEventsCheck: 0 });

const getMultiplierInput = (rowIndex: number) => {
  const inputs = screen.getAllByRole("textbox");
  return inputs[rowIndex];
};

describe("CurvesAndPatternsDialog", () => {
  beforeEach(() => {
    stubUserTracking();
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
      const firstMultiplier = getMultiplierInput(0);
      await user.click(firstMultiplier);
      await user.clear(firstMultiplier);
      await user.type(firstMultiplier, "2.0");
      await user.keyboard("{Enter}");

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
      const firstMultiplier = getMultiplierInput(0);
      await user.dblClick(firstMultiplier);
      await user.clear(firstMultiplier);
      await user.type(firstMultiplier, "2.0");
      // Tab away from the input to commit the value
      await user.tab();

      // Wait for save button to be enabled
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
      });

      // Click save
      await user.click(screen.getByRole("button", { name: /save/i }));

      // Verify the model was updated
      const { hydraulicModel } = store.get(dataAtom);
      const updatedPattern = hydraulicModel.demands.patterns.get(100);
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
      const firstMultiplier = getMultiplierInput(0);
      await user.dblClick(firstMultiplier);
      await user.clear(firstMultiplier);
      await user.type(firstMultiplier, "2.0");
      // Tab away from the input to commit the value
      await user.tab();

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
      const firstMultiplier = getMultiplierInput(0);
      await user.dblClick(firstMultiplier);
      await user.clear(firstMultiplier);
      await user.type(firstMultiplier, "2.0");
      // Tab away from the input to commit the value
      await user.tab();

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
      const firstMultiplier = getMultiplierInput(0);
      await user.dblClick(firstMultiplier);
      await user.clear(firstMultiplier);
      await user.type(firstMultiplier, "2.0");
      // Tab away from the input to commit the value
      await user.tab();

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
      const { hydraulicModel } = store.get(dataAtom);
      const pattern = hydraulicModel.demands.patterns.get(100);
      expect(pattern?.multipliers[0]).toBe(1.0);
    });
  });

  describe("empty state", () => {
    it("shows empty state when there are no patterns", () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });

      renderDialog(store);

      expect(screen.getByText(/demand patterns is empty/i)).toBeInTheDocument();
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
      await user.click(screen.getByRole("button", { name: /add pattern/i }));

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
      await user.click(screen.getByRole("button", { name: /add pattern/i }));
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
      const { hydraulicModel } = store.get(dataAtom);
      const newPatternId = hydraulicModel.labelManager.getIdByLabel(
        "newpattern",
        "pattern",
      )!;
      const newPattern = hydraulicModel.demands.patterns.get(newPatternId);
      expect(newPattern).toEqual({
        id: newPatternId,
        label: "NEWPATTERN",
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
      await user.click(screen.getByRole("button", { name: /add pattern/i }));
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
      const data = store.get(dataAtom);
      const patterns = data.hydraulicModel.demands.patterns;

      expect(patterns.size).toBe(3);

      // Get all pattern IDs
      const patternIds = Array.from(patterns.keys());
      const uniqueIds = new Set(patternIds);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(3);

      // The new pattern should have an ID that doesn't conflict with existing ones
      const newPattern = Array.from(patterns.values()).find(
        (p) => p.label === "NEWPATTERN",
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
      const { hydraulicModel } = store.get(dataAtom);
      expect(hydraulicModel.demands.patterns.has(100)).toBe(false);
      expect(hydraulicModel.demands.patterns.has(200)).toBe(true);
    });

    it("blocks deletion of a pattern used by a junction", async () => {
      const user = setupUser();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aDemandPattern(100, "UsedPattern", [1.0, 0.8])
          .aJunction(1, { demands: [{ baseDemand: 10, patternId: 100 }] })
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
          .aCustomerPoint(1, {
            demands: [{ baseDemand: 5, patternId: 100 }],
          })
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
      expect(screen.getByText(/demand patterns is empty/i)).toBeInTheDocument();
    });
  });
});
