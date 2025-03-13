import { Store, dataAtom, selectionAtom } from "src/state/jotai";
import { screen, render } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import userEvent from "@testing-library/user-event";
import {
  aMultiSelection,
  aSingleSelection,
  nullSelection,
  setInitialState,
} from "src/__helpers__/state";
import { useDeleteSelectedAssets } from "./delete-selected-assets";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";

describe("delete selected", () => {
  it("deletes a single selection", async () => {
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with().aJunction("J1").build();
    const selection = aSingleSelection({ id: "J1" });
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(updatedHydraulicModel.assets.has("J1")).toBeFalsy();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "asset.deleted",
      source: "shortcut",
      type: "junction",
    });
  });

  it("deletes multi selection", async () => {
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .build();
    const selection = aMultiSelection({ ids: ["J1", "J2"] });
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(updatedSelection.type).toEqual("none");
    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(updatedHydraulicModel.assets.has("J1")).toBeFalsy();
    expect(updatedHydraulicModel.assets.has("J2")).toBeFalsy();
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "assets.deleted",
      source: "shortcut",
      count: 2,
    });
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
    const deleteAssets = useDeleteSelectedAssets();

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
