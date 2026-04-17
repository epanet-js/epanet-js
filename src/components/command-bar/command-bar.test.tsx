import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import Mousetrap from "mousetrap";

import { Maybe } from "purify-ts/Maybe";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import { commandBarOpenAtom } from "src/state/command-bar";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { presets } from "src/lib/project-settings/quantities-spec";
import { Store } from "src/state";

const zoomToMock = vi.fn();
vi.mock("src/hooks/use-zoom-to", () => ({
  useZoomTo: () => zoomToMock,
}));

import { CommandBar } from "./command-bar";

describe("CommandBar", () => {
  beforeEach(() => {
    zoomToMock.mockReset();
    stubFeatureOn("FLAG_ASSET_SEARCH");
  });

  it("renders nothing when the atom is closed", () => {
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);

    renderComponent(store);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders the modal when open", () => {
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("opens via Ctrl+K", async () => {
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);

    renderComponent(store);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    Mousetrap.trigger("ctrl+k");

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(store.get(commandBarOpenAtom)).toBe(true);
  });

  it("does not render and ignores Ctrl+K when flag is off", () => {
    stubFeatureOff("FLAG_ASSET_SEARCH");
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    Mousetrap.trigger("ctrl+k");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters assets by label", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([
      { label: "P1", type: "pipe", id: 1 },
      { label: "P12", type: "pipe", id: 2 },
      { label: "J3", type: "junction", id: 3 },
      { label: "CP7", type: "customerPoint", id: 4 },
    ]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "P1");

    await waitFor(() => {
      expect(screen.getByText("P1")).toBeInTheDocument();
      expect(screen.getByText("P12")).toBeInTheDocument();
    });
    expect(screen.queryByText("J3")).not.toBeInTheDocument();
    expect(screen.queryByText("CP7")).not.toBeInTheDocument();
  });

  it("shows no results when nothing matches", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "ZZ");

    await waitFor(() =>
      expect(screen.getByText("No results")).toBeInTheDocument(),
    );
  });

  it("selects the asset, zooms, and closes on click", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "P1");
    await waitFor(() => screen.getByText("P1"));
    await user.click(screen.getByText("P1"));

    expect(store.get(selectionAtom)).toEqual({
      type: "single",
      id: 1,
      parts: [],
    });
    expect(zoomToMock).toHaveBeenCalledWith(
      { type: "single", id: 1, parts: [] },
      18,
    );
    expect(store.get(commandBarOpenAtom)).toBe(false);
  });

  it("selects a customer point and zooms to it on click", async () => {
    const user = userEvent.setup();
    const labelManager = new LabelManager();
    labelManager.register("CP7", "customerPoint", 42);
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aCustomerPoint(42, { label: "CP7", coordinates: [10, 20] })
      .build();
    const store = setInitialState({ hydraulicModel });
    store.set(
      modelFactoriesAtom,
      initializeModelFactories({
        idGenerator: new ConsecutiveIdsGenerator(),
        labelManager,
        defaults: presets.LPS.defaults,
      }),
    );
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "CP");
    await waitFor(() => screen.getByText("CP7"));
    await user.click(screen.getByText("CP7"));

    expect(store.get(selectionAtom)).toEqual({
      type: "singleCustomerPoint",
      id: 42,
    });
    expect(zoomToMock).toHaveBeenCalledWith(Maybe.of([10, 20, 10, 20]), 18);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "P");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(store.get(commandBarOpenAtom)).toBe(false));
  });

  it("closes when clicking the backdrop", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);
    store.set(commandBarOpenAtom, true);

    renderComponent(store);

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.firstElementChild as HTMLElement;
    await user.click(backdrop);

    await waitFor(() => expect(store.get(commandBarOpenAtom)).toBe(false));
  });
});

const setupWithLabels = (
  entries: Array<{
    label: string;
    type:
      | "pipe"
      | "junction"
      | "reservoir"
      | "tank"
      | "pump"
      | "valve"
      | "customerPoint";
    id: number;
  }>,
): { store: Store; labelManager: LabelManager } => {
  const labelManager = new LabelManager();
  entries.forEach((e) => labelManager.register(e.label, e.type, e.id));

  const hydraulicModel = HydraulicModelBuilder.with({ labelManager }).build();
  const store = setInitialState({ hydraulicModel });

  store.set(
    modelFactoriesAtom,
    initializeModelFactories({
      idGenerator: new ConsecutiveIdsGenerator(),
      labelManager,
      defaults: presets.LPS.defaults,
    }),
  );

  return { store, labelManager };
};

const renderComponent = (store: Store) => {
  render(
    <JotaiProvider store={store}>
      <TooltipProvider>
        <CommandBar />
      </TooltipProvider>
    </JotaiProvider>,
  );
};
