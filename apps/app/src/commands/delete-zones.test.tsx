import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { Store } from "src/state";
import { screen, render } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import userEvent from "@testing-library/user-event";
import { setInitialState } from "src/__helpers__/state";
import { useDeleteZones } from "./delete-zones";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { USelection } from "src/selection";
import { AuthMockProvider, aUser } from "src/__helpers__/auth-mock";

const aSquare = (x: number) => ({
  geometry: {
    type: "MultiPolygon" as const,
    coordinates: [
      [
        [
          [x, 0],
          [x + 1, 0],
          [x + 1, 1],
          [x, 1],
          [x, 0],
        ],
      ],
    ],
  },
  bbox: [x, 0, x + 1, 1] as [number, number, number, number],
});

describe("useDeleteZones", () => {
  it("removes the given zones and leaves the rest", async () => {
    const IDS = { Z1: 1, Z2: 2 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aZone({ id: IDS.Z1, label: "NORTH", ...aSquare(0) })
      .aZone({ id: IDS.Z2, label: "SOUTH", ...aSquare(5) })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store, ids: [IDS.Z1] });

    await triggerCommand();

    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.zones.has(IDS.Z1)).toBeFalsy();
    expect(updatedHydraulicModel.zones.has(IDS.Z2)).toBeTruthy();
  });

  it("drops removed zones from the selection but keeps the rest", async () => {
    const IDS = { J1: 10, Z1: 1, Z2: 2 } as const;
    stubUserTracking();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aZone({ id: IDS.Z1, label: "NORTH", ...aSquare(0) })
      .aZone({ id: IDS.Z2, label: "SOUTH", ...aSquare(5) })
      .build();
    const selection = USelection.fromIds([IDS.J1], [], [IDS.Z1, IDS.Z2]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store, ids: [IDS.Z1] });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(USelection.getZoneIds(updatedSelection)).toEqual([IDS.Z2]);
    expect(USelection.getAssetIds(updatedSelection)).toEqual([IDS.J1]);
  });

  const triggerCommand = async () => {
    await userEvent.click(screen.getByRole("button", { name: "delete" }));
  };

  const TestableComponent = ({ ids }: { ids: number[] }) => {
    const deleteZones = useDeleteZones();

    return (
      <button
        aria-label="delete"
        onClick={() => {
          deleteZones(ids, "data-table");
        }}
      >
        Delete
      </button>
    );
  };

  const renderComponent = ({ store, ids }: { store: Store; ids: number[] }) => {
    render(
      <AuthMockProvider user={aUser({ plan: "pro" })} isSignedIn={true}>
        <CommandContainer store={store}>
          <TestableComponent ids={ids} />
        </CommandContainer>
      </AuthMockProvider>,
    );
  };
});
