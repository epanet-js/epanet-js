import { bookmarksSchema } from "@epanet-js/ejsdb";
import { initializeBookmarks, type Bookmark } from "src/lib/collections";

export const buildBookmarksData = (json: string | null): Bookmark[] => {
  if (json === null) return initializeBookmarks();

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error("Bookmarks: data is not valid JSON", { cause: error });
  }

  const result = bookmarksSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Bookmarks: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
