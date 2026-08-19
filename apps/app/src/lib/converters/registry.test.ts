import { getConverter } from "./registry";
import { stubConverter } from "./__helpers__/stub-converter";

describe("converters registry", () => {
  it("has no converter until one is registered", async () => {
    vi.resetModules();
    const { getConverter: freshGetConverter } = await import("./registry");

    expect(freshGetConverter("synergi")).toBeNull();
  });

  it("returns the registered converter", () => {
    const parse = stubConverter("synergi", {
      network: { junctions: [], units: {}, crs: { type: "unknown" } },
      issues: [],
    });

    expect(getConverter("synergi")).toBe(parse);
  });
});
