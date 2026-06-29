import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import {
  emptyCustomAttributesDefinition,
  emptyCustomAttributesData,
  setAttributes,
  setValue,
  getValue,
  type CustomAttributesData,
} from "@epanet-js/custom-attributes";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Store } from "src/state";
import { selectionAtom } from "src/state/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { branchStateAtom } from "src/state/branch-state";
import {
  customAttributesDefinitionAtom,
  customAttributesDataAtom,
} from "src/state/custom-attributes";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { MomentLog } from "src/lib/persistence/moment-log";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { USelection } from "src/selection";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import FeatureEditor from "../feature-editor";

const IDS = { J1: 1, J2: 2 };

const buildModel = (): HydraulicModel =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { label: "J1" })
    .aJunction(IDS.J2, { label: "J2" })
    .build();

const setInitialState = ({
  store = createStore(),
  hydraulicModel = buildModel(),
  selectedAssetIds = [IDS.J1, IDS.J2],
  data = emptyCustomAttributesData(),
}: {
  store?: Store;
  hydraulicModel?: HydraulicModel;
  selectedAssetIds?: number[];
  data?: CustomAttributesData;
} = {}): Store => {
  store.set(stagingModelAtom, hydraulicModel);
  store.set(selectionAtom, USelection.fromAssetIds(selectedAssetIds));
  store.set(customAttributesDataAtom, data);
  store.set(
    branchStateAtom,
    new Map([
      [
        "main",
        {
          version: hydraulicModel.version,
          hydraulicModel,
          labelManager: new LabelManager(),
          momentLog: new MomentLog(),
          simulation: initialSimulationState,
          simulationSourceId: "main",
          simulationSettings: defaultSimulationSettings,
        },
      ],
    ]),
  );
  return store;
};

const withNumberAttribute = (store: Store) =>
  store.set(
    customAttributesDefinitionAtom,
    setAttributes(emptyCustomAttributesDefinition(), "junction", [
      { id: "ca-1", label: "Age", type: "number" },
    ]),
  );

const renderComponent = (store: Store) => {
  const persistence = new Persistence(store);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <FeatureEditor />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("MultiCustomAttributesSection", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOM_ATTRIBUTES");
  });

  it("shows the section after the model attributes section", () => {
    const store = setInitialState();
    withNumberAttribute(store);

    renderComponent(store);

    const customHeading = screen.getByText("Custom attributes");
    const modelHeading = screen.getByText("Model attributes");
    expect(customHeading).toBeInTheDocument();
    expect(
      modelHeading.compareDocumentPosition(customHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByLabelText(/value for: Age/i)).toBeInTheDocument();
  });

  it("does not show the section when the flag is off", () => {
    stubFeatureOff("FLAG_CUSTOM_ATTRIBUTES");
    const store = setInitialState();
    withNumberAttribute(store);

    renderComponent(store);

    expect(screen.queryByText("Custom attributes")).not.toBeInTheDocument();
  });

  it("does not show the section when the type has no attributes", () => {
    const store = setInitialState();
    store.set(
      customAttributesDefinitionAtom,
      setAttributes(emptyCustomAttributesDefinition(), "pipe", [
        { id: "ca-1", label: "Owner", type: "text" },
      ]),
    );

    renderComponent(store);

    expect(screen.queryByText("Custom attributes")).not.toBeInTheDocument();
  });

  it("shows the shared value when all selected assets match", () => {
    let data = emptyCustomAttributesData();
    data = setValue(data, "junction", IDS.J1, "ca-1", 42);
    data = setValue(data, "junction", IDS.J2, "ca-1", 42);
    const store = setInitialState({ data });
    withNumberAttribute(store);

    renderComponent(store);

    expect(screen.getByLabelText(/value for: Age/i)).toHaveValue("42");
  });

  it("shows a mixed placeholder and stats when values differ", async () => {
    let data = emptyCustomAttributesData();
    data = setValue(data, "junction", IDS.J1, "ca-1", 10);
    data = setValue(data, "junction", IDS.J2, "ca-1", 20);
    const store = setInitialState({ data });
    withNumberAttribute(store);

    renderComponent(store);

    expect(screen.getByPlaceholderText("2 values")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /stats for: Age/i }),
    );

    const minField = screen.getByLabelText<HTMLInputElement>(/value for: min/i);
    const maxField = screen.getByLabelText<HTMLInputElement>(/value for: max/i);
    expect(minField.value).toMatch(/^10(\.0+)?$/);
    expect(maxField.value).toMatch(/^20(\.0+)?$/);
  });

  it("writes the edited value to every selected asset", async () => {
    const store = setInitialState();
    withNumberAttribute(store);

    renderComponent(store);

    const input = screen.getByLabelText(/value for: Age/i);
    await userEvent.click(input);
    await userEvent.keyboard("99{Enter}");

    await waitFor(() => {
      const data = store.get(customAttributesDataAtom);
      expect(getValue(data, "junction", IDS.J1, "ca-1")).toBe(99);
      expect(getValue(data, "junction", IDS.J2, "ca-1")).toBe(99);
    });
  });
});
