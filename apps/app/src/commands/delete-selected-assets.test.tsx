import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
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
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { USelection } from "src/selection";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import {
  resolvePermissions,
  type Permissions,
} from "src/hooks/use-permissions";

const permissionsRef: { current: Permissions } = {
  current: resolvePermissions("pro", false, false, false),
};

vi.mock("src/hooks/use-permissions", async () => {
  const actual = await vi.importActual<
    typeof import("src/hooks/use-permissions")
  >("src/hooks/use-permissions");
  return {
    ...actual,
    usePermissions: () => permissionsRef.current,
  };
});

const startUpgrade = vi.fn();
vi.mock("src/hooks/use-paywall", async () => {
  const actual = await vi.importActual<typeof import("src/hooks/use-paywall")>(
    "src/hooks/use-paywall",
  );
  return {
    ...actual,
    useStartUpgrade: () => startUpgrade,
  };
});

vi.mock("src/components/notifications", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("src/components/notifications")>();
  return {
    ...original,
    notify: vi.fn(),
  };
});

import { notify } from "src/components/notifications";

beforeEach(() => {
  startUpgrade.mockClear();
  vi.mocked(notify).mockClear();
  permissionsRef.current = resolvePermissions("pro", false, false, false);
});

const aZone = (id: number, label: string) => ({
  id,
  label,
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
    expect(USelection.isNone(updatedSelection)).toBe(true);
    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
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
    expect(USelection.isNone(updatedSelection)).toBe(true);
    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
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
    expect(USelection.isNone(updatedSelection)).toBe(true);
    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
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
    expect(USelection.isNone(updatedSelection)).toBe(true);
    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
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
    expect(USelection.isNone(updatedSelection)).toBe(true);
    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.assets.has(IDS.P1)).toBeFalsy();
    expect(updatedHydraulicModel.customerPoints.has(IDS.CP1)).toBeFalsy();
  });

  it("deletes selected zones", async () => {
    stubFeatureOn("FLAG_DELETE_ZONE");
    stubUserTracking();
    const IDS = { Z1: 1, Z2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aZone(aZone(IDS.Z1, "NORTH"))
      .aZone(aZone(IDS.Z2, "SOUTH"))
      .build();
    const selection = USelection.fromIds([], [], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    expect(USelection.isNone(store.get(selectionAtom))).toBe(true);
    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.zones.has(IDS.Z1)).toBe(false);
    expect(updatedHydraulicModel.zones.has(IDS.Z2)).toBe(true);
  });

  it("deletes a mixed selection of assets and zones", async () => {
    stubFeatureOn("FLAG_DELETE_ZONE");
    stubUserTracking();
    const IDS = { J1: 1, Z1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aZone(aZone(IDS.Z1, "NORTH"))
      .build();
    const selection = USelection.fromIds([IDS.J1], [], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.assets.has(IDS.J1)).toBe(false);
    expect(updatedHydraulicModel.zones.has(IDS.Z1)).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it("keeps selected zones without the zones plan", async () => {
    stubFeatureOn("FLAG_DELETE_ZONE");
    stubUserTracking();
    permissionsRef.current = resolvePermissions("free", false, false, false);
    const IDS = { Z1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aZone(aZone(IDS.Z1, "NORTH"))
      .build();
    const selection = USelection.fromIds([], [], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    expect(startUpgrade).not.toHaveBeenCalled();
    expect(store.get(stagingModelDerivedAtom).zones.has(IDS.Z1)).toBe(true);
    expect(USelection.getZoneIds(store.get(selectionAtom))).toEqual([IDS.Z1]);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Zones weren't deleted" }),
    );
  });

  it("offers an upgrade from the notice about kept zones", async () => {
    stubFeatureOn("FLAG_DELETE_ZONE");
    stubUserTracking();
    permissionsRef.current = resolvePermissions("free", false, false, false);
    const IDS = { Z1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aZone(aZone(IDS.Z1, "NORTH"))
      .build();
    const selection = USelection.fromIds([], [], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();
    vi.mocked(notify).mock.calls[0][0].action?.onClick();

    expect(startUpgrade).toHaveBeenCalledWith("zones");
  });

  it("deletes the assets but keeps the zones of a mixed selection without the zones plan", async () => {
    stubFeatureOn("FLAG_DELETE_ZONE");
    stubUserTracking();
    permissionsRef.current = resolvePermissions("free", false, false, false);
    const IDS = { J1: 1, Z1: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aZone(aZone(IDS.Z1, "NORTH"))
      .build();
    const selection = USelection.fromIds([IDS.J1], [], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedHydraulicModel = store.get(stagingModelDerivedAtom);
    expect(updatedHydraulicModel.assets.has(IDS.J1)).toBe(false);
    expect(updatedHydraulicModel.zones.has(IDS.Z1)).toBe(true);
    expect(startUpgrade).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Zones weren't deleted" }),
    );
  });

  it("keeps selected zones when zone deletion is off", async () => {
    stubFeatureOff("FLAG_DELETE_ZONE");
    stubUserTracking();
    const IDS = { Z1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aZone(aZone(IDS.Z1, "NORTH"))
      .build();
    const selection = USelection.fromIds([], [], [IDS.Z1]);
    const store = setInitialState({ hydraulicModel, selection });
    renderComponent({ store });

    await triggerCommand();

    expect(store.get(stagingModelDerivedAtom).zones.has(IDS.Z1)).toBe(true);
    expect(USelection.getZoneIds(store.get(selectionAtom))).toEqual([IDS.Z1]);
  });

  it("does nothing when no assets selected", async () => {
    const userTracking = stubUserTracking();
    const selection = nullSelection;
    const store = setInitialState({ selection });
    renderComponent({ store });

    await triggerCommand();

    const updatedSelection = store.get(selectionAtom);
    expect(USelection.isNone(updatedSelection)).toBe(true);
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
