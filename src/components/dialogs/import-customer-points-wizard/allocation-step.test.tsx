import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { Store } from "src/state/jotai";
import { setInitialState } from "src/__helpers__/state";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { anAllocationRule } from "src/__helpers__/hydraulic-model-builder";
import { ImportCustomerPointsWizard } from "./index";
import { wizardStateAtom } from "./use-wizard-state";
import { WizardState } from "./types";
import { MemPersistence } from "src/lib/persistence/memory";
import { PersistenceContext } from "src/lib/persistence/context";
import { UIDMap } from "src/lib/id-mapper";
import { vi } from "vitest";

// Mock projections hook directly
vi.mock("src/hooks/use-projections", () => ({
  useProjections: vi.fn(() => ({
    projections: new Map([
      [
        "EPSG:4326",
        {
          id: "EPSG:4326",
          name: "WGS 84",
          code: "+proj=longlat +datum=WGS84 +no_defs",
        },
      ],
    ]),
    loading: false,
    error: null,
  })),
}));

describe("AllocationStep", () => {
  it("renders allocation step with default wizard state", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    setWizardState(store, { lastAllocatedRules: [anAllocationRule()] });
    renderWizard(store);

    await waitForAllocations();

    expect(
      screen.getByRole("tab", {
        name: /customers allocation/i,
        current: "step",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Max Diameter (mm)")).toBeInTheDocument();
    expect(screen.getByText("Max Distance (m)")).toBeInTheDocument();
    expect(screen.getByText("Order")).toBeInTheDocument();
  });

  it("automatically runs initial allocation on first visit", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    setWizardState(store, { lastAllocatedRules: null });
    renderWizard(store);

    await waitForAllocations();

    expect(screen.getByText(/Allocation Summary/)).toBeInTheDocument();
    expect(
      screen.getByText(/customer points will be allocated/),
    ).toBeInTheDocument();
  });

  it("updates allocation summary when rules are changed", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      lastAllocatedRules: [anAllocationRule({ maxDistance: 10 })],
      allocationResult: {
        ruleMatches: [1],
        allocatedCustomerPoints: new Map(),
        disconnectedCustomerPoints: new Map(),
      },
      connectionCounts: { 0: 1 },
    });
    renderWizard(store);

    await waitForAllocations();

    await user.click(screen.getByRole("button", { name: /edit/i }));

    const distanceField = screen.getByLabelText("Value for: Max Distance");
    await user.clear(distanceField);
    await user.type(distanceField, "50");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitForAllocations();

    expect(screen.getByText(/Allocation Summary/)).toBeInTheDocument();
    expect(
      screen.getByText(/customer points will be allocated/),
    ).toBeInTheDocument();
  });

  it("disables edit button while allocating", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      lastAllocatedRules: [anAllocationRule({ maxDistance: 10 })],
      isAllocating: true,
    });
    renderWizard(store);

    const editButton = screen.getByRole("button", { name: /edit/i });
    expect(editButton).toBeDisabled();
  });

  it("disables navigation and hides action buttons while allocating", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      lastAllocatedRules: [anAllocationRule({ maxDistance: 10 })],
      isAllocating: true,
    });
    renderWizard(store);

    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();

    // Apply Changes button should be hidden during allocation
    expect(
      screen.queryByRole("button", { name: /apply changes/i }),
    ).not.toBeInTheDocument();
  });

  it("disables navigation and hides action buttons while editing rules", async () => {
    const user = userEvent.setup();
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    setWizardState(store, {
      lastAllocatedRules: [anAllocationRule({ maxDistance: 10 })],
    });
    renderWizard(store);

    await waitForAllocations();

    const navigation = screen.getByRole("navigation", {
      name: "wizard actions",
    });
    const backButton = within(navigation).getByRole("button", {
      name: /back/i,
    });

    // Apply Changes button should be visible initially
    expect(
      within(navigation).getByRole("button", { name: /apply changes/i }),
    ).toBeInTheDocument();
    expect(backButton).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(backButton).toBeDisabled();

    // Apply Changes button should be hidden during editing
    expect(
      within(navigation).queryByRole("button", { name: /apply changes/i }),
    ).not.toBeInTheDocument();
  });

  it("shows loading spinners in allocations column while allocating", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    setWizardState(store, {
      allocationRules: [anAllocationRule(), anAllocationRule()],
      isAllocating: true,
    });
    renderWizard(store);

    const allocationHeaders = screen.getAllByText("Allocations");
    expect(allocationHeaders).toHaveLength(1);

    const loadingSpinners = screen.getAllByTestId("allocation-loading");
    expect(loadingSpinners).toHaveLength(2);

    loadingSpinners.forEach((spinner) => {
      expect(spinner).toHaveClass("animate-spin");
    });
  });
});

const setWizardState = (store: Store, overrides: Partial<WizardState> = {}) => {
  const defaultWizardState: WizardState = {
    currentStep: 4,
    selectedFile: null,
    parsedCustomerPoints: null,
    parsedDataSummary: {
      validCustomerPoints: [buildCustomerPoint("1"), buildCustomerPoint("2")],
      issues: null,
      totalCount: 2,
      demandImportUnit: "l/d",
    },
    inputData: null,
    selectedDemandProperty: "demand",
    isLoading: false,
    error: null,
    isProcessing: false,
    keepDemands: false,
    allocationRules: [anAllocationRule()],
    connectionCounts: null,
    allocationResult: null,
    isAllocating: false,
    lastAllocatedRules: null,
    isEditingRules: false,
  };

  act(() => {
    store.set(wizardStateAtom, { ...defaultWizardState, ...overrides });
  });
  return store;
};

const waitForAllocations = () => {
  return waitFor(() => {
    expect(screen.queryByText(/Loading\.\.\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Computing allocations/)).not.toBeInTheDocument();
  });
};

const renderWizard = (store: Store) => {
  const persistence = new MemPersistence(UIDMap.empty(), store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <ImportCustomerPointsWizard isOpen={true} onClose={() => {}} />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};
