import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { MemPersistence } from "src/lib/persistence/memory";
import { PersistenceContext } from "src/lib/persistence/context";
import { Store, dataAtom } from "src/state/jotai";
import { ControlsDialog } from "./controls-dialog";

const renderDialog = (store: Store) => {
  const persistence = new MemPersistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <ControlsDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

describe("ControlsDialog", () => {
  it("displays existing simple controls", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1" })
        .aTank(2, { label: "T1" })
        .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "P1" })
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: 3, isActionTarget: true },
            { assetId: 2, isActionTarget: false },
          ],
        })
        .build(),
    });

    renderDialog(store);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("LINK P1 OPEN IF NODE T1 ABOVE 100");
  });

  it("displays existing rule-based controls when switching tabs", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1" })
        .aTank(2, { label: "T1" })
        .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "P1" })
        .aRule({
          ruleId: "1",
          template:
            "RULE {{id}}\nIF NODE {{0}} LEVEL > 100\nTHEN LINK {{1}} STATUS IS OPEN",
          assetReferences: [
            { assetId: 2, isActionTarget: false },
            { assetId: 3, isActionTarget: true },
          ],
        })
        .build(),
    });

    renderDialog(store);

    const rulesTab = screen.getByRole("tab", { name: /rule-based/i });
    await userEvent.click(rulesTab);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(
      "RULE 1\nIF NODE T1 LEVEL > 100\nTHEN LINK P1 STATUS IS OPEN",
    );
  });

  it("saves edited controls to hydraulic model", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1" })
        .aTank(2, { label: "T1" })
        .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "P1" })
        .build(),
    });

    renderDialog(store);

    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "LINK P1 CLOSED IF NODE T1 BELOW 50");

    const saveButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      const { hydraulicModel } = store.get(dataAtom);
      expect(hydraulicModel.controls.simple).toHaveLength(1);
      expect(hydraulicModel.controls.simple[0].template).toBe(
        "LINK {{0}} CLOSED IF NODE {{1}} BELOW 50",
      );
      expect(hydraulicModel.controls.simple[0].assetReferences[0].assetId).toBe(
        3,
      );
      expect(hydraulicModel.controls.simple[0].assetReferences[1].assetId).toBe(
        2,
      );
    });
  });

  it("saves changes from both tabs", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1" })
        .aTank(2, { label: "T1" })
        .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "P1" })
        .build(),
    });

    renderDialog(store);

    // Add simple control
    const simpleTextarea = screen.getByRole("textbox");
    await userEvent.type(simpleTextarea, "LINK P1 OPEN AT TIME 6");

    // Switch to rules tab and add rule
    const rulesTab = screen.getByRole("tab", { name: /rule-based/i });
    await userEvent.click(rulesTab);

    const rulesTextarea = screen.getByRole("textbox");
    await userEvent.type(
      rulesTextarea,
      "RULE 1\nIF NODE T1 LEVEL > 100\nTHEN LINK P1 STATUS IS OPEN",
    );

    // Save
    const saveButton = screen.getByRole("button", { name: /save/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      const { hydraulicModel } = store.get(dataAtom);
      expect(hydraulicModel.controls.simple).toHaveLength(1);
      expect(hydraulicModel.controls.rules).toHaveLength(1);
    });
  });

  it("preserves edits when switching between tabs", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1" })
        .aTank(2, { label: "T1" })
        .aPipe(3, { startNodeId: 1, endNodeId: 2, label: "P1" })
        .build(),
    });

    renderDialog(store);

    // Type in simple tab
    const simpleTextarea = screen.getByRole("textbox");
    await userEvent.type(simpleTextarea, "LINK P1 OPEN AT TIME 6");

    // Switch to rules tab
    const rulesTab = screen.getByRole("tab", { name: /rule-based/i });
    await userEvent.click(rulesTab);

    // Switch back to simple tab
    const simpleTab = screen.getByRole("tab", { name: /simple/i });
    await userEvent.click(simpleTab);

    // Verify content is preserved
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("LINK P1 OPEN AT TIME 6");
  });
});
