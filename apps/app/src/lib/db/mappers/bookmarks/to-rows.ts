import { bookmarksSchema } from "@epanet-js/ejsdb";
import type { Bookmark } from "src/lib/collections";

export const serializeBookmarks = (bookmarks: readonly Bookmark[]): string =>
  JSON.stringify(bookmarksSchema.parse(bookmarks));
