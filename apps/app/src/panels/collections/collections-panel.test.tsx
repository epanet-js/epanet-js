/** @vitest-environment jsdom */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider } from "jotai";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Just } from "purify-ts/Maybe";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { MapContext } from "src/map";
import { USelection } from "src/selection";
import { Store } from "src/state";
import { selectionAtom } from "src/state/selection";
import {
  bookmarksAtom,
  pendingCollectionDraftAtom,
  selectionSetsAtom,
} from "src/state/collections";
import { CollectionsPanel } from "./collections-panel";

const zoomTo = vi.fn();
vi.mock("src/hooks/use-zoom-to", () => ({ useZoomTo: () => zoomTo }));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

const VIEWPORT = [-1, -2, 3, 4];

const aFakeMap = {
  map: {
    getBounds: () => ({
      toArray: () => [
        [VIEWPORT[0], VIEWPORT[1]],
        [VIEWPORT[2], VIEWPORT[3]],
      ],
    }),
  },
};

const aModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(1, { coordinates: [0, 0] })
    .aJunction(2, { coordinates: [10, 20] })
    .aJunction(3, { coordinates: [30, 40] })
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
  screen.getByRole("button", { name: /^current selection/i });
const addBookmarkButton = () =>
  screen.getByRole("button", { name: "Current map area" });

const nameIt = async (name: string) => {
  await userEvent.keyboard(name);
  await userEvent.keyboard("{Enter}");
};

const openRowMenu = async (rowName: string) => {
  const row = screen.getByText(rowName).closest("li") as HTMLElement;
  await userEvent.click(
    within(row).getByRole("button", { name: "More actions" }),
  );
};

beforeEach(() => {
  zoomTo.mockClear();
});

