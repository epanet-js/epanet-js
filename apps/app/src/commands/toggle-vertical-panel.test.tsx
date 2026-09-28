import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { hglProfileAtom } from "src/state/hgl-profile";
import { ephemeralStateAtom } from "src/state/drawing";
import { Mode, modeAtom } from "src/state/mode";
import { isNarrowViewportAtom } from "src/state/layout";
import { splitsAtom } from "src/state/layout";
import { createHglProfilePanel } from "src/panels/hgl-profile/create-panel";
import { panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useToggleVerticalPanel } from "./toggle-vertical-panel";

const aNarrowStore = () => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, [createHglProfilePanel()]);
  store.set(isNarrowViewportAtom, true);
  return store;
};

const anHglProfileInProgress = (store: Store) => {
  store.set(hglProfileAtom, {
    id: "p1",
    anchors: [1, 2],
    terrain: null,
    isUnprojected: false,
  });
  store.set(ephemeralStateAtom, { type: "hglProfile" });
  store.set(modeAtom, { mode: Mode.HGL_PROFILE });
};

beforeEach(() => {
  stubUserTracking();
});

describe("useToggleVerticalPanel", () => {
  it("opens the vertical panel when it is closed", async () => {
    const store = aNarrowStore();
    store.set(splitsAtom, (s) => ({ ...s, verticalOpen: false }));

    await toggle(store);

    expect(store.get(splitsAtom).verticalOpen).toBe(true);
  });

  it("closes the vertical panel when it is open", async () => {
    const store = aNarrowStore();
    store.set(splitsAtom, (s) => ({ ...s, verticalOpen: true }));

    await toggle(store);

    expect(store.get(splitsAtom).verticalOpen).toBe(false);
  });

  it("leaves the bottom panel alone", async () => {
    const store = aNarrowStore();
    store.set(splitsAtom, (s) => ({
      ...s,
      verticalOpen: true,
      bottomOpen: true,
    }));

    await toggle(store);

    expect(store.get(splitsAtom).verticalOpen).toBe(false);
    expect(store.get(splitsAtom).bottomOpen).toBe(true);
  });

  it("keeps the height for the next time it opens", async () => {
    const store = aNarrowStore();
    store.set(splitsAtom, (s) => ({
      ...s,
      verticalOpen: true,
      vertical: 420,
    }));

    await toggle(store);

    expect(store.get(splitsAtom).vertical).toEqual(420);
  });

  it("deactivates the active panel when closing", async () => {
    const store = aNarrowStore();
    store.set(splitsAtom, (s) => ({ ...s, verticalOpen: true }));
    anHglProfileInProgress(store);

    await toggle(store);

    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
  });

  it("leaves the active panel alone when opening", async () => {
    const store = aNarrowStore();
    store.set(splitsAtom, (s) => ({ ...s, verticalOpen: false }));
    anHglProfileInProgress(store);

    await toggle(store);

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });
});

const Trigger = () => {
  const toggleVerticalPanel = useToggleVerticalPanel();
  return (
    <button
      aria-label="toggle"
      onClick={() => toggleVerticalPanel({ source: "toolbar" })}
    >
      Toggle
    </button>
  );
};

const toggle = async (store: Store) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "toggle" }));
};
