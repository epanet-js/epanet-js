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
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { stubElevation } from "src/map/test/__helpers__/elevations";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { CrossingPipes } from "./crossing-pipes";

vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => vi.fn() }));

let isEditionBlocked = false;
vi.mock("src/hooks/use-is-edition-blocked", () => ({
  useIsEditionBlocked: () => isEditionBlocked,
}));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
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

beforeEach(() => {
  isEditionBlocked = false;
  stubElevation({ lng: 5, lat: 0 }, 42);
});

const renderPanel = (store: Store) => {
  render(
    <JotaiProvider store={store}>
      <TooltipProvider>
        <CrossingPipes onGoBack={vi.fn()} />
      </TooltipProvider>
    </JotaiProvider>,
  );
};

// Two pipes crossing at [5, 0] without a shared node.
const IDS = { A1: 1, A2: 2, PA: 3, B1: 4, B2: 5, PB: 6 } as const;
const IDS2 = { C1: 7, C2: 8, PC: 9, D1: 10, D2: 11, PD: 12 } as const;

const aModelWithCrossingPipes = () =>
  HydraulicModelBuilder.with()
    .aNode(IDS.A1, [0, 0])
    .aNode(IDS.A2, [10, 0])
    .aPipe(IDS.PA, { startNodeId: IDS.A1, endNodeId: IDS.A2, label: "PA" })
    .aNode(IDS.B1, [5, -5])
    .aNode(IDS.B2, [5, 5])
    .aPipe(IDS.PB, { startNodeId: IDS.B1, endNodeId: IDS.B2, label: "PB" })
    .build();

// Two independent crossings, so archiving one leaves one active.
const aModelWithTwoCrossings = () =>
  HydraulicModelBuilder.with()
    .aNode(IDS.A1, [0, 0])
    .aNode(IDS.A2, [10, 0])
    .aPipe(IDS.PA, { startNodeId: IDS.A1, endNodeId: IDS.A2, label: "PA" })
    .aNode(IDS.B1, [5, -5])
    .aNode(IDS.B2, [5, 5])
    .aPipe(IDS.PB, { startNodeId: IDS.B1, endNodeId: IDS.B2, label: "PB" })
    .aNode(IDS2.C1, [100, 0])
    .aNode(IDS2.C2, [110, 0])
    .aPipe(IDS2.PC, { startNodeId: IDS2.C1, endNodeId: IDS2.C2, label: "PC" })
    .aNode(IDS2.D1, [105, -5])
    .aNode(IDS2.D2, [105, 5])
    .aPipe(IDS2.PD, { startNodeId: IDS2.D1, endNodeId: IDS2.D2, label: "PD" })
    .build();

const listElement = () =>
  screen.getByRole("list").parentElement!.parentElement!;

// Asset ids are reassigned when a moment is applied, so a split is observed
// through the segment labels each original pipe produces.
const pipeLabels = (store: Store) =>
  [...store.get(stagingModelDerivedAtom).assets.values()]
    .filter((asset) => asset.type === "pipe")
    .map((asset) => asset.label)
    .sort();

// Suffixes come from the shared label manager, so assert the shape rather than
// exact names: each original pipe becomes two segments keeping its base label.
const expectBothPipesSplit = (store: Store) => {
  const labels = pipeLabels(store);
  expect(labels).toHaveLength(4);
  expect(labels.filter((label) => label.startsWith("PA"))).toHaveLength(2);
  expect(labels.filter((label) => label.startsWith("PB"))).toHaveLength(2);
};

