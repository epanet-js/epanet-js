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
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { ProximityAnomalies } from "./proximity-anomalies";

vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => vi.fn() }));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

let isEditionBlocked = false;
vi.mock("src/hooks/use-is-edition-blocked", () => ({
  useIsEditionBlocked: () => isEditionBlocked,
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
});

const renderPanel = (store: Store) => {
  render(
    <JotaiProvider store={store}>
      <TooltipProvider>
        <ProximityAnomalies onGoBack={vi.fn()} />
      </TooltipProvider>
    </JotaiProvider>,
  );
};

// A pipe running past a junction that belongs to a separate short pipe. The
// junction sits a few centimetres off the long pipe, so it is reported but not
// connected to it.
const IDS = { A1: 1, A2: 2, LONG: 3, N1: 4, N2: 5, SHORT: 6 } as const;

const aModelWithAnAnomaly = () =>
  HydraulicModelBuilder.with()
    .aNode(IDS.A1, [0, 0])
    .aNode(IDS.A2, [0.001, 0])
    .aPipe(IDS.LONG, {
      startNodeId: IDS.A1,
      endNodeId: IDS.A2,
      label: "LONG",
    })
    .aNode(IDS.N1, [0.0005, 0.000002])
    .aNode(IDS.N2, [0.0005, 0.001])
    .aPipe(IDS.SHORT, {
      startNodeId: IDS.N1,
      endNodeId: IDS.N2,
      label: "SHORT",
    })
    .build();

// The row's own label is "Potential connection for ...", so the fix button has
// to be matched by exact name.
const listElement = () =>
  screen.getByRole("list").parentElement!.parentElement!;

const pipeLabels = (store: Store) =>
  [...store.get(stagingModelDerivedAtom).assets.values()]
    .filter((asset) => asset.type === "pipe")
    .map((asset) => asset.label)
    .sort();

// Suffixes come from the shared label manager, so assert the shape rather than
// exact names: the over-shooting pipe becomes two segments keeping its label.
const expectLongPipeSplit = (store: Store) => {
  const labels = pipeLabels(store);
  expect(labels).toHaveLength(3);
  expect(labels.filter((label) => label.startsWith("LONG"))).toHaveLength(2);
  expect(labels.filter((label) => label === "SHORT")).toHaveLength(1);
};

describe("ProximityAnomalies panel fix action", () => {
  it("does not render a fix action when the flag is off", async () => {
    stubFeatureOff("FLAG_FIX_PIPE_OVER_UNDER_SHOT");
    renderPanel(setInitialState({ hydraulicModel: aModelWithAnAnomaly() }));

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("splits the pipe at the node", async () => {
    stubFeatureOn("FLAG_FIX_PIPE_OVER_UNDER_SHOT");
    const store = setInitialState({ hydraulicModel: aModelWithAnAnomaly() });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expectLongPipeSplit(store);
    });
  });

  it("connects the node when pressing Enter", async () => {
    stubFeatureOn("FLAG_FIX_PIPE_OVER_UNDER_SHOT");
    const store = setInitialState({ hydraulicModel: aModelWithAnAnomaly() });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(
      screen.getAllByRole("listitem")[0].querySelector("button")!,
    );
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await waitFor(() => {
      expectLongPipeSplit(store);
    });
  });

  it("merges the nodes when the pipe undershoots instead of leaving a stub", async () => {
    stubFeatureOn("FLAG_FIX_PIPE_OVER_UNDER_SHOT");
    // STUB starts just past where LONG ends, so the connection point lands on
    // an existing node rather than partway along the pipe.
    const UNDER = { A: 1, B: 2, LONG: 3, N: 4, N2: 5, STUB: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(UNDER.A, [0, 0])
      .aNode(UNDER.B, [0.001, 0])
      .aPipe(UNDER.LONG, {
        startNodeId: UNDER.A,
        endNodeId: UNDER.B,
        label: "LONG",
      })
      .aNode(UNDER.N, [0.0010005, 0])
      .aNode(UNDER.N2, [0.0010005, 0.001])
      .aPipe(UNDER.STUB, {
        startNodeId: UNDER.N,
        endNodeId: UNDER.N2,
        label: "STUB",
      })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    });

    const nodeCountBefore = [
      ...store.get(stagingModelDerivedAtom).assets.values(),
    ].filter((asset) => !asset.isLink).length;

    fireEvent.click(screen.getAllByRole("button", { name: "Connect" })[0]);

    await waitFor(() => {
      const assets = [...store.get(stagingModelDerivedAtom).assets.values()];
      expect(assets.filter((asset) => !asset.isLink)).toHaveLength(
        nodeCountBefore - 1,
      );
      expect(assets.filter((asset) => asset.type === "pipe")).toHaveLength(2);
    });
  });

  it("merges when the connection point is near, not exactly on, an endpoint", async () => {
    stubFeatureOn("FLAG_FIX_PIPE_OVER_UNDER_SHOT");
    // N sits slightly before LONG's end and off to one side, so the projection
    // lands inside the segment about 5 cm short of B — close enough that adding
    // a node there would sit almost on top of it.
    const NEAR = { A: 1, B: 2, LONG: 3, N: 4, N2: 5, STUB: 6 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(NEAR.A, [0, 0])
      .aNode(NEAR.B, [0.001, 0])
      .aPipe(NEAR.LONG, {
        startNodeId: NEAR.A,
        endNodeId: NEAR.B,
        label: "LONG",
      })
      .aNode(NEAR.N, [0.00099955, 0.000003])
      .aNode(NEAR.N2, [0.00099955, 0.001])
      .aPipe(NEAR.STUB, {
        startNodeId: NEAR.N,
        endNodeId: NEAR.N2,
        label: "STUB",
      })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    });

    const nodeCountBefore = [
      ...store.get(stagingModelDerivedAtom).assets.values(),
    ].filter((asset) => !asset.isLink).length;

    fireEvent.click(screen.getAllByRole("button", { name: "Connect" })[0]);

    await waitFor(() => {
      const assets = [...store.get(stagingModelDerivedAtom).assets.values()];
      expect(assets.filter((asset) => !asset.isLink)).toHaveLength(
        nodeCountBefore - 1,
      );
      expect(assets.filter((asset) => asset.type === "pipe")).toHaveLength(2);
    });
  });

  it("does not fix via Enter while edition is blocked", async () => {
    stubFeatureOn("FLAG_FIX_PIPE_OVER_UNDER_SHOT");
    isEditionBlocked = true;
    const store = setInitialState({ hydraulicModel: aModelWithAnAnomaly() });
    renderPanel(store);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    fireEvent.click(
      screen.getAllByRole("listitem")[0].querySelector("button")!,
    );
    fireEvent.keyDown(listElement(), { key: "Enter" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(pipeLabels(store)).toEqual(["LONG", "SHORT"]);
  });
});
