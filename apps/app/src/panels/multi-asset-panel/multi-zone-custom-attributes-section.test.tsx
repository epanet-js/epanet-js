import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { Store } from "src/state";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { branchStateAtom } from "src/state/branch-state";
import { initialSimulationState } from "src/state/simulation";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { SessionHistory } from "src/lib/persistence/session-history";
import { PersistenceContext } from "src/lib/persistence/context";
import { Persistence } from "src/lib/persistence/persistence";
import { MultiZoneCustomAttributesSection } from "./multi-zone-custom-attributes-section";

const IDS = { Z1: 1, Z2: 2 };

const aZone = (id: number, value?: number) => {
  const customAttributes: Record<string, number> =
    value === undefined ? {} : { "custom-1": value };
  return {
    id,
    label: `Z${id}`,
    geometry: { type: "MultiPolygon" as const, coordinates: [] },
    bbox: [0, 0, 1, 1] as [number, number, number, number],
    customAttributes,
  };
};

const buildModel = (values: Record<number, number> = {}): HydraulicModel =>
  HydraulicModelBuilder.with()
    .aCustomAttribute("zone", {
      id: "custom-1",
      label: "Area",
      type: "number",
    })
    .aZone(aZone(IDS.Z1, values[IDS.Z1]))
    .aZone(aZone(IDS.Z2, values[IDS.Z2]))
    .build();

const setInitialState = (
  hydraulicModel: HydraulicModel = buildModel(),
): Store => {
  const store = createStore();
  store.set(stagingModelDerivedAtom, hydraulicModel);
  store.set(
    branchStateAtom,
    new Map([
      [
        "main",
        {
          version: hydraulicModel.version,
          hydraulicModel,
          labelManager: new LabelManager(),
          sessionHistory: new SessionHistory(),
          simulation: initialSimulationState,
          simulationSourceId: "main",
          simulationSettings: defaultSimulationSettings,
        },
      ],
    ]),
  );
  return store;
};

const renderSection = (store: Store, zoneIds: number[]) => {
  const persistence = new Persistence(store);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={persistence}>
          <TooltipProvider>
            <MultiZoneCustomAttributesSection zoneIds={zoneIds} />
          </TooltipProvider>
        </PersistenceContext.Provider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
};

describe("MultiZoneCustomAttributesSection", () => {
  it("shows the section with the custom attribute field", () => {
    const store = setInitialState();
    renderSection(store, [IDS.Z1, IDS.Z2]);

    expect(screen.getByText("Custom attributes")).toBeInTheDocument();
    expect(screen.getByLabelText(/value for: Area/i)).toBeInTheDocument();
  });

  it("shows a mixed placeholder and computes stats lazily on open", async () => {
    const store = setInitialState(buildModel({ [IDS.Z1]: 10, [IDS.Z2]: 20 }));
    renderSection(store, [IDS.Z1, IDS.Z2]);

    expect(screen.getByPlaceholderText("2 values")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /stats for: Area/i }),
    );

    const minField = screen.getByLabelText<HTMLInputElement>(/value for: min/i);
    const maxField = screen.getByLabelText<HTMLInputElement>(/value for: max/i);
    expect(minField.value).toMatch(/^10(\.0+)?$/);
    expect(maxField.value).toMatch(/^20(\.0+)?$/);
  });

  it("writes the edited value to every selected zone", async () => {
    const store = setInitialState();
    renderSection(store, [IDS.Z1, IDS.Z2]);

    const input = screen.getByLabelText(/value for: Area/i);
    await userEvent.click(input);
    await userEvent.keyboard("99{Enter}");

    await waitFor(() => {
      const model = store.get(stagingModelDerivedAtom);
      expect(model.zones.get(IDS.Z1)!.getProperty("custom-1")).toBe(99);
      expect(model.zones.get(IDS.Z2)!.getProperty("custom-1")).toBe(99);
    });
  });
});
