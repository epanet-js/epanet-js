import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import {
  LabelManager,
  initializeModelFactoriesWithPools,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { buildIdPools } from "src/lib/id-pools";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";
import { CurveLibraryDialog } from "./curves-dialog";

const IDS = { J1: 1, CUR1: 1, CUR3: 3, HANDED_OUT: 5 } as const;

const aProjectWhosePoolIsAhead = (withPools: boolean): Store => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aCurve({
      id: IDS.CUR1,
      label: "CUR1",
      points: [{ x: 0, y: 1 }],
      type: "volume",
    })
    .aCurve({
      id: IDS.CUR3,
      label: "CUR3",
      points: [{ x: 0, y: 1 }],
      type: "volume",
    })
    .build();
  const store = setInitialState({ hydraulicModel });
  store.set(
    modelFactoriesAtom,
    initializeModelFactoriesWithPools({
      idPools: buildIdPools(withPools, {
        asset: IDS.J1,
        pattern: IDS.J1,
        curve: IDS.HANDED_OUT,
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
        <CurveLibraryDialog />
      </PersistenceContext.Provider>
    </JotaiProvider>,
  );

const addACurve = async (label: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(/add tank volume curve/i));
  await user.type(screen.getByLabelText("Value for: New curve name"), label);
  await user.keyboard("{Enter}");
  await user.click(screen.getByText("Save"));
  const confirmSave = screen.queryByText("Save");
  if (confirmSave) await user.click(confirmSave);
};

const curveIdsOf = (store: Store) => [
  ...store.get(stagingModelDerivedAtom).curves.keys(),
];

describe("CurveLibraryDialog id pools", () => {
  it("never reuses an id the pool already handed out", async () => {
    stubFeatureOn("FLAG_ID_POOLS");
    const store = aProjectWhosePoolIsAhead(true);
    renderDialog(store);

    await addACurve("NEW");

    expect(curveIdsOf(store)).toEqual([IDS.CUR1, IDS.CUR3, IDS.HANDED_OUT + 1]);
  });

  it("reuses an id freed by a deletion when the flag is off", async () => {
    stubFeatureOff("FLAG_ID_POOLS");
    const store = aProjectWhosePoolIsAhead(false);
    renderDialog(store);

    await addACurve("NEW");

    expect(curveIdsOf(store)).toEqual([IDS.CUR1, IDS.CUR3, IDS.CUR3 + 1]);
  });
});
