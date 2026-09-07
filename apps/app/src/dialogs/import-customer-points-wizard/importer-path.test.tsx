import type { Feature } from "geojson";
import { screen, waitFor } from "@testing-library/react";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { projectSettingsAtom } from "src/state/project-settings";
import { Store } from "src/state";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

const aPoint = (coordinates: [number, number], meter: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates },
  properties: { METER: meter },
});

const aFile = (features: Feature[]) =>
  new File(
    [JSON.stringify({ type: "FeatureCollection", features })],
    "customers.geojson",
    { type: "application/json" },
  );

const unprojected = (centroid: [number, number]) => ({
  ...defaultProjectSettings,
  projection: {
    type: "xy-grid" as const,
    id: "xy-grid",
    name: "XY Grid",
    centroid,
  },
});

const renderAt = (store: Store, features: Feature[]) => {
  setWizardState(store, {
    selectedFile: aFile(features),
    inputData: { properties: new Set(["METER"]) },
  });
  renderWizard(store);
};

describe("customer points wizard, on the importer", () => {
  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
    stubFeatureOn("FLAG_CUSTOMER_POINTS_IMPORTER");
  });

  it("reads a file through the importer", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    renderAt(store, [
      aPoint([0.001, 0.001], "M-1"),
      aPoint([0.002, 0.002], "M-2"),
    ]);

    await waitFor(() => {
      expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
    });
  });

  it("places local coordinates into a model that is not georeferenced", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });
    store.set(projectSettingsAtom, unprojected([1000, 2000]));

    renderAt(store, [aPoint([1000, 2000], "M-1"), aPoint([1200, 2400], "M-2")]);

    await waitFor(() => {
      expect(screen.getByText(/Customer points \(2\)/)).toBeInTheDocument();
    });
  });

  it("still refuses local coordinates in a georeferenced model", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().build(),
    });

    renderAt(store, [
      aPoint([432000, 5812000], "M-1"),
      aPoint([433000, 5813000], "M-2"),
    ]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
    expect(screen.queryByText(/Customer points \(2\)/)).not.toBeInTheDocument();
  });
});
