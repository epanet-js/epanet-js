import { aSymbolization } from "src/__helpers__/state";
import { colorFor } from "./symbolization-ramp";

describe("Range color mapping", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";

  it("assigns a color to each range", () => {
    const symbolization = aSymbolization({
      colors: [red, green, blue],
      breaks: [10, 20],
    });
    expect(colorFor(symbolization, 5)).toEqual(colorFor(symbolization, 0));
    expect(colorFor(symbolization, -1)).toEqual(colorFor(symbolization, 0));
    expect(colorFor(symbolization, -10)).toEqual(colorFor(symbolization, 0));
    expect(colorFor(symbolization, 10)).toEqual(colorFor(symbolization, 15));
    expect(colorFor(symbolization, 15)).not.toEqual(
      colorFor(symbolization, 20),
    );
    expect(colorFor(symbolization, 20)).toEqual(colorFor(symbolization, 25));
    expect(colorFor(symbolization, 20)).toEqual(colorFor(symbolization, 100));
  });

  it("when specified assigns to absolute values", () => {
    const symbolization = aSymbolization({
      colors: [red, green, blue],
      breaks: [10, 20],
      absValues: true,
    });

    expect(colorFor(symbolization, -1)).toEqual(colorFor(symbolization, 0));
    expect(colorFor(symbolization, -10)).toEqual(colorFor(symbolization, 10));
    expect(colorFor(symbolization, -20)).toEqual(colorFor(symbolization, 20));
    expect(colorFor(symbolization, -21)).toEqual(colorFor(symbolization, 21));
  });
});
