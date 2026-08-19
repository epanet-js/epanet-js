import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState, aMultiSelection } from "src/__helpers__/state";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { AllocationDialog } from "./allocation-dialog";
import { useAllocateCustomerPointsState } from "./wizard-state";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { vi } from "vitest";
import { allocateCustomerPoints } from "src/lib/customer-points";
import { Store } from "src/state";
import { projectSettingsAtom } from "src/state/project-settings";
import { presets } from "@epanet-js/project-settings";

vi.mock("src/lib/customer-points", async (importActual) => ({
  ...(await importActual<typeof import("src/lib/customer-points")>()),
  allocateCustomerPoints: vi.fn(),
}));

describe("AllocationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog with diameter-based rules table", async () => {
    const store = setupWithDisconnectedCPs(2);
    renderDialog(store);

    await waitForAllocations();

    expect(screen.getByText("Max diameter (mm)")).toBeInTheDocument();
    expect(screen.getByText("Max distance (m)")).toBeInTheDocument();
  });

  it("allocates using max distance in meters", async () => {
    const store = setupWithDisconnectedCPs(2);
    renderDialog(store);

    await waitForAllocations();

    expect(allocateCustomerPoints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        allocationRules: [{ maxDistance: 100, maxDiameter: 300 }],
      }),
    );
  });

  it("converts max distance to meters when displayed in feet", async () => {
    const store = setupWithDisconnectedCPs(2);
    store.set(projectSettingsAtom, {
      ...store.get(projectSettingsAtom),
      units: presets.GPM.units,
    });
    renderDialog(store);

    await waitForAllocations();

    expect(screen.getByText("Max distance (ft)")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
    expect(allocateCustomerPoints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        allocationRules: [
          expect.objectContaining({
            maxDistance: expect.closeTo(97.536, 3),
          }),
        ],
      }),
    );
  });

  it("adds new rules with the defaults of the project units", async () => {
    const store = setupWithDisconnectedCPs(2);
    store.set(projectSettingsAtom, {
      ...store.get(projectSettingsAtom),
      units: presets.GPM.units,
    });
    renderDialog(store);

    await waitForAllocations();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: /Add rule/ }));

    const diameters = screen.getAllByLabelText("Value for: Max diameter");
    const distances = screen.getAllByLabelText("Value for: Max distance");
    expect(diameters[1]).toHaveValue("12");
    expect(distances[1]).toHaveValue("320");
  });

  it("automatically runs initial allocation on mount", async () => {
    const store = setupWithDisconnectedCPs(2);
    renderDialog(store);

    await waitForAllocations();

    expect(
      screen.getByText(/customer points will be allocated/),
    ).toBeInTheDocument();
  });

  it("summary displays two significant decimal places", async () => {
    const totalCount = 10000;
    const allocatedCount = 1234;

    const customerPoints = Array.from({ length: totalCount }, (_, i) =>
      buildCustomerPoint(i + 1),
    );

    vi.mocked(allocateCustomerPoints).mockResolvedValue({
      ruleMatches: [allocatedCount],
      allocatedCustomerPoints: new Map(
        customerPoints.slice(0, allocatedCount).map((cp) => [cp.id, cp]),
      ),
      disconnectedCustomerPoints: new Map(
        customerPoints.slice(allocatedCount).map((cp) => [cp.id, cp]),
      ),
      customerPointsMatchedToZone: 0,
    });

    const builder = HydraulicModelBuilder.with();
    customerPoints.forEach((cp) => builder.aCustomerPoint(cp.id));
    builder.aPipe(PIPE_ID);
    const store = setInitialState({
      hydraulicModel: builder.build(),
      selection: aMultiSelection({ ids: [PIPE_ID] }),
    });
    renderDialog(store);

    await waitForAllocations();

    expect(
      screen.getByText(/1,234 customer points will be allocated \(12\.34%\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/8,766 customer points remain unallocated \(87\.66%\)/),
    ).toBeInTheDocument();
  });

  it("summary does not display decimal if not needed", async () => {
    const totalCount = 20;
    const allocatedCount = 19;

    const customerPoints = Array.from({ length: totalCount }, (_, i) =>
      buildCustomerPoint(i + 1),
    );

    vi.mocked(allocateCustomerPoints).mockResolvedValue({
      ruleMatches: [allocatedCount],
      allocatedCustomerPoints: new Map(
        customerPoints.slice(0, allocatedCount).map((cp) => [cp.id, cp]),
      ),
      disconnectedCustomerPoints: new Map(
        customerPoints.slice(allocatedCount).map((cp) => [cp.id, cp]),
      ),
      customerPointsMatchedToZone: 0,
    });

    const builder = HydraulicModelBuilder.with();
    customerPoints.forEach((cp) => builder.aCustomerPoint(cp.id));
    builder.aPipe(PIPE_ID);
    const store = setInitialState({
      hydraulicModel: builder.build(),
      selection: aMultiSelection({ ids: [PIPE_ID] }),
    });
    renderDialog(store);

    await waitForAllocations();

    expect(
      screen.getByText(/19 customer points will be allocated \(95%\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 customer points remain unallocated \(5%\)/),
    ).toBeInTheDocument();
  });

  it("summary displays only one decimal place when needed", async () => {
    const totalCount = 1000;
    const allocatedCount = 234;

    const customerPoints = Array.from({ length: totalCount }, (_, i) =>
      buildCustomerPoint(i + 1),
    );

    vi.mocked(allocateCustomerPoints).mockResolvedValue({
      ruleMatches: [allocatedCount],
      allocatedCustomerPoints: new Map(
        customerPoints.slice(0, allocatedCount).map((cp) => [cp.id, cp]),
      ),
      disconnectedCustomerPoints: new Map(
        customerPoints.slice(allocatedCount).map((cp) => [cp.id, cp]),
      ),
      customerPointsMatchedToZone: 0,
    });

    const builder = HydraulicModelBuilder.with();
    customerPoints.forEach((cp) => builder.aCustomerPoint(cp.id));
    builder.aPipe(PIPE_ID);
    const store = setInitialState({
      hydraulicModel: builder.build(),
      selection: aMultiSelection({ ids: [PIPE_ID] }),
    });
    renderDialog(store);

    await waitForAllocations();

    expect(
      screen.getByText(/234 customer points will be allocated \(23\.4%\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/766 customer points remain unallocated \(76\.6%\)/),
    ).toBeInTheDocument();
  });
});

describe("excluded pipes warning", () => {
  const IDS = { J1: 1, J2: 2, OK: 10, INACTIVE: 11, NO_DIAMETER: 12 } as const;

  const setupWithExcludablePipes = () => {
    vi.mocked(allocateCustomerPoints).mockResolvedValue({
      ruleMatches: [0],
      allocatedCustomerPoints: new Map(),
      disconnectedCustomerPoints: new Map(),
      customerPointsMatchedToZone: 0,
    });

    return HydraulicModelBuilder.with()
      .aCustomerPoint(1)
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.OK, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
      })
      .aPipe(IDS.INACTIVE, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
        isActive: false,
      })
      .aPipe(IDS.NO_DIAMETER, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: null,
      })
      .build();
  };

  it("warns about pipes excluded across the whole network", async () => {
    const store = setInitialState({
      hydraulicModel: setupWithExcludablePipes(),
    });
    renderDialog(store);

    await waitForAllocations();

    expect(screen.getByText("Some pipes are excluded")).toBeInTheDocument();
    expect(
      screen.getByText(
        "2 pipes are missing diameter data or are inactive and won't be allocated.",
      ),
    ).toBeInTheDocument();
  });

  it("ignores inactive pipes wider than the max diameter of the rules", async () => {
    const WIDE_INACTIVE = 13;

    vi.mocked(allocateCustomerPoints).mockResolvedValue({
      ruleMatches: [0],
      allocatedCustomerPoints: new Map(),
      disconnectedCustomerPoints: new Map(),
      customerPointsMatchedToZone: 0,
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomerPoint(1)
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.OK, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
      })
      .aPipe(IDS.INACTIVE, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
        isActive: false,
      })
      .aPipe(WIDE_INACTIVE, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 500,
        isActive: false,
      })
      .build();

    renderDialog(setInitialState({ hydraulicModel }));

    await waitForAllocations();

    expect(
      screen.getByText(
        "1 pipe is missing diameter data or is inactive and won't be allocated.",
      ),
    ).toBeInTheDocument();
  });

  it("does not warn when every pipe is allocatable", async () => {
    vi.mocked(allocateCustomerPoints).mockResolvedValue({
      ruleMatches: [0],
      allocatedCustomerPoints: new Map(),
      disconnectedCustomerPoints: new Map(),
      customerPointsMatchedToZone: 0,
    });

    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomerPoint(1)
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.OK, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
      })
      .build();

    renderDialog(setInitialState({ hydraulicModel }));

    await waitForAllocations();

    expect(
      screen.queryByText("Some pipes are excluded"),
    ).not.toBeInTheDocument();
  });

  it("re-evaluates against the selection when allocating over selected pipes", async () => {
    const store = setInitialState({
      hydraulicModel: setupWithExcludablePipes(),
      selection: aMultiSelection({ ids: [IDS.OK, IDS.INACTIVE] }),
    });
    renderDialog(store);

    await waitForAllocations();

    expect(
      screen.getByText(
        "2 pipes are missing diameter data or are inactive and won't be allocated.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Selected pipes only"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "1 pipe is missing diameter data or is inactive and won't be allocated.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Some pipes are excluded")).toBeInTheDocument();
  });
});

