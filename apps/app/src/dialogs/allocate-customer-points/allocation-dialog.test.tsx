import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("src/lib/customer-points", () => ({
  allocateCustomerPoints: vi.fn(),
}));

describe("AllocationDialog", () => {
  it("renders dialog with diameter-based rules table", async () => {
    const store = setupWithDisconnectedCPs(2);
    renderDialog(store);

    await waitForAllocations();

    expect(screen.getByText("Max diameter (mm)")).toBeInTheDocument();
    expect(screen.getByText("Max distance (m)")).toBeInTheDocument();
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
