import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubFeatureOff } from "src/__helpers__/feature-flags";
import { splitsAtom } from "src/state/layout";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import { panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useToggleLeftPanel } from "./toggle-left-panel";

const aStore = () => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, [createNetworkReviewPanel()]);
  return store;
};

beforeEach(() => {
  stubUserTracking();
  stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");
});

describe("useToggleLeftPanel", () => {
  it("opens the left panel when it is closed", async () => {
    const store = aStore();
    store.set(splitsAtom, (s) => ({ ...s, leftOpen: false }));

    await toggle(store);

    expect(store.get(splitsAtom).leftOpen).toBe(true);
  });

  it("closes the left panel when it is open", async () => {
    const store = aStore();
    store.set(splitsAtom, (s) => ({ ...s, leftOpen: true }));

    await toggle(store);

    expect(store.get(splitsAtom).leftOpen).toBe(false);
  });

  it("restores the default width when reopening after a resize", async () => {
    const store = aStore();
    store.set(splitsAtom, (s) => ({ ...s, leftOpen: false, left: 600 }));

    await toggle(store);

    expect(store.get(splitsAtom).left).not.toEqual(600);
  });
});

const Trigger = () => {
  const toggleLeftPanel = useToggleLeftPanel();
  return (
    <button
      aria-label="toggle"
      onClick={() => toggleLeftPanel({ source: "toolbar" })}
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
