import { buildReservoir } from "../../__helpers__/hydraulic-model-builder";

describe("Reservoir", () => {
  it("assigns a head relative to the elevation", () => {
    const reservoir = buildReservoir({
      elevation: 10,
    });
    expect(reservoir.head).toEqual(20);

    const withNullElevation = buildReservoir({
      elevation: 0,
    });
    expect(withNullElevation.head).toEqual(10);

    const withCustomRelativeHead = buildReservoir({
      relativeHead: -10,
      elevation: 30,
    });
    expect(withCustomRelativeHead.head).toEqual(20);
    expect(withCustomRelativeHead.elevation).toEqual(30);

    const withCustomHead = buildReservoir({
      elevation: 0,
      head: 40,
    });
    expect(withCustomHead.head).toEqual(40);

    const withCustomNullHead = buildReservoir({
      elevation: 0,
      head: 0,
    });
    expect(withCustomNullHead.head).toEqual(0);
  });

  it("can set the head", () => {
    const reservoir = buildReservoir();

    reservoir.setHead(100);

    expect(reservoir.head).toEqual(100);
  });
});
