import { aRangeColorRule } from "src/__helpers__/state";
import { colorFor } from "./range-color-rule";

describe("Range color mapping", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";

  it("assigns a color to each range", () => {
    const colorRule = aRangeColorRule({
      colors: [red, green, blue],
      breaks: [10, 20],
    });
    expect(colorFor(colorRule, 5)).toEqual(colorFor(colorRule, 0));
    expect(colorFor(colorRule, -1)).toEqual(colorFor(colorRule, 0));
    expect(colorFor(colorRule, -10)).toEqual(colorFor(colorRule, 0));
    expect(colorFor(colorRule, 10)).toEqual(colorFor(colorRule, 15));
    expect(colorFor(colorRule, 15)).not.toEqual(colorFor(colorRule, 20));
    expect(colorFor(colorRule, 20)).toEqual(colorFor(colorRule, 25));
    expect(colorFor(colorRule, 20)).toEqual(colorFor(colorRule, 100));
  });

  it("when specified assigns to absolute values", () => {
    const colorRule = aRangeColorRule({
      colors: [red, green, blue],
      breaks: [10, 20],
      absValues: true,
    });

    expect(colorFor(colorRule, -1)).toEqual(colorFor(colorRule, 0));
    expect(colorFor(colorRule, -10)).toEqual(colorFor(colorRule, 10));
    expect(colorFor(colorRule, -20)).toEqual(colorFor(colorRule, 20));
    expect(colorFor(colorRule, -21)).toEqual(colorFor(colorRule, 21));
  });
});
