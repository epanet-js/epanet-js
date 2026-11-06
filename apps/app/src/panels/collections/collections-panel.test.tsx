/** @vitest-environment jsdom */
import { act } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@epanet-js/ui-kit";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import "src/__helpers__/locale";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import {
  resolvePermissions,
  type Permissions,
} from "src/hooks/use-permissions";
import { MapContext } from "src/map";
import { USelection } from "src/selection";
import { Store } from "src/state";
import { dialogAtom } from "src/state/dialog";
import { selectionAtom } from "src/state/selection";
import {
  pendingCollectionDraftAtom,
  selectionSetGroupsAtom,
  selectionSetsAtom,
} from "src/state/collections";
import { CollectionsPanel } from "./collections-panel";

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

const zoomTo = vi.fn();
vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => zoomTo }));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

const VIEWPORT = [-1, -2, 3, 4];

const fitBounds = vi.fn();

const aFakeMap = {
  map: {
    fitBounds,
    getBounds: () => ({
      toArray: () => [
        [VIEWPORT[0], VIEWPORT[1]],
        [VIEWPORT[2], VIEWPORT[3]],
      ],
    }),
  },
};

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  CP1: 7,
  Z1: 20,
  Deleted: 999,
} as const;

const aModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0] })
    .aJunction(IDS.J2, { coordinates: [10, 20] })
    .aJunction(IDS.J3, { coordinates: [30, 40] })
    .aZone({
      id: IDS.Z1,
      label: "NORTH",
      geometry: {
        type: "MultiPolygon",
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
      bbox: [0, 0, 1, 1],
    })
    .build();

const aStore = () => setInitialState({ hydraulicModel: aModel() });

const renderPanel = (store: Store) =>
  render(
    <JotaiProvider store={store}>
      <TooltipProvider>
        <MapContext.Provider value={aFakeMap as never}>
          <CollectionsPanel />
        </MapContext.Provider>
      </TooltipProvider>
    </JotaiProvider>,
  );

const saveButton = () =>
  screen.getByRole("button", { name: /^save current selection/i });
const addBookmarkButton = () =>
  screen.getByRole("button", { name: "Save current map area" });

const nameIt = async (name: string) => {
  await userEvent.keyboard(name);
  await userEvent.keyboard("{Enter}");
};

const rowOf = (name: string | RegExp) =>
  screen.getByText(name).closest("li") as HTMLElement;

const focusList = (name: string) =>
  act(() =>
    (screen.getByText(name).closest('[tabindex="0"]') as HTMLElement).focus(),
  );

beforeEach(() => {
  zoomTo.mockClear();
  fitBounds.mockClear();
  permissionsRef.current = resolvePermissions("pro", false, false, false);
  stubFeatureOff("FLAG_SELECTION_SET_GROUPS");
});

describe("CollectionsPanel", () => {
  describe("saving a selection set", () => {
    it("keeps both sets when the names collide", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
      renderPanel(store);

      await userEvent.click(saveButton());
      await nameIt("North zone");
      await userEvent.click(saveButton());
      await nameIt("North zone");

      expect(screen.getAllByText("North zone")).toHaveLength(2);
    });

    it("saves the selected zones", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromIds([IDS.J1], [], [IDS.Z1]));
      renderPanel(store);

      await userEvent.click(saveButton());
      await nameIt("North zone");

      const [saved] = store.get(selectionSetsAtom);
      expect(USelection.getAssetIds(saved.selection)).toEqual([IDS.J1]);
      expect(USelection.getZoneIds(saved.selection)).toEqual([IDS.Z1]);
    });

    it("opens a collapsed section to name a bookmark from its heading", async () => {
      const store = aStore();
      renderPanel(store);
      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");
      await userEvent.click(
        screen.getByRole("button", { name: /^bookmarks/i }),
      );
      expect(screen.queryByText("Downtown")).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: "Add bookmark" }),
      );

      expect(screen.getByText("Downtown")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });
  });

  describe("a draft requested from outside the panel", () => {
    it("saves under the name given and clears the request", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
      store.set(pendingCollectionDraftAtom, {
        kind: "selectionSets",
        source: "context-menu",
        label: "",
      });
      renderPanel(store);

      await nameIt("From the map");

      expect(screen.getByText("From the map")).toBeInTheDocument();
      expect(store.get(pendingCollectionDraftAtom)).toBeNull();
    });

    it("saves a prefilled name as given", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
      store.set(pendingCollectionDraftAtom, {
        kind: "selectionSets",
        source: "script-output",
        label: "Isolated nodes",
      });
      renderPanel(store);

      expect(screen.getByRole("textbox")).toHaveValue("Isolated nodes");
      await userEvent.keyboard("{Enter}");

      expect(store.get(selectionSetsAtom).map((set) => set.label)).toEqual([
        "Isolated nodes",
      ]);
    });
  });

  describe("applying a selection set", () => {
    it("selects the set without moving the map from its select button", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");
      act(() => store.set(selectionAtom, USelection.fromAssetIds([IDS.J3])));
      zoomTo.mockClear();

      const row = screen
        .getByText("Downtown loop")
        .closest("li") as HTMLElement;
      await userEvent.click(
        within(row).getByRole("button", { name: "Select only" }),
      );

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([
        IDS.J1,
        IDS.J2,
      ]);
      expect(zoomTo).not.toHaveBeenCalled();
    });

    it("selects the zones of a saved set", async () => {
      const store = aStore();
      store.set(selectionSetsAtom, [
        {
          id: "set-1",
          label: "North zone",
          selection: USelection.fromIds([IDS.J1], [], [IDS.Z1]),
          groupId: null,
        },
      ]);
      renderPanel(store);

      await userEvent.click(screen.getByText("North zone"));

      expect(USelection.getZoneIds(store.get(selectionAtom))).toEqual([IDS.Z1]);
    });

    it("selects only the assets that still exist", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");

      act(() => {
        store.set(selectionSetsAtom, (sets) =>
          sets.map((set) => ({
            ...set,
            selection: USelection.fromAssetIds([IDS.J1, IDS.J2, IDS.Deleted]),
          })),
        );
        store.set(selectionAtom, USelection.none());
      });

      await userEvent.click(screen.getByText("Downtown loop"));

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([
        IDS.J1,
        IDS.J2,
      ]);
    });
  });

  describe("the selected set and the keyboard", () => {
    const saveSet = async (name: string, assetIds: number[]) => {
      act(() => store.set(selectionAtom, USelection.fromAssetIds(assetIds)));
      await userEvent.click(saveButton());
      await nameIt(name);
    };

    let store: Store;

    const aPanelWithSets = async () => {
      store = aStore();
      renderPanel(store);
      await saveSet("Downtown loop", [IDS.J1, IDS.J2]);
      await saveSet("Pump feeders", [IDS.J3]);
      act(() => store.set(selectionAtom, USelection.none()));
      zoomTo.mockClear();
    };

    it("keeps a clicked selection set selected", async () => {
      await aPanelWithSets();

      await userEvent.click(screen.getByText("Downtown loop"));

      expect(rowOf("Downtown loop")).toHaveAttribute("aria-selected", "true");
      expect(rowOf("Pump feeders")).toHaveAttribute("aria-selected", "false");
    });

    it("selects the duplicate that was clicked, not the first of the two", async () => {
      store = aStore();
      renderPanel(store);
      await saveSet("Downtown loop", [IDS.J1, IDS.J2]);
      await saveSet("Downtown loop", [IDS.J1, IDS.J2]);
      act(() => store.set(selectionAtom, USelection.none()));

      const [first, second] = screen.getAllByText("Downtown loop");

      await userEvent.click(second);

      expect(second.closest("li")).toHaveAttribute("aria-selected", "true");
      expect(first.closest("li")).toHaveAttribute("aria-selected", "false");
    });

    it("selects a set without zooming when the arrow keys reach it", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([
        IDS.J1,
        IDS.J2,
      ]);
      expect(rowOf("Downtown loop")).toHaveAttribute("aria-selected", "true");
      expect(zoomTo).not.toHaveBeenCalled();
    });

    it("zooms to the set the arrow keys are on when enter is pressed", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");

      await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(zoomTo).toHaveBeenCalledWith(
        USelection.fromAssetIds([IDS.J1, IDS.J2]),
      );
    });

    it("continues from the selected set with the arrow keys", async () => {
      await aPanelWithSets();
      await userEvent.click(screen.getByText("Downtown loop"));
      await waitFor(() =>
        expect(rowOf("Downtown loop")).toHaveAttribute("aria-selected", "true"),
      );
      focusList("Downtown loop");

      await userEvent.keyboard("{ArrowDown}");

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([
        IDS.J3,
      ]);
      expect(rowOf("Pump feeders")).toHaveAttribute("aria-selected", "true");
    });

    it("keeps the selected set tinted when the list loses focus", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");
      await userEvent.keyboard("{ArrowDown}{ArrowDown}");

      act(() => (document.activeElement as HTMLElement).blur());

      expect(rowOf("Downtown loop")).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("bookmarks and the keyboard", () => {
    const aPanelWithABookmark = async () => {
      const store = aStore();
      renderPanel(store);
      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");
      fitBounds.mockClear();
      return store;
    };

    it("leaves no bookmark highlighted after clicking one", async () => {
      await aPanelWithABookmark();

      await userEvent.click(screen.getByText("Downtown"));

      expect(rowOf("Downtown")).toHaveAttribute("aria-selected", "false");
      expect(rowOf("Downtown")).not.toHaveClass("bg-base-hover");
    });

    it("highlights a bookmark with the arrow keys without travelling to it", async () => {
      await aPanelWithABookmark();
      focusList("Downtown");

      await userEvent.keyboard("{End}{ArrowUp}");

      expect(rowOf("Downtown")).toHaveClass("bg-base-hover");
      expect(rowOf("Downtown")).toHaveAttribute("aria-selected", "false");
      expect(fitBounds).not.toHaveBeenCalled();
    });

    it("drops the highlight when the list loses focus", async () => {
      await aPanelWithABookmark();
      focusList("Downtown");
      await userEvent.keyboard("{End}{ArrowUp}");

      act(() => (document.activeElement as HTMLElement).blur());

      expect(rowOf("Downtown")).not.toHaveClass("bg-base-hover");
    });

    it("returns to the saved map area unpadded on enter", async () => {
      await aPanelWithABookmark();
      focusList("Downtown");

      await userEvent.keyboard("{End}{ArrowUp}{Enter}");

      expect(fitBounds).toHaveBeenCalledWith(
        VIEWPORT,
        expect.objectContaining({ padding: 0 }),
      );
    });
  });

  describe("add rows and the keyboard", () => {
    it("highlights an add row with the arrow keys", async () => {
      const store = aStore();
      renderPanel(store);
      focusList("Save current map area");

      await userEvent.keyboard("{End}");

      expect(rowOf("Save current map area")).toHaveClass("bg-base-hover");
    });

    it("starts a bookmark from its add row on enter", async () => {
      const store = aStore();
      renderPanel(store);
      focusList("Save current map area");

      await userEvent.keyboard("{End}{Enter}");

      expect(
        screen.queryByText("Save current map area"),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("does nothing on enter while nothing is selected", async () => {
      const store = aStore();
      renderPanel(store);
      focusList("Save current map area");

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      expect(rowOf("Nothing selected")).toHaveClass("bg-base-hover");

      await userEvent.keyboard("{Enter}");

      expect(screen.getByText("Nothing selected")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("folders", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_SELECTION_SET_GROUPS");
    });

    const addMenuButton = () => screen.getByRole("button", { name: "Add" });

    const addFolder = async (name: string) => {
      await userEvent.click(addMenuButton());
      await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
      await nameIt(name);
    };

    it("creates an empty folder from the heading", async () => {
      const store = aStore();
      renderPanel(store);

      await addFolder("DMAs");

      expect(screen.getByText("DMAs")).toBeInTheDocument();
      expect(rowOf("Nothing selected")).toHaveStyle({ paddingLeft: "1rem" });
      expect(
        store.get(selectionSetGroupsAtom).map((group) => group.label),
      ).toEqual(["DMAs"]);
      expect(store.get(selectionSetGroupsAtom)[0].parentId).toBeNull();
    });

    it("saves the current selection from the heading", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1, IDS.J2]));
      renderPanel(store);

      await userEvent.click(addMenuButton());
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Selection set" }),
      );
      await nameIt("North zone");

      expect(screen.getByText("North zone")).toBeInTheDocument();
      expect(
        screen.queryByText("Save current selection"),
      ).not.toBeInTheDocument();
    });

    const saveSetFromMenu = async (name: string) => {
      await userEvent.click(addMenuButton());
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Selection set" }),
      );
      await nameIt(name);
    };

    const moveFromMenu = async (setName: string, target: string) => {
      await userEvent.click(
        within(rowOf(setName)).getByRole("button", { name: "More actions" }),
      );
      await userEvent.click(
        screen.getByRole("menuitem", { name: /move to folder/i }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: target }),
      );
    };

    const deleteFromMenu = async (folderName: string) => {
      await userEvent.click(
        within(rowOf(folderName)).getByRole("button", {
          name: "More actions",
        }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    };

    it("renames a folder from its menu", async () => {
      const store = aStore();
      renderPanel(store);
      await addFolder("DMAs");

      await userEvent.click(
        within(rowOf("DMAs")).getByRole("button", { name: "More actions" }),
      );
      await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
      await userEvent.clear(screen.getByRole("textbox"));
      await nameIt("Zones");

      expect(screen.getByText("Zones")).toBeInTheDocument();
      expect(screen.queryByText("DMAs")).not.toBeInTheDocument();
      expect(
        store.get(selectionSetGroupsAtom).map((group) => group.label),
      ).toEqual(["Zones"]);
    });

    it("deletes an empty folder from its menu without asking", async () => {
      const store = aStore();
      renderPanel(store);
      await addFolder("DMAs");

      await deleteFromMenu("DMAs");

      expect(screen.queryByText("DMAs")).not.toBeInTheDocument();
      expect(store.get(selectionSetGroupsAtom)).toEqual([]);
      expect(store.get(dialogAtom)).toBeNull();
    });

    it("asks for confirmation before deleting a folder holding sets", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
      renderPanel(store);
      await addFolder("DMAs");
      await saveSetFromMenu("North zone");
      await moveFromMenu("North zone", "DMAs");
      const [group] = store.get(selectionSetGroupsAtom);

      await deleteFromMenu("DMAs");

      expect(store.get(dialogAtom)).toEqual({
        type: "deleteSelectionSetGroupConfirmation",
        groupId: group.id,
      });
      expect(screen.getByText("DMAs")).toBeInTheDocument();
    });

    it("moves a set into a folder and back to the top level from its menu", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
      renderPanel(store);
      await addFolder("DMAs");
      await saveSetFromMenu("North zone");
      const [group] = store.get(selectionSetGroupsAtom);

      await moveFromMenu("North zone", "DMAs");

      expect(store.get(selectionSetsAtom)[0].groupId).toBe(group.id);
      expect(within(rowOf("DMAs")).getByText("(1)")).toBeInTheDocument();
      expect(
        screen.queryByText("Save current selection"),
      ).not.toBeInTheDocument();

      await moveFromMenu("North zone", "Top level");

      expect(store.get(selectionSetsAtom)[0].groupId).toBeNull();
      expect(screen.getByText("Save current selection")).toBeInTheDocument();
    });

    const folderAddButton = (folderName: string) =>
      within(rowOf(folderName)).getByRole("button", { name: "Add to folder" });

    it("creates a folder inside a folder from the folder's own add menu", async () => {
      const store = aStore();
      renderPanel(store);
      await addFolder("DMAs");

      await userEvent.click(folderAddButton("DMAs"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
      await nameIt("North");

      const [dmas, north] = store.get(selectionSetGroupsAtom);
      expect(north.label).toBe("North");
      expect(north.parentId).toBe(dmas.id);
      expect(rowOf("North")).toHaveStyle({ paddingLeft: "1rem" });
      expect(screen.getAllByText("Nothing selected")).toHaveLength(1);
    });

    it("saves the current selection inside a folder from the folder's own add menu", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
      renderPanel(store);
      await addFolder("DMAs");

      await userEvent.click(folderAddButton("DMAs"));
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Selection set" }),
      );
      await nameIt("North zone");

      const [dmas] = store.get(selectionSetGroupsAtom);
      expect(store.get(selectionSetsAtom)[0].groupId).toBe(dmas.id);
      expect(within(rowOf("DMAs")).getByText("(1)")).toBeInTheDocument();
    });

    it("hides a nested folder while its parent is collapsed", async () => {
      const store = aStore();
      renderPanel(store);
      await addFolder("DMAs");
      await userEvent.click(folderAddButton("DMAs"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
      await nameIt("North");

      await userEvent.click(screen.getByText("DMAs"));
      expect(screen.queryByText("North")).not.toBeInTheDocument();

      await userEvent.click(screen.getByText("DMAs"));
      expect(screen.getByText("North")).toBeInTheDocument();
    });

    it("names nested folders by their path in the move menu", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
      renderPanel(store);
      await addFolder("DMAs");
      await userEvent.click(folderAddButton("DMAs"));
      await userEvent.click(screen.getByRole("menuitem", { name: "Folder" }));
      await nameIt("North");
      await saveSetFromMenu("North zone");

      await moveFromMenu("North zone", "DMAs / North");

      const [, north] = store.get(selectionSetGroupsAtom);
      expect(store.get(selectionSetsAtom)[0].groupId).toBe(north.id);
      expect(within(rowOf("North")).getByText("(1)")).toBeInTheDocument();
      expect(within(rowOf("DMAs")).getByText("(1)")).toBeInTheDocument();
    });

    it("lists folders before selection sets and reaches both with the arrow keys", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([IDS.J1]));
      renderPanel(store);
      await userEvent.click(addMenuButton());
      await userEvent.click(
        screen.getByRole("menuitem", { name: "Selection set" }),
      );
      await nameIt("North zone");
      await addFolder("DMAs");
      act(() => store.set(selectionAtom, USelection.none()));
      focusList("DMAs");

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      expect(rowOf("DMAs")).toHaveClass("bg-base-hover");

      await userEvent.keyboard("{ArrowDown}");
      expect(rowOf("Nothing selected")).toHaveClass("bg-base-hover");

      await userEvent.keyboard("{ArrowDown}");
      expect(rowOf("North zone")).toHaveAttribute("aria-selected", "true");
    });
  });
});
