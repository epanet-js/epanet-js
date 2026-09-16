import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { LabelManager } from "@epanet-js/hydraulic-model";
import { initializeModelFactoriesWithPools } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { buildIdPools } from "src/lib/id-pools";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";
import { PatternsDialog } from "./patterns-dialog";

const IDS = { J1: 1, PAT1: 1, PAT3: 3 } as const;

const aProjectWithAPatternIdGap = (withPools: boolean): Store => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aDemandPattern(IDS.PAT1, "PAT1", [1])
    .aDemandPattern(IDS.PAT3, "PAT3", [1])
    .build();
  const store = setInitialState({ hydraulicModel });
  store.set(
    modelFactoriesAtom,
    initializeModelFactoriesWithPools({
      idPools: buildIdPools(withPools, {
        asset: IDS.J1,
        pattern: IDS.PAT3,
        curve: IDS.J1,
        zone: IDS.J1,
      }),
      labelManager: new LabelManager(),
    }),
  );
  return store;
};

const renderDialog = (store: Store) =>
  render(
    <JotaiProvider store={store}>
      <PersistenceContext.Provider value={new Persistence(store)}>
        <PatternsDialog />
      </PersistenceContext.Provider>
    </JotaiProvider>,
  );

const addAPattern = async (label: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(/add demand pattern/i));
  await user.type(screen.getByLabelText("Value for: New pattern name"), label);
  await user.keyboard("{Enter}");
  await user.click(screen.getByText("Save"));
};

const patternIdsOf = (store: Store) => [
  ...store.get(stagingModelDerivedAtom).patterns.keys(),
];

describe("PatternsDialog id pools", () => {
  it("draws a new pattern from the pattern pool", async () => {
    stubFeatureOn("FLAG_ID_POOLS");
    const store = aProjectWithAPatternIdGap(true);
    renderDialog(store);

    await addAPattern("NEW");

    expect(patternIdsOf(store)).toEqual([IDS.PAT1, IDS.PAT3, IDS.PAT3 + 1]);
  });

  it("refills the gap left by a deleted pattern when the flag is off", async () => {
    stubFeatureOff("FLAG_ID_POOLS");
    const store = aProjectWithAPatternIdGap(false);
    renderDialog(store);

    await addAPattern("NEW");

    expect(patternIdsOf(store)).toEqual([IDS.PAT1, IDS.PAT3, 2]);
  });
});
