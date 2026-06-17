import { selectionAtom } from "src/state/selection";
import { Store } from "src/state";
import { screen, render } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { useSelectAll } from "./select-all";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { USelection } from "src/selection";
import { useSymbologyState } from "src/state/map-symbology";

describe("useSelectAll", () => {
  it("selects all assets and customer points when customer points are visible", async () => {
    const IDS = { J1: 1, J2: 2, CP1: 100, CP2: 101 } as const;
    const userTracking = stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .aCustomerPoint(IDS.CP2, { coordinates: [1, 1] })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await selectAll();

    const selection = store.get(selectionAtom);
    expect(USelection.getAssetIds(selection)).toEqual([IDS.J1, IDS.J2]);
    expect(USelection.getCustomerPointIds(selection)).toEqual([
      IDS.CP1,
      IDS.CP2,
    ]);
    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "fullSelection.enabled",
      source: "shortcut",
      count: 2,
    });
  });

  it("excludes customer points when they are not visible", async () => {
    const IDS = { J1: 1, J2: 2, CP1: 100 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aCustomerPoint(IDS.CP1, { coordinates: [0, 0] })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await hideCustomerPoints();
    await selectAll();

    const selection = store.get(selectionAtom);
    expect(USelection.getAssetIds(selection)).toEqual([IDS.J1, IDS.J2]);
    expect(USelection.getCustomerPointIds(selection)).toEqual([]);
  });

  const selectAll = async () => {
    await userEvent.click(screen.getByRole("button", { name: "select-all" }));
  };

  const hideCustomerPoints = async () => {
    await userEvent.click(screen.getByRole("button", { name: "hide-cps" }));
  };

  const TestableComponent = () => {
    const selectAllCommand = useSelectAll();
    const { updateCustomerPointsSymbology } = useSymbologyState();

    return (
      <>
        <button
          aria-label="hide-cps"
          onClick={() => updateCustomerPointsSymbology({ visible: false })}
        >
          Hide
        </button>
        <button
          aria-label="select-all"
          onClick={() => selectAllCommand({ source: "shortcut" })}
        >
          Select all
        </button>
      </>
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
