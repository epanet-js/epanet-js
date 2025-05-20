import { aSymbology } from "src/__helpers__/state";
import { colorFor } from "./range-symbology";

describe("Range color mapping", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";

  it("assigns a color to each range", () => {
    const symbology = aSymbology({
      colors: [red, green, blue],
      breaks: [10, 20],
    });
    expect(colorFor(symbology, 5)).toEqual(colorFor(symbology, 0));
    expect(colorFor(symbology, -1)).toEqual(colorFor(symbology, 0));
    expect(colorFor(symbology, -10)).toEqual(colorFor(symbology, 0));
    expect(colorFor(symbology, 10)).toEqual(colorFor(symbology, 15));
    expect(colorFor(symbology, 15)).not.toEqual(colorFor(symbology, 20));
    expect(colorFor(symbology, 20)).toEqual(colorFor(symbology, 25));
    expect(colorFor(symbology, 20)).toEqual(colorFor(symbology, 100));
  });

  it("when specified assigns to absolute values", () => {
    const symbology = aSymbology({
      colors: [red, green, blue],
      breaks: [10, 20],
      absValues: true,
    });

    expect(colorFor(symbology, -1)).toEqual(colorFor(symbology, 0));
    expect(colorFor(symbology, -10)).toEqual(colorFor(symbology, 10));
    expect(colorFor(symbology, -20)).toEqual(colorFor(symbology, 20));
    expect(colorFor(symbology, -21)).toEqual(colorFor(symbology, 21));
  });
});
