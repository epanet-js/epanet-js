import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { importProject } from "src/lib/db/commands/import-project";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { writeQueue } from "src/lib/persistence/write-queue";
import type { Bookmark } from "src/lib/collections";
import { bookmarksAtom } from "src/state/collections";
import { dialogAtom } from "src/state/dialog";
import { projectDataVersionAtom } from "src/state/project-revision";
import type { Store } from "src/state";
import { useBookmarksTransaction } from "./use-bookmarks-transaction";

const aBookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: "bookmark-1",
  label: "North reservoir",
  bbox: [-1, -2, 3, 4],
  ...overrides,
});

const anEmptyProject = () =>
  importProject({
    newDb: true,
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });

const renderTransaction = (store: Store) =>
  renderHook(() => useBookmarksTransaction(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storedBookmarks = async () => {
  const { bookmarks } = await fetchProject();
  return bookmarks;
};

describe("useBookmarksTransaction", () => {
  useInProcessDb();

  describe("when collections are on", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_SELECTION_SETS");
    });

    it("stores the bookmarks in the project", async () => {
      await anEmptyProject();
      const store = setInitialState({});
      const { result } = renderTransaction(store);

      await act(async () => {
        result.current.transact([aBookmark()]);
        await writeQueue.whenIdle();
      });

      expect(store.get(bookmarksAtom)).toEqual([aBookmark()]);
      expect(await storedBookmarks()).toEqual([aBookmark()]);
    });

    it("marks the project as having changes to save", async () => {
      await anEmptyProject();
      const store = setInitialState({});
      const versionBefore = store.get(projectDataVersionAtom);
      const { result } = renderTransaction(store);

      await act(async () => {
        result.current.transact([aBookmark()]);
        await writeQueue.whenIdle();
      });

      expect(store.get(projectDataVersionAtom)).not.toEqual(versionBefore);
    });

    it("stores the document left after a deletion", async () => {
      await anEmptyProject();
      const store = setInitialState({});
      const { result } = renderTransaction(store);

      await act(async () => {
        result.current.transact([aBookmark(), aBookmark({ id: "bookmark-2" })]);
        result.current.transact([aBookmark({ id: "bookmark-2" })]);
        await writeQueue.whenIdle();
      });

      expect(await storedBookmarks()).toEqual([
        aBookmark({ id: "bookmark-2" }),
      ]);
    });

    it("refuses a document it could not store and tells the user", async () => {
      await anEmptyProject();
      const store = setInitialState({});
      const { result } = renderTransaction(store);

      let accepted = true;
      await act(async () => {
        accepted = result.current.transact([aBookmark({ label: "" })]);
        await writeQueue.whenIdle();
      });

      expect(accepted).toBe(false);
      expect(store.get(bookmarksAtom)).toEqual([]);
      expect(store.get(dialogAtom)).toEqual({ type: "changeNotApplied" });
      expect(await storedBookmarks()).toEqual([]);
    });
  });

  describe("when collections are off", () => {
    beforeEach(() => {
      stubFeatureOff("FLAG_SELECTION_SETS");
    });

    it("keeps the bookmarks for the session without storing them", async () => {
      await anEmptyProject();
      const store = setInitialState({});
      const versionBefore = store.get(projectDataVersionAtom);
      const { result } = renderTransaction(store);

      await act(async () => {
        result.current.transact([aBookmark()]);
        await writeQueue.whenIdle();
      });

      expect(store.get(bookmarksAtom)).toEqual([aBookmark()]);
      expect(store.get(projectDataVersionAtom)).toEqual(versionBefore);
      expect(await storedBookmarks()).toEqual([]);
    });
  });
});
