import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { createHglProfilePanel } from "src/panels/hgl-profile/create-panel";
import { splitsAtom } from "src/state/layout";
import { Mode, modeAtom } from "src/state/mode";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useActivatePanel } from "./activate-panel";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

beforeEach(() => {
  stubUserTracking();
});

describe("useActivatePanel", () => {
  it("deactivates the outgoing panel", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createHglProfilePanel(),
      createAssetTablePanel("junction", { id: "junction" }),
    ]);
    store.set(modeAtom, { mode: Mode.HGL_PROFILE });

    await activate(store, "junction");

    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
  });

  it("leaves the panel alone when it is already active", async () => {
    const store = aStore();
    store.set(panelsAtom, [createHglProfilePanel()]);
    store.set(modeAtom, { mode: Mode.HGL_PROFILE });

    await activate(store, "hgl-profile");

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });

  it("makes the panel active in its dock", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createHglProfilePanel(),
      createAssetTablePanel("junction", { id: "junction" }),
    ]);

    await activate(store, "junction");

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("junction");
  });

  it("ignores a panel that is unavailable in the current layout", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "junction" }),
      { ...createHglProfilePanel(), availableInVerticalLayout: false },
    ]);
    store.set(splitsAtom, (s) => ({ ...s, layout: "VERTICAL" }));

    await activate(store, "hgl-profile");

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("junction");
  });
});

const Trigger = ({ panelId }: { panelId: string }) => {
  const activatePanel = useActivatePanel();
  return (
    <button aria-label="activate" onClick={() => activatePanel(panelId)}>
      Activate
    </button>
  );
};

const activate = async (store: Store, panelId: string) => {
  render(
    <CommandContainer store={store}>
      <Trigger panelId={panelId} />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "activate" }));
};
