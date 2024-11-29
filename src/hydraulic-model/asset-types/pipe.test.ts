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

    expect(pipe.length).toEqual(15724.04);
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

    expect(pipeCopy.length).toEqual(15724.04);
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

  it("can assign defaults in si units", () => {
    const pipe = buildPipe();

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.diameter).toEqual(300);
    expect(pipe.length).toEqual(1000);
    expect(pipe.roughness).toEqual(130);

    const otherPipe = buildPipe({});

    expect(otherPipe.id).not.toEqual(pipe.id);
  });

  it("can assign defaults with quantities", () => {
    const pipe = buildPipe({
      diameter: { value: 12, unit: "in" },
      length: { value: 0.1, unit: "km" },
      roughness: { value: 0.01, unit: null },
    });

    expect(pipe.id).not.toBeUndefined();
    expect(pipe.diameter).toEqual(304.8);
    expect(pipe.length).toEqual(100);
    expect(pipe.roughness).toEqual(0.01);
  });
});
