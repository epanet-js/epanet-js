import type { Feature } from "geojson";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubProjectionsReady } from "src/__helpers__/projections";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { buildIdPools } from "src/lib/id-pools";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import type { Store } from "src/state";
import { setWizardState } from "./__helpers__/wizard-state";
import { renderWizard } from "./__helpers__/render-wizard";

const POINT_COUNT = 20;
const CUSTOMER_POINT_SEED = 100;

const points = (): Feature[] =>
  Array.from({ length: POINT_COUNT }, (_, index) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [0.001 * (index + 1), 0.001 * (index + 1)],
    },
    properties: { value: index },
  }));

const aSourceFile = (features: Feature[]) =>
  new File(
    [JSON.stringify({ type: "FeatureCollection", features })],
    "test.geojson",
    { type: "application/json" },
  );

const aProject = async (): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aCustomerPoint(1, { coordinates: [1, 1], label: "OLD" })
    .build();
  const store = setInitialState({ hydraulicModel });
  store.set(
    modelFactoriesAtom,
    initializeModelFactories({
      idPools: buildIdPools({
        asset: 0,
        customerPoint: CUSTOMER_POINT_SEED,
        pattern: 0,
        curve: 0,
        zone: 0,
      }),
      labelManager: new LabelManager(),
    }),
  );
  await db.importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const importThroughWizard = async (store: Store) => {
  const user = userEvent.setup();
  setWizardState(store, {
    sourceFiles: [aSourceFile(points())],
    inputData: { properties: new Set(["value"]) },
  });
  renderWizard(store);

  expect(
    await screen.findByText(new RegExp(`Customer points \\(${POINT_COUNT}\\)`)),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /next/i }));
  await user.click(screen.getByRole("button", { name: /apply changes/i }));
};

describe("finishing the customer points import with a change set", () => {
  useInProcessDb();

  beforeEach(() => {
    stubUserTracking();
    stubProjectionsReady();
    stubFeatureOn("FLAG_CP_IMPORT_CHANGESET");
  });

  it("imports every point, not only the previewed ones", async () => {
    const store = await aProject();

    await importThroughWizard(store);

    await waitFor(() => {
      expect(store.get(stagingModelDerivedAtom).customerPoints.size).toBe(
        POINT_COUNT,
      );
    });
  });

  it("labels the imported points the way the preview showed them", async () => {
    const store = await aProject();

    await importThroughWizard(store);

    await waitFor(() => {
      const labels = [
        ...store.get(stagingModelDerivedAtom).customerPoints.values(),
      ].map(({ label }) => label);
      expect(labels.slice(0, 2)).toEqual(["CP1", "CP2"]);
    });
  });

  it("advances the customer point id pool", async () => {
    const store = await aProject();

    await importThroughWizard(store);

    await waitFor(() => {
      expect(store.get(stagingModelDerivedAtom).customerPoints.size).toBe(
        POINT_COUNT,
      );
    });
    expect(store.get(modelFactoriesAtom).idPools.newId("customerPoint")).toBe(
      CUSTOMER_POINT_SEED + POINT_COUNT + 1,
    );
  });
});