const PIPE_ID = 100;

const setupWithDisconnectedCPs = (count: number) => {
  const customerPoints = Array.from({ length: count }, (_, i) =>
    buildCustomerPoint(i + 1),
  );

  vi.mocked(allocateCustomerPoints).mockResolvedValue({
    ruleMatches: [count],
    allocatedCustomerPoints: new Map(customerPoints.map((cp) => [cp.id, cp])),
    disconnectedCustomerPoints: new Map(),
    customerPointsMatchedToZone: 0,
  });

  const builder = HydraulicModelBuilder.with();
  customerPoints.forEach((cp) => builder.aCustomerPoint(cp.id));
  builder.aPipe(PIPE_ID);
  return setInitialState({
    hydraulicModel: builder.build(),
    selection: aMultiSelection({ ids: [PIPE_ID] }),
  });
};

const waitForAllocations = () => {
  return waitFor(() => {
    expect(screen.queryByText(/Computing allocations/)).not.toBeInTheDocument();
  });
};

const AllocationDialogWrapper = () => {
  const state = useAllocateCustomerPointsState();
  return <AllocationDialog state={state} />;
};

const renderDialog = (store: Store) => {
  const persistence = new Persistence(store);

  return render(
    <JotaiProvider store={store}>
      <PersistenceContext.Provider value={persistence}>
        <AllocationDialogWrapper />
      </PersistenceContext.Provider>
    </JotaiProvider>,
  );
};
