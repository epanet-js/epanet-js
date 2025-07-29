import { render, screen, waitFor } from "@testing-library/react";
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
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("AllocationStep", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_ALLOCATION");
  });

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

    expect(screen.getByText("Computing allocations...")).toBeInTheDocument();

    await waitForAllocations();

    expect(screen.getByText(/Allocation Summary/)).toBeInTheDocument();
    expect(
      screen.getByText(/customer points will be allocated/),
    ).toBeInTheDocument();
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
    },
    isLoading: false,
    error: null,
    isProcessing: false,
    keepDemands: false,
    allocationRules: [anAllocationRule()],
    connectionCounts: null,
    allocationResult: null,
    isAllocating: false,
    lastAllocatedRules: null,
  };

  store.set(wizardStateAtom, { ...defaultWizardState, ...overrides });
  return store;
};

const waitForAllocations = () => {
  return waitFor(() => {
    expect(
      screen.queryByText("Computing allocations..."),
    ).not.toBeInTheDocument();
  });
};

const renderWizard = (store: Store) => {
  return render(
    <JotaiProvider store={store}>
      <ImportCustomerPointsWizard isOpen={true} onClose={() => {}} />
    </JotaiProvider>,
  );
};
