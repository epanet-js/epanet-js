import { getConverter } from "./registry";
import { stubConverter } from "./__helpers__/stub-converter";

describe("converters registry", () => {
  it("has no converter until one is registered", async () => {
    vi.resetModules();
    const { getConverter: freshGetConverter } = await import("./registry");

    expect(freshGetConverter("synergi")).toBeNull();
  });

  it("returns the registered converter", () => {
    const converter = stubConverter(
      "synergi",
      {
        network: { junctions: [], units: {}, crs: { type: "unknown" } },
        issues: [],
      },
      { name: "Synergi", extensions: [".mdb"] },
    );

    expect(getConverter("synergi")).toBe(converter);
    expect(getConverter("synergi")!.name).toEqual("Synergi");
    expect(getConverter("synergi")!.extensions).toEqual([".mdb"]);
  });
});
