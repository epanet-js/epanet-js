import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { hglProfileAtom } from "src/state/hgl-profile";
import { splitsAtom } from "src/state/layout";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { createHglProfilePanel } from "src/panels/hgl-profile/create-panel";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useShowHglProfile } from "./show-hgl-profile";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const hglPanels = (store: Store) =>
  store.get(panelsAtom).filter((p) => p.type === "hgl-profile");

beforeEach(() => {
  stubUserTracking();
});

describe("useShowHglProfile", () => {
  it("registers the panel when none is open", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await show(store);

    expect(hglPanels(store)).toHaveLength(1);
    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual(
      "hgl-profile",
    );
    expect(store.get(splitsAtom).bottomOpen).toBe(true);
  });

  it("activates the panel it just registered, alongside the default panels", async () => {
    const store = aStore();

    await show(store);

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("hgl-profile");
  });

  it("keeps a single instance when invoked again", async () => {
    const store = aStore();
    store.set(panelsAtom, []);

    await show(store);
    await show(store);

    expect(hglPanels(store)).toHaveLength(1);
  });

  it("reactivates the existing panel rather than adding another", async () => {
    const store = aStore();
    const existing = createHglProfilePanel();
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "a" }),
      existing,
    ]);

    await show(store);

    expect(store.get(panelsAtom)).toHaveLength(2);
    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual(
      "hgl-profile",
    );
  });

  it("leaves any committed profile for the caller to reset", async () => {
    const store = aStore();
    const profile = {
      id: "p1",
      anchors: [1, 2],
      terrain: null,
      isUnprojected: false,
    };
    store.set(panelsAtom, []);
    store.set(hglProfileAtom, profile);

    await show(store);

    expect(store.get(hglProfileAtom)).toEqual(profile);
  });
});

const Trigger = () => {
  const showHglProfile = useShowHglProfile();
  return (
    <button
      aria-label="show"
      onClick={() => showHglProfile({ source: "toolbar" })}
    >
      Show
    </button>
  );
};

const show = async (store: Store) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
  await userEvent.click(screen.getAllByRole("button", { name: "show" })[0]);
};