describe("CollectionsPanel", () => {
  describe("saving a selection set", () => {
    it("shows nothing selected and cannot save while nothing is selected", () => {
      const store = aStore();
      renderPanel(store);

      expect(
        screen.getByRole("button", { name: "Nothing selected" }),
      ).toBeDisabled();
    });

    it("offers the current selection once a single asset is selected", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1]));
      renderPanel(store);

      expect(saveButton()).toBeEnabled();
    });

    it("counts the selected assets and customer points", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromIds([1, 2], [7]));
      renderPanel(store);

      expect(
        screen.getByRole("button", { name: "Current selection (3)" }),
      ).toBeInTheDocument();
    });

    it("can save a single customer point", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromIds([], [7]));
      renderPanel(store);

      expect(saveButton()).toBeEnabled();
    });

    it("turns the current selection into a name input when its text is clicked", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1]));
      renderPanel(store);

      await userEvent.click(screen.getByText("Current selection"));

      expect(screen.queryByText("Current selection")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("lists the set under the name the user gave it", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);

      await userEvent.click(saveButton());
      await nameIt("Downtown loop");

      expect(screen.getByText("Downtown loop")).toBeInTheDocument();
      expect(store.get(selectionSetsAtom)).toHaveLength(1);
    });

    it("keeps both sets when the names collide", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);

      await userEvent.click(saveButton());
      await nameIt("North zone");
      await userEvent.click(saveButton());
      await nameIt("North zone");

      expect(screen.getAllByText("North zone")).toHaveLength(2);
    });

    it("remembers the customer points in the selection", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromIds([1], [7]));
      renderPanel(store);

      await userEvent.click(saveButton());
      await nameIt("Mixed");

      expect(store.get(selectionSetsAtom)[0].selection).toEqual(
        USelection.fromIds([1], [7]),
      );
    });
  });

  describe("adding from a section heading", () => {
    it("starts naming a selection set from the heading", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1]));
      renderPanel(store);

      await userEvent.click(
        screen.getByRole("button", { name: "Save selection" }),
      );

      expect(screen.queryByText("Current selection")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("cannot add a selection set from the heading while nothing is selected", () => {
      const store = aStore();
      renderPanel(store);

      expect(
        screen.getByRole("button", { name: "Save selection" }),
      ).toBeDisabled();
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
    it("opens the name input for the current selection", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      store.set(pendingCollectionDraftAtom, {
        kind: "selectionSets",
        source: "context-menu",
      });
      renderPanel(store);

      expect(screen.queryByText("Current selection")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("saves under the name given and clears the request", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      store.set(pendingCollectionDraftAtom, {
        kind: "selectionSets",
        source: "context-menu",
      });
      renderPanel(store);

      await nameIt("From the map");

      expect(screen.getByText("From the map")).toBeInTheDocument();
      expect(store.get(pendingCollectionDraftAtom)).toBeNull();
    });
  });

  describe("applying a selection set", () => {
    it("takes over the current selection", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");
      store.set(selectionAtom, USelection.fromAssetIds([3]));

      await userEvent.click(screen.getByText("Downtown loop"));

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([1, 2]);
    });

    it("moves the map to the selection it applies", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");
      store.set(selectionAtom, USelection.fromAssetIds([3]));

      await userEvent.click(screen.getByText("Downtown loop"));

      expect(zoomTo).toHaveBeenCalledWith(USelection.fromAssetIds([1, 2]));
    });

    it("selects the set without moving the map from its select button", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");
      act(() => store.set(selectionAtom, USelection.fromAssetIds([3])));
      zoomTo.mockClear();

      const row = screen
        .getByText("Downtown loop")
        .closest("li") as HTMLElement;
      await userEvent.click(
        within(row).getByRole("button", { name: "Select only" }),
      );

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([1, 2]);
      expect(zoomTo).not.toHaveBeenCalled();
    });

    it("offers no select button on bookmarks", async () => {
      const store = aStore();
      renderPanel(store);
      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");

      const row = screen.getByText("Downtown").closest("li") as HTMLElement;

      expect(
        within(row).queryByRole("button", { name: "Select only" }),
      ).not.toBeInTheDocument();
    });

    it("selects only the assets that still exist", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");

      store.set(selectionSetsAtom, (sets) =>
        sets.map((set) => ({
          ...set,
          selection: USelection.fromAssetIds([1, 2, 999]),
        })),
      );
      store.set(selectionAtom, USelection.none());

      await userEvent.click(screen.getByText("Downtown loop"));

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([1, 2]);
    });
  });

  describe("the selected set and the keyboard", () => {
    const rowOf = (name: string) =>
      screen.getByText(name).closest("li") as HTMLElement;

    const focusList = (name: string) =>
      act(() =>
        (
          screen.getByText(name).closest('[tabindex="0"]') as HTMLElement
        ).focus(),
      );

    const saveSet = async (name: string, assetIds: number[]) => {
      act(() => store.set(selectionAtom, USelection.fromAssetIds(assetIds)));
      await userEvent.click(saveButton());
      await nameIt(name);
    };

    let store: Store;

    const aPanelWithSets = async () => {
      store = aStore();
      renderPanel(store);
      await saveSet("Downtown loop", [1, 2]);
      await saveSet("Pump feeders", [3]);
      act(() => store.set(selectionAtom, USelection.none()));
      zoomTo.mockClear();
    };

    it("keeps a clicked selection set selected", async () => {
      await aPanelWithSets();

      await userEvent.click(screen.getByText("Downtown loop"));

      expect(rowOf("Downtown loop")).toHaveClass("bg-accent-tint");
      expect(rowOf("Pump feeders")).not.toHaveClass("bg-accent-tint");
    });

    it("selects a set once the map selection contains all of it", async () => {
      await aPanelWithSets();

      act(() => store.set(selectionAtom, USelection.fromAssetIds([1])));
      expect(rowOf("Downtown loop")).not.toHaveClass("bg-accent-tint");

      act(() => store.set(selectionAtom, USelection.fromAssetIds([1, 2, 4])));
      expect(rowOf("Downtown loop")).toHaveClass("bg-accent-tint");
    });

    it("moves the selection to a larger set as assets are added", async () => {
      await aPanelWithSets();
      await saveSet("Downtown and feeders", [1, 2, 3]);

      act(() => store.set(selectionAtom, USelection.fromAssetIds([1, 2])));
      expect(rowOf("Downtown loop")).toHaveClass("bg-accent-tint");

      act(() => store.set(selectionAtom, USelection.fromAssetIds([1, 2, 3])));
      expect(rowOf("Downtown and feeders")).toHaveClass("bg-accent-tint");
      expect(rowOf("Downtown loop")).not.toHaveClass("bg-accent-tint");
    });

    it("selects a set without zooming when the arrow keys reach it", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([1, 2]);
      expect(rowOf("Downtown loop")).toHaveClass("bg-accent-tint");
      expect(zoomTo).not.toHaveBeenCalled();
    });

    it("zooms to the set the arrow keys are on when enter is pressed", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");

      await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(zoomTo).toHaveBeenCalledWith(USelection.fromAssetIds([1, 2]));
    });

    it("continues from the selected set with the arrow keys", async () => {
      await aPanelWithSets();
      await userEvent.click(screen.getByText("Downtown loop"));
      focusList("Downtown loop");

      await userEvent.keyboard("{ArrowDown}");

      expect(USelection.getAssetIds(store.get(selectionAtom))).toEqual([3]);
      expect(rowOf("Pump feeders")).toHaveClass("bg-accent-tint");
    });

    it("keeps the selected set tinted when the list loses focus", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");
      await userEvent.keyboard("{ArrowDown}{ArrowDown}");

      act(() => (document.activeElement as HTMLElement).blur());

      expect(rowOf("Downtown loop")).toHaveClass("bg-accent-tint");
    });

    it("drops the highlight on a section heading when the list loses focus", async () => {
      await aPanelWithSets();
      focusList("Downtown loop");
      await userEvent.keyboard("{ArrowDown}");
      const heading = screen
        .getByRole("button", { name: /^selection sets/i })
        .closest("[data-section-type]") as HTMLElement;
      expect(heading).toHaveClass("bg-base-hover");

      act(() => (document.activeElement as HTMLElement).blur());

      expect(heading).not.toHaveClass("bg-base-hover");
    });
  });

  describe("bookmarks and the keyboard", () => {
    const rowOf = (name: string) =>
      screen.getByText(name).closest("li") as HTMLElement;

    const focusList = (name: string) =>
      act(() =>
        (
          screen.getByText(name).closest('[tabindex="0"]') as HTMLElement
        ).focus(),
      );

    const aPanelWithABookmark = async () => {
      const store = aStore();
      renderPanel(store);
      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");
      zoomTo.mockClear();
      return store;
    };

    it("leaves no bookmark highlighted after clicking one", async () => {
      await aPanelWithABookmark();

      await userEvent.click(screen.getByText("Downtown"));

      expect(rowOf("Downtown")).not.toHaveClass("bg-accent-tint");
      expect(rowOf("Downtown")).not.toHaveClass("bg-base-hover");
    });

    it("highlights a bookmark with the arrow keys without travelling to it", async () => {
      await aPanelWithABookmark();
      focusList("Downtown");

      await userEvent.keyboard("{End}{ArrowUp}");

      expect(rowOf("Downtown")).toHaveClass("bg-base-hover");
      expect(rowOf("Downtown")).not.toHaveClass("bg-accent-tint");
      expect(zoomTo).not.toHaveBeenCalled();
    });

    it("drops the highlight when the list loses focus", async () => {
      await aPanelWithABookmark();
      focusList("Downtown");
      await userEvent.keyboard("{End}{ArrowUp}");

      act(() => (document.activeElement as HTMLElement).blur());

      expect(rowOf("Downtown")).not.toHaveClass("bg-base-hover");
    });

    it("travels to the highlighted bookmark on enter", async () => {
      await aPanelWithABookmark();
      focusList("Downtown");

      await userEvent.keyboard("{End}{ArrowUp}{Enter}");

      expect(zoomTo).toHaveBeenCalledWith(Just(VIEWPORT));
    });
  });

  describe("add rows and the keyboard", () => {
    const rowOf = (name: string | RegExp) =>
      screen.getByText(name).closest("li") as HTMLElement;

    const focusList = () =>
      act(() =>
        (
          screen
            .getByText("Current map area")
            .closest('[tabindex="0"]') as HTMLElement
        ).focus(),
      );

    it("highlights an add row with the arrow keys", async () => {
      const store = aStore();
      renderPanel(store);
      focusList();

      await userEvent.keyboard("{End}");

      expect(rowOf("Current map area")).toHaveClass("bg-base-hover");
    });

    it("starts a bookmark from its add row on enter", async () => {
      const store = aStore();
      renderPanel(store);
      focusList();

      await userEvent.keyboard("{End}{Enter}");

      expect(screen.queryByText("Current map area")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("starts a selection set from its add row on enter", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1]));
      renderPanel(store);
      focusList();

      await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

      expect(screen.queryByText("Current selection")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("does nothing on enter while nothing is selected", async () => {
      const store = aStore();
      renderPanel(store);
      focusList();

      await userEvent.keyboard("{ArrowDown}{ArrowDown}");
      expect(rowOf("Nothing selected")).toHaveClass("bg-base-hover");

      await userEvent.keyboard("{Enter}");

      expect(screen.getByText("Nothing selected")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("bookmarks", () => {
    it("stores the current viewport", async () => {
      const store = aStore();
      renderPanel(store);

      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");

      expect(store.get(bookmarksAtom)[0]).toMatchObject({
        name: "Downtown",
        bbox: VIEWPORT,
      });
    });

    it("stores the viewport rather than the selection when something is selected", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);

      await userEvent.click(addBookmarkButton());
      await nameIt("Zoomed in");

      expect(store.get(bookmarksAtom)[0].bbox).toEqual(VIEWPORT);
    });

    it("travels to the bookmark when its row is clicked", async () => {
      const store = aStore();
      renderPanel(store);
      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");

      await userEvent.click(screen.getByText("Downtown"));

      expect(zoomTo).toHaveBeenCalledWith(Just(VIEWPORT));
    });
  });

  describe("renaming and deleting", () => {
    it("renames a selection set", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");

      await openRowMenu("Downtown loop");
      await userEvent.click(screen.getByText("Rename"));
      await userEvent.clear(screen.getByRole("textbox"));
      await nameIt("Uptown loop");

      expect(screen.getByText("Uptown loop")).toBeInTheDocument();
      expect(screen.queryByText("Downtown loop")).not.toBeInTheDocument();
    });

    it("deletes a selection set", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");

      await openRowMenu("Downtown loop");
      await userEvent.click(screen.getByText("Delete"));

      expect(screen.queryByText("Downtown loop")).not.toBeInTheDocument();
      expect(store.get(selectionSetsAtom)).toHaveLength(0);
    });

    it("deletes a bookmark", async () => {
      const store = aStore();
      renderPanel(store);
      await userEvent.click(addBookmarkButton());
      await nameIt("Downtown");

      await openRowMenu("Downtown");
      await userEvent.click(screen.getByText("Delete"));

      expect(store.get(bookmarksAtom)).toHaveLength(0);
    });
  });

  it("offers the current map area as a bookmark", () => {
    const store = aStore();
    renderPanel(store);

    expect(addBookmarkButton()).toBeEnabled();
  });
});
