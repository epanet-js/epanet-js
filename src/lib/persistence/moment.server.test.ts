import { expect, describe, it } from "vitest";

import { EMPTY_MOMENT, fMoment } from "./moment";

describe("fMoment", () => {
  it("generates a moment", () => {
    expect(fMoment("This is the note")).toEqual({
      ...EMPTY_MOMENT,
      note: "This is the note",
    });
  });
});
