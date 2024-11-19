import { describe, expect, it } from "vitest";
import { Junction } from "./junction";

describe("Junction", () => {
  it("some basic operations with junction", () => {
    const junction = Junction.build({ id: "ID", coordinates: [1, 2] });

    expect(junction.elevation).toEqual(0);

    junction.setElevation(10);
    expect(junction.elevation).toEqual(10);

    const junctionCopy = junction.copy();
    junctionCopy.setElevation(20);

    expect(junctionCopy.elevation).toEqual(20);
    expect(junction.elevation).toEqual(10);
  });
});
