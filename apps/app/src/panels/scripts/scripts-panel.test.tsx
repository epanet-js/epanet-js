import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import {
  changePatterns,
  changeProperty,
} from "@epanet-js/hydraulic-model-operations";
import type { HydraulicModel, Pipe } from "@epanet-js/hydraulic-model";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import {
  resolvePermissions,
  type Permissions,
} from "src/hooks/use-permissions";
import { registerScripting, type ScriptRunOutcome } from "src/lib/scripting";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { userScriptsAtom, type UserScript } from "src/state/scripts";
import { ScriptsPanel } from "./scripts-panel";
import {
  registerScriptAssistant,
  type ScriptAssistantRequest,
  type WrittenScript,
} from "src/lib/script-assistant";

const writes: {
  request: ScriptAssistantRequest;
  signal: AbortSignal;
  resolve: (written: WrittenScript) => void;
}[] = [];

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
        {
          id: "select-small-pipes",
          name: "Select small pipes",
          source: "console.log(1);",
          paid: false,
        },
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

  it("focuses the name field when creating a script", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: /new/i }));

    expect(
      screen.getByRole("textbox", { name: "Value for: Script name" }),
    ).toHaveFocus();
  });

  describe("with the scripting assistant", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_SCRIPTING_ASSISTANT");
      writes.length = 0;
      registerScriptAssistant({
        writeScript: (request, { signal }) =>
          new Promise((resolve, reject) => {
            writes.push({ request, signal, resolve });
            signal.addEventListener("abort", () => reject(signal.reason));
          }),
      });
    });

    afterEach(() => {
      stubFeatureOff("FLAG_SCRIPTING_ASSISTANT");
    });

    it("asks for a description before opening the editor", async () => {
      const user = userEvent.setup();
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with().build(),
      });
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: /new/i }));

      expect(screen.getByText("Describe the script you want")).toBeVisible();
      expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
      await user.type(
        screen.getByRole("textbox", { name: "Describe the script you want" }),
        "Select small pipes",
      );
      expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();

      await user.click(
        screen.getByRole("button", { name: "Write script myself" }),
      );

      expect(
        screen.getByRole("textbox", { name: "Value for: Script name" }),
      ).toHaveFocus();
    });

    describe("while the assistant writes", () => {
      it("opens the written script in the editor", async () => {
        const user = userEvent.setup();
        const store = setInitialState({
          hydraulicModel: HydraulicModelBuilder.with().build(),
        });
        renderPanel(store);

        await user.click(screen.getByRole("button", { name: /new/i }));
        await user.type(
          screen.getByRole("textbox", {
            name: "Describe the script you want",
          }),
          "Select small pipes",
        );
        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(writes[0].request).toEqual({
          prompt: "Select small pipes",
          source: "",
          scope: "script",
        });
        expect(screen.getByText("Writing script…")).toBeVisible();
        expect(
          screen.queryByRole("button", { name: "Write script myself" }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("textbox", { name: "Source" }),
        ).not.toBeInTheDocument();

        writes[0].resolve({
          source: "selectSmallPipes();",
          name: "Small pipes",
        });

        expect(
          await screen.findByRole("textbox", { name: "Source" }),
        ).toHaveValue("selectSmallPipes();");
        expect(
          screen.getByRole("textbox", { name: "Value for: Script name" }),
        ).toHaveValue("Small pipes");
        expect(
          screen.getByRole("textbox", { name: "Value for: Script name" }),
        ).not.toHaveFocus();
        expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();

        await user.type(
          screen.getByRole("textbox", { name: "Describe a change" }),
          "Also export a CSV",
        );
        await user.click(screen.getByRole("button", { name: "Send" }));

        expect(writes[1].request).toEqual({
          prompt: "Also export a CSV",
          source: "selectSmallPipes();",
          scope: "script",
        });
        expect(screen.getByText("Updating script…")).toBeVisible();
        expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();

        writes[1].resolve({
          source: "selectSmallPipes();\nexportCsv();",
          name: "Small pipes",
        });

        await waitFor(() =>
          expect(screen.getByRole("textbox", { name: "Source" })).toHaveValue(
            "selectSmallPipes();\nexportCsv();",
          ),
        );
        expect(
          screen.getByRole("textbox", { name: "Describe a change" }),
        ).toHaveValue("");
      });

      it("stops and hands the description back", async () => {
        const user = userEvent.setup();
        const store = setInitialState({
          hydraulicModel: HydraulicModelBuilder.with().build(),
        });
        renderPanel(store);

        await user.click(screen.getByRole("button", { name: /new/i }));
        await user.type(
          screen.getByRole("textbox", {
            name: "Describe the script you want",
          }),
          "Select small pipes",
        );
        await user.click(screen.getByRole("button", { name: "Send" }));
        await user.click(screen.getByRole("button", { name: "Stop" }));

        expect(writes[0].signal.aborted).toBe(true);
        expect(
          screen.queryByRole("textbox", { name: "Source" }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("textbox", { name: "Describe the script you want" }),
        ).toHaveValue("Select small pipes");
        expect(
          screen.getByRole("button", { name: "Write script myself" }),
        ).toBeVisible();
      });
    });
  });

  it("saves an example as a copy", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    renderPanel(store);

    await user.click(
      screen.getByRole("button", {
        name: "More actions for Select small pipes",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(store.get(userScriptsAtom)).toEqual([
      expect.objectContaining({
        name: "Select small pipes (copy)",
        source: "console.log(1);",
      }),
    ]);
    expect(
      screen.getByRole("button", { name: "Select small pipes (copy)" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Select small pipes" }),
    ).toBeVisible();
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
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(store.get(userScriptsAtom)).toEqual([]);
    expect(screen.getByText("My scripts")).toBeVisible();
  });

  it("saves unsaved changes before going back", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    renderPanel(store);

    await user.click(screen.getByRole("button", { name: /new/i }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(store.get(userScriptsAtom)).toEqual([
      expect.objectContaining({ name: "Untitled script" }),
    ]);
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

  describe("with script edits", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const aRunThatSetsTheDiameter = () =>
      vi.fn(({ model }: { model: HydraulicModel }) => ({
        finished: Promise.resolve<ScriptRunOutcome>({
          status: "success",
          edits: changeProperty(model, {
            assetIds: [IDS.P1],
            property: "diameter",
            value: 150,
          }).bytes,
          selection: null,
          zoomTo: null,
          attachments: [],
          selectionSets: [],
          bookmarks: [],
        }),
        cancel: vi.fn(),
      }));

    const aStoreWithAPipe = () => {
      const store = setInitialState({
        hydraulicModel: HydraulicModelBuilder.with()
          .aJunction(IDS.J1)
          .aJunction(IDS.J2)
          .aPipe(IDS.P1, {
            startNodeId: IDS.J1,
            endNodeId: IDS.J2,
            diameter: 100,
          })
          .build(),
      });
      store.set(userScriptsAtom, [
        {
          id: "1",
          name: "Resize",
          source: "network.getLink('P1').set({ diameter: 150 });",
          apiVersion: 1,
          updatedAt: 0,
        },
      ]);
      return store;
    };

    const diameterOf = (store: Store) =>
      (store.get(stagingModelDerivedAtom).assets.get(IDS.P1) as Pipe).diameter;

    it("applies the edits a script hands back to the network", async () => {
      stubFeatureOn("FLAG_SCRIPT_EDITS");
      const user = userEvent.setup();
      const startScriptRun = aRunThatSetsTheDiameter();
      registerScripting({ startScriptRun, exampleScripts: [] });
      const store = aStoreWithAPipe();
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Run Resize" }));

      expect(startScriptRun).toHaveBeenCalledWith(
        expect.objectContaining({ isEditsOn: true }),
      );
      await vi.waitFor(() => expect(diameterOf(store)).toEqual(150));
    });

    it("keeps the app from reusing the id of a pattern the script added", async () => {
      stubFeatureOn("FLAG_SCRIPT_EDITS");
      const user = userEvent.setup();
      const startScriptRun = vi.fn(({ model }: { model: HydraulicModel }) => ({
        finished: Promise.resolve<ScriptRunOutcome>({
          status: "success",
          edits: changePatterns(
            model,
            new Map([[9, { id: 9, label: "NIGHT", multipliers: [1] }]]),
          ).bytes,
          selection: null,
          zoomTo: null,
          attachments: [],
          selectionSets: [],
          bookmarks: [],
        }),
        cancel: vi.fn(),
      }));
      registerScripting({ startScriptRun, exampleScripts: [] });
      const store = aStoreWithAPipe();
      renderPanel(store);

      await user.click(screen.getByRole("button", { name: "Run Resize" }));

      await vi.waitFor(() =>
        expect(
          store.get(stagingModelDerivedAtom).patterns.get(9),
        ).toBeDefined(),
      );
      expect(store.get(modelFactoriesAtom).idPools.newId("pattern")).toEqual(
        10,
      );
    });

    it("runs scripts without edits when the flag is off", async () => {
      stubFeatureOff("FLAG_SCRIPT_EDITS");
      const user = userEvent.setup();
      const startScriptRun = vi.fn().mockReturnValue({
        finished: new Promise(() => {}),
        cancel: vi.fn(),
      });
      registerScripting({ startScriptRun, exampleScripts: [] });
      renderPanel(aStoreWithAPipe());

      await user.click(screen.getByRole("button", { name: "Run Resize" }));

      expect(startScriptRun).toHaveBeenCalledWith(
        expect.objectContaining({ isEditsOn: false }),
      );
    });
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
          {
            id: "select-small-pipes",
            name: "Select small pipes",
            source: "console.log(1);",
            paid: false,
          },
        ],
      });
      const store = aStoreWith([]);
      renderPanel(store);

      await user.click(
        screen.getByRole("button", { name: "Run Select small pipes" }),
      );

      expect(startUpgrade).not.toHaveBeenCalled();
      expect(startScriptRun).toHaveBeenCalledWith(
        expect.objectContaining({ source: "console.log(1);" }),
      );
    });

    it("hides paid examples", () => {
      registerScripting({
        startScriptRun: vi.fn(),
        exampleScripts: [
          {
            id: "select-small-pipes",
            name: "Select small pipes",
            source: "",
            paid: false,
          },
          {
            id: "network-review",
            name: "Network review report",
            source: "",
            paid: true,
          },
        ],
      });
      renderPanel(aStoreWith([]));

      expect(
        screen.getByRole("button", { name: "Select small pipes" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Network review report" }),
      ).not.toBeInTheDocument();
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
