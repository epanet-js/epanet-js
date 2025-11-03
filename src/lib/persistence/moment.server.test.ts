import { expect, describe, it } from "vitest";

import { EMPTY_MOMENT, UMoment, fMoment } from "./moment";

describe("fMoment", () => {
  it("generates a moment", () => {
    expect(fMoment("This is the note")).toEqual({
      ...EMPTY_MOMENT,
      note: "This is the note",
    });
  });
});

describe("UMoment", () => {
  it("#merge", () => {
    const a = fMoment("This is the note");
    const b = fMoment("Second moment");
    a.deleteAssets.push(1);
    b.deleteAssets.push(2);
    const c = UMoment.merge(a, b);
    expect(c).toHaveProperty("deleteAssets", [1, 2]);
  });
  it("#isEmpty", () => {
    expect(UMoment.isEmpty(fMoment("This is the note"))).toBeTruthy();
    const m = fMoment("This is the note");
    m.deleteAssets.push(1);
    expect(UMoment.isEmpty(m)).toBeFalsy();
  });
});
