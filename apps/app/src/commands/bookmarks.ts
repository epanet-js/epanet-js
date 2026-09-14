import { useAtomCallback } from "jotai/utils";
import { Just } from "purify-ts/Maybe";
import { useCallback, useContext } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import {
  type BookmarkId,
  newBookmark,
  removeItem,
  renameItem,
} from "src/lib/selection-sets";
import { MapContext } from "src/map";
import { bookmarksAtom } from "src/state/selection-sets";
import type { BBox } from "src/types";

export const useAddBookmark = () => {
  const map = useContext(MapContext);
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (_get, set, { name, source }: { name: string; source: "panel" }) => {
        const bounds = map?.map.getBounds();
        if (!bounds) return;

        const [[west, south], [east, north]] = bounds.toArray();
        const bbox: BBox = [west, south, east, north];

        userTracking.capture({ name: "bookmark.added", source });
        set(bookmarksAtom, (bookmarks) => [
          ...bookmarks,
          newBookmark(name, bbox),
        ]);
      },
      [map, userTracking],
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

  return useAtomCallback(
    useCallback(
      (
        _get,
        set,
        {
          bookmarkId,
          name,
          source,
        }: { bookmarkId: BookmarkId; name: string; source: "panel" },
      ) => {
        userTracking.capture({ name: "bookmark.renamed", source });
        set(bookmarksAtom, (bookmarks) =>
          renameItem(bookmarks, bookmarkId, name),
        );
      },
      [userTracking],
    ),
  );
};

export const useDeleteBookmark = () => {
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (
        _get,
        set,
        { bookmarkId, source }: { bookmarkId: BookmarkId; source: "panel" },
      ) => {
        userTracking.capture({ name: "bookmark.deleted", source });
        set(bookmarksAtom, (bookmarks) => removeItem(bookmarks, bookmarkId));
      },
      [userTracking],
    ),
  );
};
