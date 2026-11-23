import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import {
  buildCustomAttributeId,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { setInitialState } from "src/__helpers__/state";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";
import { CustomAttributesDialog } from "./custom-attributes-dialog";

const aProjectWithAJunctionAttribute = (): Store =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with()
      .aCustomAttribute("junction", {
        id: buildCustomAttributeId(1),
        label: "Zone",
        type: "text",
      })
      .build(),
  });

const renderDialog = (store: Store) =>
  render(
    <JotaiProvider store={store}>
      <PersistenceContext.Provider value={new Persistence(store)}>
        <CustomAttributesDialog initialAssetType="junction" />
      </PersistenceContext.Provider>
    </JotaiProvider>,
  );

const labelCell = (rowIndex: number) =>
  within(screen.getAllByRole("row").slice(1)[rowIndex]).getAllByRole(
    "gridcell",
  )[0];

const savedJunctionLabels = (store: Store) =>
  getAttributes(
    store.get(stagingModelDerivedAtom).customAttributes,
    "junction",
  ).map((attribute) => attribute.label);

describe("CustomAttributesDialog", () => {
  it("saves a name typed with spaces at either end without them", async () => {
    const user = userEvent.setup();
    const store = aProjectWithAJunctionAttribute();
    renderDialog(store);

    const cell = labelCell(0);
    await user.click(cell);
    await user.dblClick(cell);
    const input = within(cell).getByRole<HTMLInputElement>("textbox");
    await user.clear(input);
    await user.type(input, "  Area  ");
    await user.keyboard("{Tab}");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(savedJunctionLabels(store)).toEqual(["Area"]);
  });
});
