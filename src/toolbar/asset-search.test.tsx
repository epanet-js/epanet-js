import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { vi } from "vitest";
import { TooltipProvider } from "@radix-ui/react-tooltip";

import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOff } from "src/__helpers__/feature-flags";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { presets } from "src/lib/project-settings/quantities-spec";
import { Store } from "src/state";

const zoomToMock = vi.fn();
vi.mock("src/hooks/use-zoom-to", () => ({
  useZoomTo: () => zoomToMock,
}));

import { AssetSearch } from "./asset-search";

describe("AssetSearch", () => {
  beforeEach(() => {
    stubFeatureOff("FLAG_STATE_REFACTOR");
    zoomToMock.mockReset();
  });

  it("filters assets by label after 2 characters", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([
      { label: "P1", type: "pipe", id: 1 },
      { label: "P12", type: "pipe", id: 2 },
      { label: "J3", type: "junction", id: 3 },
      { label: "CP7", type: "customerPoint", id: 4 },
    ]);

    renderComponent(store);

    const input = screen.getByRole("textbox");
    await user.type(input, "P1");

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

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "ZZ");

    await waitFor(() => {
      expect(screen.getByText("No results")).toBeInTheDocument();
    });
  });

  it("selects the asset and zooms to it on click", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "P1");
    await waitFor(() => screen.getByText("P1"));
    await user.click(screen.getByText("P1"));

    expect(store.get(selectionAtom)).toEqual({
      type: "single",
      id: 1,
      parts: [],
    });
    expect(zoomToMock).toHaveBeenCalledTimes(1);
    expect(zoomToMock).toHaveBeenCalledWith(
      { type: "single", id: 1, parts: [] },
      18,
    );
  });

  it("selects a customer point and zooms to it on click", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([
      { label: "CP7", type: "customerPoint", id: 42 },
    ]);

    renderComponent(store);

    await user.type(screen.getByRole("textbox"), "CP");
    await waitFor(() => screen.getByText("CP7"));
    await user.click(screen.getByText("CP7"));

    expect(store.get(selectionAtom)).toEqual({
      type: "singleCustomerPoint",
      id: 42,
    });
    expect(zoomToMock).toHaveBeenCalledWith(
      { type: "singleCustomerPoint", id: 42 },
      18,
    );
  });

  it("clears the input after a selection is committed", async () => {
    const user = userEvent.setup();
    const { store } = setupWithLabels([{ label: "P1", type: "pipe", id: 1 }]);

    renderComponent(store);

    const input = screen.getByRole("textbox");
    await user.type(input, "P1");
    await waitFor(() => screen.getByText("P1"));
    await user.click(screen.getByText("P1"));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("");
    });
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
        <AssetSearch />
      </TooltipProvider>
    </JotaiProvider>,
  );
};
