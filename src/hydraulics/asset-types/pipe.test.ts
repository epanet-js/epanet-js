import { describe, expect, it } from "vitest";
import { Pipe } from "./pipe";

describe("Pipe", () => {
  it("setting coordinates updates its length", () => {
    const pipe = Pipe.build({
      coordinates: [
        [1, 1],
        [2, 2],
      ],
    });

    expect(pipe.length).toEqual(0);

    const newCoordinates = [
      [1, 1],
      [1.1, 1.1],
    ];
    pipe.setCoordinates(newCoordinates);

    expect(pipe.length).toEqual(15724.04);
  });

  it("does not mutate after a copy", () => {
    const pipe = Pipe.build({
      coordinates: [
        [1, 1],
        [2, 2],
      ],
      length: 0,
      diameter: 14,
    });

    const pipeCopy = pipe.copy();

    pipeCopy.setCoordinates([
      [1, 1],
      [1.1, 1.1],
    ]);
    pipeCopy.setDiameter(20);

    expect(pipeCopy.length).toEqual(15724.04);
    expect(pipeCopy.diameter).toEqual(20);
    expect(pipe.length).toEqual(0);
    expect(pipe.diameter).toEqual(14);
  });
});