describe("CrossingPipes panel fix action", () => {
  it("does not render a fix action when the flag is off", async () => {
    stubFeatureOff("FLAG_FIX_CROSSING_PIPES");
    renderPanel(setInitialState({ hydraulicModel: aModelWithCrossingPipes() }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: /connect/i })).toBeNull();
  });

  it("splits both pipes at the crossing", async () => {
    stubFeatureOn("FLAG_FIX_CROSSING_PIPES");
    const store = setInitialState({
      hydraulicModel: aModelWithCrossingPipes(),
    });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      expectBothPipesSplit(store);
    });
  });

  it("gives the new junction the fetched elevation", async () => {
    stubFeatureOn("FLAG_FIX_CROSSING_PIPES");
    const store = setInitialState({
      hydraulicModel: aModelWithCrossingPipes(),
    });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /connect/i }));

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      const junctions = [...model.assets.values()].filter(
        (asset) =>
          asset.type === "junction" &&
          asset.coordinates[0] === 5 &&
          asset.coordinates[1] === 0,
      );
      expect(junctions).toHaveLength(1);
      expect((junctions[0] as { elevation: number }).elevation).toEqual(42);
    });
  });

  it("connects the crossing when pressing Enter", async () => {
    stubFeatureOn("FLAG_FIX_CROSSING_PIPES");
    const store = setInitialState({
      hydraulicModel: aModelWithCrossingPipes(),
    });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /crosses pipe/i }));
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await waitFor(() => {
      expectBothPipesSplit(store);
    });
  });

  it("does not fix via Enter while edition is blocked", async () => {
    stubFeatureOn("FLAG_FIX_CROSSING_PIPES");
    isEditionBlocked = true;
    const store = setInitialState({
      hydraulicModel: aModelWithCrossingPipes(),
    });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /crosses pipe/i }));
    fireEvent.keyDown(listElement(), { key: "Enter" });

    // The fix resolves an elevation promise before transacting, so a `waitFor`
    // on "nothing changed" would pass on its first tick regardless. Let the
    // promise settle, then assert once.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(pipeLabels(store)).toEqual(["PA", "PB"]);
  });

  describe("archiving items", () => {
    const renderTwoCrossings = () => {
      stubFeatureOn("FLAG_FIX_CROSSING_PIPES");
      const store = setInitialState({
        hydraulicModel: aModelWithTwoCrossings(),
      });
      renderPanel(store);
      return store;
    };

    const archiveFirst = () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: /crosses pipe/i })[0],
      );
      fireEvent.keyDown(listElement(), { key: "Delete" });
    };

    it("drops the archived item out of the header count", async () => {
      renderTwoCrossings();

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });

      archiveFirst();

      await waitFor(() => {
        expect(screen.getByText("1 intersection found")).toBeInTheDocument();
      });
    });

    it("does not delete any asset when archiving", async () => {
      const store = renderTwoCrossings();

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });
      const assetsBefore = store.get(stagingModelDerivedAtom).assets.size;

      archiveFirst();

      await waitFor(() => {
        expect(screen.getByText("1 intersection found")).toBeInTheDocument();
      });
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(
        assetsBefore,
      );
    });

    it("shows a collapsed archived section only once something is archived", async () => {
      renderTwoCrossings();

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /archived/i })).toBeNull();

      archiveFirst();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /archived/i }),
        ).toHaveAttribute("aria-expanded", "false");
      });
    });

    it("restores an archived item back into the count", async () => {
      renderTwoCrossings();

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });

      archiveFirst();

      await waitFor(() => {
        expect(screen.getByText("1 intersection found")).toBeInTheDocument();
      });

      // The archived row lives past the ~2 rows jsdom's zero-height container
      // renders, so restore is driven by keyboard: down to the section header,
      // Enter to expand, down onto the row, Enter to restore.
      const list = listElement();
      fireEvent.keyDown(list, { key: "ArrowDown" });
      fireEvent.keyDown(list, { key: "Enter" });
      fireEvent.keyDown(list, { key: "ArrowDown" });
      fireEvent.keyDown(list, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });
    });

    it("drops the header highlight once a row is selected", async () => {
      renderTwoCrossings();

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });

      archiveFirst();

      const header = await screen.findByRole("button", { name: /archived/i });
      fireEvent.keyDown(listElement(), { key: "ArrowDown" });

      await waitFor(() => {
        expect(header).toHaveClass("bg-accent-tint");
      });

      fireEvent.click(
        screen.getAllByRole("button", { name: /crosses pipe/i })[0],
      );

      await waitFor(() => {
        expect(header).not.toHaveClass("bg-accent-tint");
      });
    });

    it("clears the row selection when the header takes focus", async () => {
      const store = renderTwoCrossings();

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });

      archiveFirst();

      await waitFor(() => {
        expect(store.get(selectionAtom).asset.length).toBeGreaterThan(0);
      });

      fireEvent.keyDown(listElement(), { key: "ArrowDown" });

      await waitFor(() => {
        expect(store.get(selectionAtom).asset).toEqual([]);
      });
      expect(screen.getByRole("button", { name: /archived/i })).toHaveClass(
        "bg-accent-tint",
      );
    });

    it("archives nothing when the flag is off", async () => {
      stubFeatureOff("FLAG_FIX_CROSSING_PIPES");
      setInitialState({ hydraulicModel: aModelWithTwoCrossings() });
      renderPanel(
        setInitialState({ hydraulicModel: aModelWithTwoCrossings() }),
      );

      await waitFor(() => {
        expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getAllByRole("button", { name: /crosses pipe/i })[0],
      );
      fireEvent.keyDown(listElement(), { key: "Delete" });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.getByText("2 intersections found")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /archived/i })).toBeNull();
    });
  });
});
