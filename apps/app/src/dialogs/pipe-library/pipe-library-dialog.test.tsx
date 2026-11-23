import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";
import { PipeLibraryDialog } from "./pipe-library-dialog";

const aProjectWithAMaterial = (): Store =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with()
      .aPipeMaterial({
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 120 },
          { age: 20, roughness: 90 },
        ],
      })
      .build(),
  });

const renderDialog = (store: Store) =>
  render(
    <JotaiProvider store={store}>
      <PersistenceContext.Provider value={new Persistence(store)}>
        <PipeLibraryDialog />
      </PersistenceContext.Provider>
    </JotaiProvider>,
  );

const selectCastIron = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByText("Cast Iron"));

const roughnessCell = (rowIndex: number) =>
  within(screen.getAllByRole("row").slice(1)[rowIndex]).getAllByRole(
    "gridcell",
  )[1];

const enterRoughness = async (
  user: ReturnType<typeof userEvent.setup>,
  rowIndex: number,
  value: string,
) => {
  const cell = roughnessCell(rowIndex);
  await user.click(cell);
  await user.dblClick(cell);
  const input = within(cell).getByRole<HTMLInputElement>("textbox");
  await user.clear(input);
  await user.keyboard(`${value}{Enter}`);
};

const roughnessShown = (rowIndex: number) =>
  within(roughnessCell(rowIndex)).getByRole<HTMLInputElement>("textbox").value;

const savedEntriesOf = (store: Store) =>
  store.get(stagingModelDerivedAtom).pipeMaterials[0].entries;

describe("PipeLibraryDialog invalid entries", () => {
  it("reverts a roughness of zero", async () => {
    stubFeatureOff("FLAG_MODEL_VALIDATIONS");
    const user = userEvent.setup();
    const store = aProjectWithAMaterial();
    renderDialog(store);
    await selectCastIron(user);

    await enterRoughness(user, 0, "0");

    expect(roughnessShown(0)).toEqual("120");
  });

  describe("with FLAG_MODEL_VALIDATIONS on", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_MODEL_VALIDATIONS");
    });

    it("keeps a roughness of zero and saves it after the warning", async () => {
      const user = userEvent.setup();
      const store = aProjectWithAMaterial();
      renderDialog(store);
      await selectCastIron(user);

      await enterRoughness(user, 0, "0");
      expect(roughnessShown(0)).toEqual("0");

      await user.click(screen.getByRole("button", { name: "Save" }));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(savedEntriesOf(store)).toEqual([
        { age: 0, roughness: 0 },
        { age: 20, roughness: 90 },
      ]);
    });
  });
});
