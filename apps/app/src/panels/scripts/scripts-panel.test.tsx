import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import {
  resolvePermissions,
  type Permissions,
} from "src/hooks/use-permissions";
import { registerScripting } from "src/lib/scripting";
import { Store } from "src/state";
import { userScriptsAtom, type UserScript } from "src/state/scripts";
import { ScriptsPanel } from "./scripts-panel";

vi.mock("./code-editor", () => ({
  CodeEditor: ({
    initialSource,
    locked,
    onChange,
  }: {
    initialSource: string;
    locked: boolean;
    onChange: (source: string) => void;
  }) => (
    <textarea
      aria-label="Source"
      defaultValue={initialSource}
      readOnly={locked}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const permissionsRef: { current: Permissions } = {
  current: resolvePermissions("pro", false, false, false),
};

vi.mock("src/hooks/use-permissions", async () => {
  const actual = await vi.importActual<
    typeof import("src/hooks/use-permissions")
  >("src/hooks/use-permissions");
  return {
    ...actual,
    usePermissions: () => permissionsRef.current,
  };
});

const startUpgrade = vi.fn();
vi.mock("src/hooks/use-paywall", async () => {
  const actual = await vi.importActual<typeof import("src/hooks/use-paywall")>(
    "src/hooks/use-paywall",
  );
  return {
    ...actual,
    useStartUpgrade: () => startUpgrade,
  };
});

describe("ScriptsPanel", () => {
  beforeEach(() => {
    startUpgrade.mockClear();
    permissionsRef.current = resolvePermissions("pro", false, false, false);
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

    await user.click(
      screen.getByRole("button", { name: "More actions for Count pipes" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(store.get(userScriptsAtom)).toEqual([
      expect.objectContaining({
        name: "Count pipes (copy)",
        source: "console.log(1);",
      }),
    ]);
    expect(
      screen.getByRole("button", { name: "Count pipes (copy)" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Count pipes" })).toBeVisible();
  });

  it("renames a saved script in place", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      { id: "1", name: "Old name", source: "", apiVersion: 1, updatedAt: 0 },
    ]);
    renderPanel(store);

    await user.click(
      screen.getByRole("button", { name: "More actions for Old name" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
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

  it("runs a script from its row without opening the editor", async () => {
    const user = userEvent.setup();
    const startScriptRun = vi.fn().mockReturnValue({
      finished: new Promise(() => {}),
      cancel: vi.fn(),
    });
    registerScripting({ startScriptRun, exampleScripts: [] });
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      {
        id: "1",
        name: "Pipe audit",
        source: "console.log(1);",
        apiVersion: 1,
        updatedAt: 0,
      },
    ]);
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: "Run Pipe audit" }));

    expect(startScriptRun).toHaveBeenCalledWith(
      expect.objectContaining({ source: "console.log(1);" }),
    );
    expect(screen.getByText("My scripts")).toBeVisible();
  });

  it("renames a script from its actions menu", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      {
        id: "1",
        name: "Pipe audit",
        source: "console.log(1);",
        apiVersion: 1,
        updatedAt: 0,
      },
    ]);
    renderPanel(store);

    await user.click(
      screen.getByRole("button", { name: "More actions for Pipe audit" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const input = screen.getByRole("textbox", {
      name: "Value for: Script name",
    });
    await user.clear(input);
    await user.type(input, "Valve audit{Enter}");

    expect(store.get(userScriptsAtom)).toEqual([
      expect.objectContaining({
        id: "1",
        name: "Valve audit",
        source: "console.log(1);",
      }),
    ]);
    expect(screen.getByRole("button", { name: "Valve audit" })).toBeVisible();
  });

  it("deletes a script after confirming", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, [
      { id: "1", name: "Pipe audit", source: "", apiVersion: 1, updatedAt: 0 },
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
      { id: "1", name: "Pipe audit", source: "", apiVersion: 1, updatedAt: 0 },
    ]);
    renderPanel(store);

    await user.click(
      screen.getByRole("button", { name: "More actions for Pipe audit" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete script" }));

    expect(store.get(userScriptsAtom)).toEqual([]);
    expect(screen.getByText("My scripts")).toBeVisible();
  });

  describe("on a free plan", () => {
    beforeEach(() => {
      permissionsRef.current = resolvePermissions("free", false, false, false);
    });

    it("opens a script read-only and offers the paywall instead of running it", async () => {
      const user = userEvent.setup();
      const startScriptRun = vi.fn();
      registerScripting({ startScriptRun, exampleScripts: [] });
      const store = aStoreWith([
        {
          id: "1",
          name: "Pipe audit",
          source: "console.log(1);",
          apiVersion: 1,
          updatedAt: 0,
        },
      ]);
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Pipe audit" }));

      expect(screen.getByRole("textbox", { name: "Source" })).toHaveValue(
        "console.log(1);",
      );
      expect(screen.getByRole("textbox", { name: "Source" })).toHaveAttribute(
        "readonly",
      );

      await user.click(screen.getByRole("button", { name: "Run" }));

      expect(startScriptRun).not.toHaveBeenCalled();
      expect(startUpgrade).toHaveBeenLastCalledWith("runScripts");
    });

    it("offers the paywall instead of running a script from its row", async () => {
      const user = userEvent.setup();
      const startScriptRun = vi.fn();
      registerScripting({ startScriptRun, exampleScripts: [] });
      const store = aStoreWith([
        {
          id: "1",
          name: "Pipe audit",
          source: "console.log(1);",
          apiVersion: 1,
          updatedAt: 0,
        },
      ]);
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Run Pipe audit" }));

      expect(startScriptRun).not.toHaveBeenCalled();
      expect(startUpgrade).toHaveBeenLastCalledWith("runScripts");
    });

    it("runs an example script", async () => {
      const user = userEvent.setup();
      const startScriptRun = vi.fn().mockReturnValue({
        finished: new Promise(() => {}),
        cancel: vi.fn(),
      });
      registerScripting({
        startScriptRun,
        exampleScripts: [
          { id: "example", name: "Count pipes", source: "console.log(1);" },
        ],
      });
      const store = aStoreWith([]);
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Run Count pipes" }));

      expect(startUpgrade).not.toHaveBeenCalled();
      expect(startScriptRun).toHaveBeenCalledWith(
        expect.objectContaining({ source: "console.log(1);" }),
      );
    });

    it("offers the paywall instead of creating a script", async () => {
      const user = userEvent.setup();
      const store = aStoreWith([]);
      renderPanel(store);

      await user.click(
        screen.getByRole("button", { name: "Paid feature: Create a script" }),
      );

      expect(startUpgrade).toHaveBeenLastCalledWith("editScripts");
      expect(screen.getByText("My scripts")).toBeVisible();
    });

    it.each(["Rename", "Delete"])(
      "offers the paywall instead of %s from the row menu",
      async (action) => {
        const user = userEvent.setup();
        const store = aStoreWith([
          {
            id: "1",
            name: "Pipe audit",
            source: "",
            apiVersion: 1,
            updatedAt: 0,
          },
        ]);
        renderPanel(store);

        await user.click(
          screen.getByRole("button", { name: "More actions for Pipe audit" }),
        );
        await user.click(screen.getByRole("menuitem", { name: action }));

        expect(startUpgrade).toHaveBeenLastCalledWith("editScripts");
        expect(store.get(userScriptsAtom)).toEqual([
          expect.objectContaining({ id: "1", name: "Pipe audit" }),
        ]);
      },
    );

    it("offers the paywall instead of saving or renaming in the editor", async () => {
      const user = userEvent.setup();
      const store = aStoreWith([
        {
          id: "1",
          name: "Pipe audit",
          source: "",
          apiVersion: 1,
          updatedAt: 0,
        },
      ]);
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Pipe audit" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(startUpgrade).toHaveBeenLastCalledWith("editScripts");

      startUpgrade.mockClear();
      await user.click(screen.getByRole("button", { name: "Pipe audit" }));

      expect(startUpgrade).toHaveBeenLastCalledWith("editScripts");
    });
  });

  describe("on a free plan with the demo network open", () => {
    beforeEach(() => {
      permissionsRef.current = resolvePermissions("free", false, false, true);
    });

    it("creates, saves and runs a script without the paywall", async () => {
      const user = userEvent.setup();
      const startScriptRun = vi.fn().mockReturnValue({
        finished: new Promise(() => {}),
        cancel: vi.fn(),
      });
      registerScripting({ startScriptRun, exampleScripts: [] });
      const store = aStoreWith([]);
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Create a script" }));
      await user.clear(screen.getByRole("textbox", { name: "Source" }));
      await user.type(
        screen.getByRole("textbox", { name: "Source" }),
        "console.log(2);",
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      await user.click(screen.getByRole("button", { name: "Run" }));

      expect(startUpgrade).not.toHaveBeenCalled();
      expect(store.get(userScriptsAtom)).toEqual([
        expect.objectContaining({ source: "console.log(2);" }),
      ]);
      expect(startScriptRun).toHaveBeenCalledWith(
        expect.objectContaining({ source: "console.log(2);" }),
      );
    });
  });

  const aStoreWith = (scripts: UserScript[]) => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(userScriptsAtom, scripts);
    return store;
  };

  const renderPanel = (store: Store) =>
    render(
      <CommandContainer store={store}>
        <TooltipProvider>
          <ScriptsPanel />
        </TooltipProvider>
      </CommandContainer>,
    );
});
