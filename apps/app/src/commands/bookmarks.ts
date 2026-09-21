import { useAtomCallback } from "jotai/utils";
import { Just } from "purify-ts/Maybe";
import { useCallback, useContext } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import {
  type BookmarkId,
  type CollectionDraftSource,
  newBookmark,
  removeItem,
  renameItem,
} from "src/lib/collections";
import { useBookmarksTransaction } from "src/hooks/persistence/use-bookmarks-transaction";
import { MapContext } from "src/map";
import { bookmarksAtom } from "src/state/collections";
import type { BBox } from "src/types";

export const useAddBookmark = () => {
  const map = useContext(MapContext);
  const userTracking = useUserTracking();
  const { transact } = useBookmarksTransaction();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        { label, source }: { label: string; source: CollectionDraftSource },
      ) => {
        const bounds = map?.map.getBounds();
        if (!bounds) return;

        const [[west, south], [east, north]] = bounds.toArray();
        const bbox: BBox = [west, south, east, north];
        const bookmarks = [...get(bookmarksAtom), newBookmark(label, bbox)];

        if (!transact(bookmarks)) return;

        userTracking.capture({
          name: "bookmark.created",
          totalBookmarks: bookmarks.length,
          source,
        });
      },
      [map, userTracking, transact],
    ),
  );
};

export const useGoToBookmark = () => {
  const zoomTo = useZoomTo();
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        { bookmarkId, source }: { bookmarkId: BookmarkId; source: "panel" },
      ) => {
        const bookmark = get(bookmarksAtom).find(
          (candidate) => candidate.id === bookmarkId,
        );
        if (!bookmark) return;

        userTracking.capture({ name: "bookmark.visited", source });
        zoomTo(Just(bookmark.bbox));
      },
      [zoomTo, userTracking],
    ),
  );
};

export const useRenameBookmark = () => {
  const userTracking = useUserTracking();
  const { transact } = useBookmarksTransaction();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        {
          bookmarkId,
          label,
          source,
        }: { bookmarkId: BookmarkId; label: string; source: "panel" },
      ) => {
        if (!transact(renameItem(get(bookmarksAtom), bookmarkId, label)))
          return;

        userTracking.capture({ name: "bookmark.renamed", source });
      },
      [userTracking, transact],
    ),
  );
};

export const useDeleteBookmark = () => {
  const userTracking = useUserTracking();
  const { transact } = useBookmarksTransaction();

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        { bookmarkId, source }: { bookmarkId: BookmarkId; source: "panel" },
      ) => {
        if (!transact(removeItem(get(bookmarksAtom), bookmarkId))) return;

        userTracking.capture({ name: "bookmark.deleted", source });
      },
      [userTracking, transact],
    ),
  );
};
