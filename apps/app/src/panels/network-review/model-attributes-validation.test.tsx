import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import { vi } from "vitest";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { Store } from "src/state";
import {
  modelAttributesValidationIssuesAtom,
  selectedReviewCheckAtom,
} from "src/state/network-review";
import { selectionAtom } from "src/state/selection";
import { dialogAtom } from "src/state/dialog";
import { USelection } from "src/selection";
import { CheckType } from "./common";
import { ModelAttributesValidation } from "./model-attributes-validation";

vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => vi.fn() }));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

let canValidateModelAttributes = true;
vi.mock("src/hooks/use-permissions", () => ({
  usePermissions: () => ({ canValidateModelAttributes }),
}));

// The shared ResizeObserver stub feeds react-virtual's measureElement an entry
// without a target; a no-op keeps the virtualized list from crashing in jsdom.
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

const renderPanel = (store: Store) => {
  render(
    <JotaiProvider store={store}>
      <TooltipProvider>
        <ModelAttributesValidation onGoBack={vi.fn()} />
      </TooltipProvider>
    </JotaiProvider>,
  );
};

describe("ModelAttributesValidation panel", () => {
  beforeEach(() => {
    canValidateModelAttributes = true;
  });

  it("computes issues and shows the count in the header", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", roughness: null })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    await waitFor(() => {
      expect(screen.getByText(/1 issue found/i)).toBeInTheDocument();
    });
    expect(store.get(modelAttributesValidationIssuesAtom)).toHaveLength(1);
  });

  it("shows the empty state when the model has no issues", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { roughness: 130 })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    await waitFor(() => {
      expect(
        screen.getByText(/your model attributes are valid/i),
      ).toBeInTheDocument();
    });
  });

  it("selects the affected entities and opens the group detail on click", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", roughness: null })
      .aPipe(2, { label: "P2", roughness: null })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    const groupRow = await screen.findByRole("button", {
      name: /roughness missing/i,
    });
    // The level-2 list shows the check title in its header.
    expect(screen.getByText("Model attributes")).toBeInTheDocument();

    fireEvent.click(groupRow);

    // Affected entities get selected...
    expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([1, 2]);
    // ...and we navigate to the detail (the check-title header is gone).
    expect(screen.queryByText("Model attributes")).not.toBeInTheDocument();
  });

  it("re-selects all affected entities from the detail header action", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", roughness: null })
      .aPipe(2, { label: "P2", roughness: null })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    const groupRow = await screen.findByRole("button", {
      name: /roughness missing/i,
    });
    fireEvent.click(groupRow);

    act(() => store.set(selectionAtom, USelection.none()));
    expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: /select/i }));

    expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([1, 2]);
  });

  it("returns to the issues list when deep-linked while inside a detail", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(1, { label: "P1", roughness: null })
      .aPipe(2, { label: "P2", roughness: null })
      .build();
    const store = setInitialState({ hydraulicModel });

    renderPanel(store);

    const groupRow = await screen.findByRole("button", {
      name: /roughness missing/i,
    });
    fireEvent.click(groupRow);
    // We are now inside the detail (the level-2 list header is gone).
    expect(screen.queryByText("Model attributes")).not.toBeInTheDocument();

    // Clicking "Fix issues" again deep-links to the check while it is open.
    act(() =>
      store.set(selectedReviewCheckAtom, CheckType.modelAttributesValidation),
    );

    // We are back on the issues list and the one-shot signal is consumed.
    await waitFor(() => {
      expect(screen.getByText("Model attributes")).toBeInTheDocument();
    });
    expect(store.get(selectedReviewCheckAtom)).toBeNull();
  });

  describe("without permission", () => {
    it("discloses the first issue and paywalls the rest behind an overlay", async () => {
      canValidateModelAttributes = false;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(1, { label: "P1", roughness: null })
        .aPipe(2, { label: "P2", roughness: 0 })
        .build();
      const store = setInitialState({ hydraulicModel });

      renderPanel(store);

      // The first group (missing roughness) is disclosed...
      const firstGroup = await screen.findByRole("button", {
        name: /roughness missing/i,
      });
      // ...the rest are rendered (dimmed under the overlay) but still route to
      // the paywall on click.
      const blockedGroup = screen.getByRole("button", {
        name: /must be positive/i,
      });

      // Clicking the disclosed issue opens the upgrade dialog, no selection.
      fireEvent.click(firstGroup);
      expect(store.get(dialogAtom)).toMatchObject({ type: "upgrade" });
      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([]);

      // Clicking a blocked issue also opens the upgrade dialog, no selection.
      act(() => store.set(dialogAtom, null));
      fireEvent.click(blockedGroup);
      expect(store.get(dialogAtom)).toMatchObject({ type: "upgrade" });
      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([]);
    });
  });
});
