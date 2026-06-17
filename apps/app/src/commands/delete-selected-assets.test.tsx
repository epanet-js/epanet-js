import { stagingModelAtom } from "src/state/hydraulic-model";
import { selectionAtom } from "src/state/selection";
import { Store } from "src/state";
import { screen, render } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import userEvent from "@testing-library/user-event";
import {
  aMultiSelection,
  aSingleSelection,
  nullSelection,
  setInitialState,
} from "src/__helpers__/state";
import { useDeleteSelection } from "./delete-selection";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { USelection } from "src/selection";

describe("delete selected", () => {
  it("deletes a single selection", async () => {
    const IDS = { J1: 1 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const selection = aSingleSelection({ id: IDS.J1 });
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const updatedHydraulicModel = store.get(stagingModelAtom);
    expect(updatedHydraulicModel.assets.has(IDS.J1)).toBeFalsy();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "asset.deleted",
      source: "shortcut",
      type: "junction",
    });
  });

  it("deletes multi selection", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .build();
    const selection = aMultiSelection({
      ids: [IDS.J1, IDS.J2],
    });
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const updatedHydraulicModel = store.get(stagingModelAtom);
    expect(updatedHydraulicModel.assets.has(IDS.J1)).toBeFalsy();
    expect(updatedHydraulicModel.assets.has(IDS.J2)).toBeFalsy();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "assets.deleted",
      source: "shortcut",
      count: 2,
    });
  });

  it("deletes a single customer point selection", async () => {
    const IDS = { CP1: 100 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .build();
    const selection = USelection.singleCustomerPoint(IDS.CP1);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const updatedHydraulicModel = store.get(stagingModelAtom);
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP1)).toBeFalsy();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "customerPointActions.removed",
      source: "shortcut",
      count: 1,
    });
  });

  it("deletes a mixed selection of assets and customer points", async () => {
    const IDS = { J1: 1, CP1: 100 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .build();
    const selection = USelection.fromIds([IDS.J1], [IDS.CP1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const updatedHydraulicModel = store.get(stagingModelAtom);
    expect(updatedHydraulicModel.assets.has(IDS.J1)).toBeFalsy();
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP1)).toBeFalsy();
    // A single asset alongside customer points is tracked as a bulk delete,
    // not as the single-asset event.
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "assets.deleted",
      source: "shortcut",
      count: 1,
    });
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "customerPointActions.removed",
      source: "shortcut",
      count: 1,
    });
  });

  it("removes a customer point connected to a pipe deleted in the same selection", async () => {
    const IDS = { J1: 1, J2: 2, P1: 10, CP1: 100 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [5, 0],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();
    const selection = USelection.fromIds([IDS.P1], [IDS.CP1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    // The pipe-delete moment disconnects the customer point while the
    // remove moment deletes it; merged, the point must end up gone, not
    // resurrected as a disconnected copy.
    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const updatedHydraulicModel = store.get(stagingModelAtom);
    expect(updatedHydraulicModel.assets.has(IDS.P1)).toBeFalsy();
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP1)).toBeFalsy();
  });

  it("does nothing when no assets selected", async () => {
    const userTracking = stubUserTracking();
    const selection = nullSelection;
    const store = setInitialState({ selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    expect(userTracking.capture).not.toHaveBeenCalled();
  });

  const triggerCommand = async () => {
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
  };

  const TestableComponent = () => {
    const deleteAssets = useDeleteSelection();

    return (
      <button
        aria-label="delete"
        onClick={() => {
          deleteAssets({ source: "shortcut" });
        }}
      >
        Delete
      </button>
    );
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent />
      </CommandContainer>,
    );
  };
});
