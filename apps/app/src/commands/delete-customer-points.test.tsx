import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { Store } from "src/state";
import { screen, render } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { useDeleteCustomerPoints } from "./delete-customer-points";
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

describe("useDeleteCustomerPoints", () => {
  it("removes the given customer points and leaves the rest", async () => {
    const IDS = { CP1: 100, CP2: 101 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .aCustomerPoint(IDS.CP2, { coordinates: [1, 1] })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store, ids: [IDS.CP1] });

    await triggerCommand();

    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP1)).toBeFalsy();
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP2)).toBeTruthy();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "customerPointActions.removed",
      source: "data-table",
      count: 1,
    });
  });

  it("drops removed customer points from the selection but keeps the rest", async () => {
    const IDS = { J1: 1, CP1: 100, CP2: 101 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .aCustomerPoint(IDS.CP2, { coordinates: [1, 1] })
      .build();
    const selection = USelection.fromIds([IDS.J1], [IDS.CP1, IDS.CP2]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store, ids: [IDS.CP1] });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(USelection.getCustomerPointIds(updatedSelection)).toEqual([IDS.CP2]);
    expect(USelection.getAssetIds(updatedSelection)).toEqual([IDS.J1]);
  });

  it("keeps selected zones when removing selected customer points", async () => {
    const IDS = { CP1: 100, Z1: 1 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .aZone(aZone(IDS.Z1))
      .build();
    const selection = USelection.fromIds([], [IDS.CP1], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store, ids: [IDS.CP1] });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(USelection.getZoneIds(updatedSelection)).toEqual([IDS.Z1]);
  });

  it("does nothing for an empty list", async () => {
    const IDS = { CP1: 100 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store, ids: [] });

    await triggerCommand();

    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP1)).toBeTruthy();
    expect(userTracking.capture).not.toHaveBeenCalled();
  });

  const triggerCommand = async () => {
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
  };

  const TestableComponent = ({ ids }: { ids: number[] }) => {
    const deleteCustomerPoints = useDeleteCustomerPoints();

    return (
      <button
        aria-label="delete"
        onClick={() => {
          deleteCustomerPoints(ids, "data-table");
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
