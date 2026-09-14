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
import { bookmarksAtom, selectionSetsAtom } from "src/state/selection-sets";
import { SelectionSetsPanel } from "./selection-sets-panel";

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
          <SelectionSetsPanel />
        </MapContext.Provider>
      </TooltipProvider>
    </JotaiProvider>,
  );

const saveButton = () =>
  screen.getByRole("button", { name: /^save selection/i });
const addBookmarkButton = () =>
  screen.getByRole("button", { name: "Add bookmark" });

const nameIt = async (name: string) => {
  await userEvent.keyboard(name);
  await userEvent.keyboard("{Enter}");
};

const openRowMenu = async (rowName: string) => {
  const row = screen.getByText(rowName).closest("li") as HTMLElement;
  await userEvent.click(within(row).getByRole("button", { name: "Actions" }));
};

beforeEach(() => {
  zoomTo.mockClear();
});

describe("SelectionSetsPanel", () => {
  describe("saving a selection set", () => {
    it("cannot save when nothing is selected", () => {
      const store = aStore();
      renderPanel(store);

      expect(saveButton()).toBeDisabled();
    });

    it("cannot save a single asset", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1]));
      renderPanel(store);

      expect(saveButton()).toBeDisabled();
    });

    it("cannot save a single customer point", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromIds([], [7]));
      renderPanel(store);

      expect(saveButton()).toBeDisabled();
    });

    it("can save once two assets are selected", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);

      expect(saveButton()).toBeEnabled();
    });

    it("can save an asset together with a customer point", () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromIds([1], [7]));
      renderPanel(store);

      expect(saveButton()).toBeEnabled();
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

  describe("highlighting a selection set", () => {
    const rowOf = (name: string) =>
      screen.getByText(name).closest("li") as HTMLElement;

    it("highlights a set once the map selection contains all of it", async () => {
      const store = aStore();
      store.set(selectionAtom, USelection.fromAssetIds([1, 2]));
      renderPanel(store);
      await userEvent.click(saveButton());
      await nameIt("Downtown loop");

      act(() => store.set(selectionAtom, USelection.fromAssetIds([1])));
      expect(rowOf("Downtown loop")).not.toHaveClass("bg-accent-tint");

      act(() => store.set(selectionAtom, USelection.fromAssetIds([1, 2, 3])));
      expect(rowOf("Downtown loop")).toHaveClass("bg-accent-tint");
    });

    it("highlights only the largest of the sets the selection contains", async () => {
      const store = aStore();
      renderPanel(store);
      act(() => store.set(selectionAtom, USelection.fromAssetIds([1, 2])));
      await userEvent.click(saveButton());
      await nameIt("Small");
      act(() => store.set(selectionAtom, USelection.fromAssetIds([1, 2, 3])));
      await userEvent.click(saveButton());
      await nameIt("Large");

      expect(rowOf("Large")).toHaveClass("bg-accent-tint");
      expect(rowOf("Small")).not.toHaveClass("bg-accent-tint");
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

  it("explains how to fill each list while both are empty", () => {
    const store = aStore();
    renderPanel(store);

    expect(
      screen.getByText(/press \+ to save the selection/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/press \+ to name the area/i)).toBeInTheDocument();
  });
});
