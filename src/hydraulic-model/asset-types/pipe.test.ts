import { buildPipe } from "../../__helpers__/hydraulic-model-builder";

describe("Pipe", () => {
  it("setting coordinates updates its length", () => {
    const pipe = buildPipe({
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

    expect(pipe.length).toBeCloseTo(15724.04);
  });

  it("takes into account unit system", () => {
    const pipe = buildPipe(
      {
        coordinates: [
          [1, 1],
          [2, 2],
        ],
        length: 0,
      },
      { length: "ft" },
    );

    expect(pipe.length).toEqual(0);

    const newCoordinates = [
      [1, 1],
      [1.1, 1.1],
    ];
    pipe.setCoordinates(newCoordinates);

    expect(pipe.length).toBeCloseTo(51588.05);
  });

  it("does not mutate after a copy", () => {
    const pipe = buildPipe({
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

    expect(pipeCopy.length).toBeCloseTo(15724.04);
    expect(pipeCopy.diameter).toEqual(20);
    expect(pipe.length).toEqual(0);
    expect(pipe.diameter).toEqual(14);
  });

  it("can add a vertex", () => {
    const pipe = buildPipe({
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
    const pipe = buildPipe({
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
    const pipe = buildPipe({
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
    const pipe = buildPipe();

    pipe.setConnections("START", "END");

    expect(pipe.connections).toEqual(["START", "END"]);
  });

  it("can assign defaults", () => {
    const pipe = buildPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.diameter).toEqual(300);
    expect(pipe.length).toEqual(1000);
    expect(pipe.roughness).toEqual(130);
    expect(pipe.minorLoss).toEqual(0);
  });

  it("can assign values", () => {
    const pipe = buildPipe({
      diameter: 12,
      length: 0.1,
      roughness: 0.01,
      minorLoss: 1,
    });

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.diameter).toEqual(12);
    expect(pipe.length).toEqual(0.1);
    expect(pipe.roughness).toEqual(0.01);
    expect(pipe.minorLoss).toEqual(1);
  });

  it("can get its segments", () => {
    const pipe = buildPipe({
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    });

    expect(pipe.segments.length).toEqual(2);
    expect(pipe.segments).toEqual([
      [
        [0, 0],
        [1, 1],
      ],
      [
        [1, 1],
        [2, 2],
      ],
    ]);
  });
});
