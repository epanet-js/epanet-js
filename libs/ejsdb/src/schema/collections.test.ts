import { describe, expect, it } from "vitest";
import { encodeIdList } from "../id-list";
import {
  bookmarksSchema,
  selectionSetGroupRowSchema,
  selectionSetRowSchema,
} from "./collections";

const aRow = (overrides: Record<string, unknown> = {}) => ({
  id: "set-1",
  label: "Downtown loop",
  assets: encodeIdList([1, 2]),
  customer_points: null,
  zones: null,
  group_id: null,
  ...overrides,
});

describe("selectionSetRowSchema", () => {
  it("accepts a row with ids and one without", () => {
    expect(selectionSetRowSchema.safeParse(aRow()).success).toBe(true);
    expect(
      selectionSetRowSchema.safeParse(aRow({ assets: null })).success,
    ).toBe(true);
  });

  it("accepts a row with no ids stored as no bytes", () => {
    expect(
      selectionSetRowSchema.safeParse(aRow({ assets: new Uint8Array(0) }))
        .success,
    ).toBe(true);
  });

  it("rejects an id list that does not divide into ids", () => {
    expect(
      selectionSetRowSchema.safeParse(aRow({ assets: new Uint8Array(6) }))
        .success,
    ).toBe(false);
  });

  it("rejects an id list that is not bytes", () => {
    expect(
      selectionSetRowSchema.safeParse(aRow({ assets: "[1,2]" })).success,
    ).toBe(false);
  });

  it("rejects a row without a label", () => {
    expect(selectionSetRowSchema.safeParse(aRow({ label: "" })).success).toBe(
      false,
    );
  });

  it("accepts a row inside a group and rejects an empty group id", () => {
    expect(
      selectionSetRowSchema.safeParse(aRow({ group_id: "group-1" })).success,
    ).toBe(true);
    expect(
      selectionSetRowSchema.safeParse(aRow({ group_id: "" })).success,
    ).toBe(false);
  });
});

describe("selectionSetGroupRowSchema", () => {
  const aGroup = (overrides: Record<string, unknown> = {}) => ({
    id: "group-1",
    label: "North",
    parent_id: null,
    ...overrides,
  });

  it("accepts a root group and a nested one", () => {
    expect(selectionSetGroupRowSchema.safeParse(aGroup()).success).toBe(true);
    expect(
      selectionSetGroupRowSchema.safeParse(aGroup({ parent_id: "group-0" }))
        .success,
    ).toBe(true);
  });

  it("rejects a group without a label or with an empty parent id", () => {
    expect(
      selectionSetGroupRowSchema.safeParse(aGroup({ label: "" })).success,
    ).toBe(false);
    expect(
      selectionSetGroupRowSchema.safeParse(aGroup({ parent_id: "" })).success,
    ).toBe(false);
  });
});

describe("bookmarksSchema", () => {
  const aBookmark = (overrides: Record<string, unknown> = {}) => ({
    id: "bookmark-1",
    label: "North reservoir",
    bbox: [-1, -2, 3, 4],
    ...overrides,
  });

  it("accepts bookmarks", () => {
    expect(bookmarksSchema.safeParse([aBookmark()]).success).toBe(true);
    expect(bookmarksSchema.safeParse([]).success).toBe(true);
  });

  it("rejects a bounding box that is not four numbers", () => {
    expect(
      bookmarksSchema.safeParse([aBookmark({ bbox: [1, 2, 3] })]).success,
    ).toBe(false);
  });

  it("rejects a bounding box with a value that is not finite", () => {
    expect(
      bookmarksSchema.safeParse([aBookmark({ bbox: [1, 2, 3, Infinity] })])
        .success,
    ).toBe(false);
  });
});
