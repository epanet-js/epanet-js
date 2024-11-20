import { describe, expect, it } from "vitest";
import { Pipe, canonicalUnits, usCustomaryDefaultValues } from "./pipe";
import { convertTo } from "src/quantity";

describe("Pipe", () => {
  it("setting coordinates updates its length", () => {
    const pipe = Pipe.build({
      coordinates: [
        [1, 1],
        [2, 2],
      ],
      length: 0,
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

  it("can add a vertex", () => {
    const pipe = Pipe.build({
      coordinates: [
        [1, 1],
        [2, 2],
      ],
      length: 0,
    });

    pipe.addVertex([3, 3]);

    expect(pipe.coordinates).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(pipe.length).not.toEqual(0);
  });

  it("can extend a pipe", () => {
    const pipe = Pipe.build({
      coordinates: [
        [1, 1],
        [2, 2],
      ],
      length: 0,
    });

    pipe.extendTo([3, 3]);

    expect(pipe.coordinates).toEqual([
      [1, 1],
      [3, 3],
    ]);
    expect(pipe.length).not.toEqual(0);
  });

  it("can say when a coordinates is the start of a pipe", () => {
    const pipe = Pipe.build({
      coordinates: [
        [1, 1],
        [2, 2],
      ],
      length: 0,
    });

    expect(pipe.isStart([3, 3])).toBeFalsy();
    expect(pipe.isStart([2, 2])).toBeFalsy();
    expect(pipe.isStart([1, 1])).toBeTruthy();
  });

  it("can attach connections", () => {
    const pipe = Pipe.build();

    pipe.setConnections("START", "END");

    expect(pipe.connections).toEqual(["START", "END"]);
  });

  it("can assign defaults in si units", () => {
    const pipe = Pipe.build();

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.diameter).toEqual(300);
    expect(pipe.length).toEqual(1000);
    expect(pipe.roughnessFor("H-W")).toEqual(130);

    const otherPipe = Pipe.build({});

    expect(otherPipe.id).not.toEqual(pipe.id);
    expect(otherPipe.roughnessFor("D-W")).toEqual(0.26);
  });

  it("can assign defaults in us customary", () => {
    const defaultValues = usCustomaryDefaultValues;
    const pipe = Pipe.build({ ...defaultValues });

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.diameter).toEqual(304.8);
    expect(pipe.length).toEqual(304.8);
    expect(pipe.roughnessFor("H-W")).toEqual(130);

    const otherPipe = Pipe.build({});

    expect(otherPipe.id).not.toEqual(pipe.id);
    expect(
      convertTo(
        {
          value: otherPipe.roughnessFor("D-W"),
          unit: canonicalUnits.roughnessDW,
        },
        "ft",
      ),
    ).toBeCloseTo(0.00085);
  });
});
