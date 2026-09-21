import { getWorker, timed } from "@epanet-js/ejsdb";
import type { Bookmark } from "src/lib/collections";
import { serializeBookmarks } from "../mappers/bookmarks/to-rows";

export const saveBookmarks = async (
  bookmarks: readonly Bookmark[],
): Promise<void> => {
  await timed("saveBookmarks", async () => {
    await getWorker().saveBookmarks(serializeBookmarks(bookmarks));
  });
};
