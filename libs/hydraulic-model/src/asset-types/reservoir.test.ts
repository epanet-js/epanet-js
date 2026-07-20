import { buildReservoir } from "../test-helpers";
import { calculateAverageHead } from "./reservoir";

describe("Reservoir", () => {
  it("stores the headPatternId", () => {
    const reservoir = buildReservoir({
      head: 100,
      headPatternId: 42,
    });
    expect(reservoir.headPatternId).toEqual(42);
  });

  it("leaves headPatternId undefined when not provided", () => {
    const reservoir = buildReservoir({
      head: 100,
    });
    expect(reservoir.headPatternId).toBeUndefined();
  });

  it("assigns a head relative to the elevation", () => {
    const reservoir = buildReservoir({
      elevation: 10,
    });
    expect(reservoir.head).toBeNull();

    const withNullElevation = buildReservoir({
      elevation: 0,
    });
    expect(withNullElevation.head).toBeNull();

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

  describe("calculateAverageHead", () => {
    it("returns the head when there is no pattern", () => {
      const reservoir = buildReservoir({ head: 100 });
      expect(calculateAverageHead(reservoir, new Map())).toEqual(100);
    });

    it("returns null when the head is empty (cannot compute)", () => {
      const reservoir = buildReservoir({ head: 100 });
      reservoir.setProperty("head", null);
      expect(calculateAverageHead(reservoir, new Map())).toBeNull();
    });
  });
});
