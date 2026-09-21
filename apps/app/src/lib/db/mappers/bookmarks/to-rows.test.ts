import { describe, it, expect } from "vitest";
import type { Bookmark } from "src/lib/collections";
import { serializeBookmarks } from "./to-rows";
import { buildBookmarksData } from "./builders";

const someBookmarks = (): Bookmark[] => [
  { id: "bookmark-1", label: "North reservoir", bbox: [-1, -2, 3, 4] },
  { id: "bookmark-2", label: "Pump station", bbox: [10, 20, 11, 21] },
];

describe("serializeBookmarks", () => {
  it("produces a document that round-trips through buildBookmarksData", () => {
    const bookmarks = someBookmarks();

    expect(buildBookmarksData(serializeBookmarks(bookmarks))).toEqual(
      bookmarks,
    );
  });

  it("keeps the order the bookmarks were given in", () => {
    const bookmarks = someBookmarks();

    expect(
      buildBookmarksData(serializeBookmarks(bookmarks)).map(
        (bookmark) => bookmark.label,
      ),
    ).toEqual(["North reservoir", "Pump station"]);
  });

  it("refuses a bookmark without bounds it can store", () => {
    const bookmarks = [
      { id: "bookmark-1", label: "Broken", bbox: [1, 2, 3, Infinity] },
    ] as Bookmark[];

    expect(() => serializeBookmarks(bookmarks)).toThrow();
  });
});

describe("buildBookmarksData", () => {
  it("reads a project without bookmarks as none", () => {
    expect(buildBookmarksData(null)).toEqual([]);
  });

  it("refuses a document it cannot understand", () => {
    expect(() => buildBookmarksData("not json")).toThrow(
      /Bookmarks: data is not valid JSON/,
    );
    expect(() => buildBookmarksData('[{"id":"bookmark-1"}]')).toThrow(
      /Bookmarks: data does not match schema/,
    );
  });
});
