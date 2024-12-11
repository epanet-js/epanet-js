import { RangeColorMapping } from "./range-color-mapping";

describe("Range color mapping", () => {
  it("assigns a color to each range", () => {
    const mapping = RangeColorMapping.build({
      steps: [0, 10, 20],
      paletteName: "epanet-ramp",
      unit: "mwc",
      property: "myprop",
    });

    expect(mapping.colorFor(5)).toEqual(mapping.colorFor(0));
    expect(mapping.colorFor(-1)).toEqual(mapping.colorFor(0));
    expect(mapping.colorFor(10)).toEqual(mapping.colorFor(15));
    expect(mapping.colorFor(15)).not.toEqual(mapping.colorFor(20));
    expect(mapping.colorFor(20)).toEqual(mapping.colorFor(25));
    expect(mapping.colorFor(20)).toEqual(mapping.colorFor(100));
  });
});
