import { RangeColorMapping, parseRgb } from "./range-color-mapping";

describe("Range color mapping", () => {
  const mapping = RangeColorMapping.build({
    steps: [0, 10, 20],
    paletteName: "epanet-ramp",
    unit: "mwc",
    property: "myprop",
  });
  it("assigns a color to each range", () => {
    expect(mapping.colorFor(5)).toEqual(mapping.colorFor(0));
    expect(mapping.colorFor(-1)).toEqual(mapping.colorFor(0));
    expect(mapping.colorFor(-10)).toEqual(mapping.colorFor(0));
    expect(mapping.colorFor(10)).toEqual(mapping.colorFor(15));
    expect(mapping.colorFor(15)).not.toEqual(mapping.colorFor(20));
    expect(mapping.colorFor(20)).toEqual(mapping.colorFor(25));
    expect(mapping.colorFor(20)).toEqual(mapping.colorFor(100));
  });

  it("can get hex representation of colors", () => {
    expect(parseRgb(mapping.hexaColor(5))).toEqual(mapping.colorFor(5));
  });

  it("can generate a stroke color for a value", () => {
    expect(mapping.hexaColor(5)).toEqual("#004e64");
    expect(mapping.strokeColor(5)).toEqual("#00a5e9");
  });

  it("when specified assigns to absolute values", () => {
    const mapping = RangeColorMapping.build({
      steps: [0, 10, 20],
      paletteName: "epanet-ramp",
      unit: "mwc",
      property: "myprop",
      absoluteValues: true,
    });

    expect(mapping.colorFor(-1)).toEqual(mapping.colorFor(0));
    expect(mapping.colorFor(-10)).toEqual(mapping.colorFor(10));
    expect(mapping.colorFor(-20)).toEqual(mapping.colorFor(20));
    expect(mapping.colorFor(-21)).toEqual(mapping.colorFor(21));
  });
});
