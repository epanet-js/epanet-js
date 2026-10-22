import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { registerScripting } from "src/lib/scripting";
import { Store } from "src/state";
import { userScriptsAtom } from "src/state/scripts";
import { ScriptsPanel } from "./scripts-panel";

vi.mock("./code-editor", () => ({
  CodeEditor: ({
    initialSource,
    onChange,
  }: {
    initialSource: string;
    onChange: (source: string) => void;
  }) => (
    <textarea
      aria-label="Source"
      defaultValue={initialSource}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("ScriptsPanel", () => {
  beforeEach(() => {
    registerScripting({
      startScriptRun: vi.fn(),
      exampleScripts: [
        { id: "example", name: "Count pipes", source: "console.log(1);" },
      ],
    });
  });

  it("saves a new script under my scripts", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: /new/i }));
    await user.clear(
      screen.getByRole("textbox", { name: "Value for: Script name" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Value for: Script name" }),
      "Pipe audit",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(store.get(userScriptsAtom).map((s) => s.name)).toEqual([
      "Pipe audit",
    ]);
    expect(screen.getByRole("button", { name: "Pipe audit" })).toBeVisible();
  });

  it("saves an example as a copy", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: "Count pipes" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(store.get(userScriptsAtom)).toEqual([
      expect.objectContaining({
        name: "Count pipes",
        source: "console.log(1);",
      }),
    ]);
    expect(screen.getAllByRole("button", { name: "Count pipes" })).toHaveLength(
      2,
    );
  });

  it("renames a saved script in place", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      { id: "1", name: "Old name", source: "", updatedAt: 0 },
    ]);
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: "Old name" }));
    await user.clear(
      screen.getByRole("textbox", { name: "Value for: Script name" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Value for: Script name" }),
      "New name",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(store.get(userScriptsAtom)).toEqual([
      expect.objectContaining({ id: "1", name: "New name" }),
    ]);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("asks before discarding unsaved changes", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: /new/i }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByText(
        "You have unsaved changes. Are you sure you want to discard them?",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(store.get(userScriptsAtom)).toEqual([]);
    expect(screen.getByText("My scripts")).toBeVisible();
  });

  it("deletes a script after confirming", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      { id: "1", name: "Pipe audit", source: "", updatedAt: 0 },
    ]);
    renderPanel(store);

    await user.click(
      screen.getByRole("button", { name: "More actions for Pipe audit" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(store.get(userScriptsAtom)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Delete script" }));

    expect(store.get(userScriptsAtom)).toEqual([]);
  });

  it("deletes the open script from the editor and returns to the list", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      { id: "1", name: "Pipe audit", source: "", updatedAt: 0 },
    ]);
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: "Pipe audit" }));
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete script" }));

    expect(store.get(userScriptsAtom)).toEqual([]);
    expect(screen.getByText("My scripts")).toBeVisible();
  });

  const renderPanel = (store: Store) =>
    render(
      <CommandContainer store={store}>
        <TooltipProvider>
          <ScriptsPanel />
        </TooltipProvider>
      </CommandContainer>,
    );
});
