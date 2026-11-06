import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { Store } from "src/state";
import { screen, render } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { useDeleteAssets } from "./delete-assets";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { USelection } from "src/selection";

const aZone = (id: number) => ({
  id,
  label: "NORTH",
  geometry: {
    type: "MultiPolygon" as const,
    coordinates: [
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    ],
  },
  bbox: [0, 0, 1, 1] as [number, number, number, number],
});

describe("useDeleteAssets", () => {
  it("removes the given assets and leaves the rest", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store, ids: [IDS.J1] });

    await triggerCommand();

    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.assets.has(IDS.J1)).toBeFalsy();
    expect(updatedHydraulicModel.assets.has(IDS.J2)).toBeTruthy();
  });

  it("drops removed assets from the selection but keeps the rest", async () => {
    const IDS = { J1: 1, J2: 2, CP1: 100, Z1: 10 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .aZone(aZone(IDS.Z1))
      .build();
    const selection = USelection.fromIds([IDS.J1, IDS.J2], [IDS.CP1], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store, ids: [IDS.J1] });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(USelection.getAssetIds(updatedSelection)).toEqual([IDS.J2]);
    expect(USelection.getCustomerPointIds(updatedSelection)).toEqual([IDS.CP1]);
    expect(USelection.getZoneIds(updatedSelection)).toEqual([IDS.Z1]);
  });

  const triggerCommand = async () => {
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
  };

  const TestableComponent = ({ ids }: { ids: number[] }) => {
    const deleteAssets = useDeleteAssets();

    return (
      <button
        aria-label="delete"
        onClick={() => {
          deleteAssets(ids, "data-table");
        }}
      >
        Delete
      </button>
    );
  };

  const renderComponent = ({ store, ids }: { store: Store; ids: number[] }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent ids={ids} />
      </CommandContainer>,
    );
  };
});
