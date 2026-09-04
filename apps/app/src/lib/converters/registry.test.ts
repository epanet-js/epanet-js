import { emptyNetworkData } from "@epanet-js/converters";
import {
  converterExtensions,
  converterForFile,
  getConverter,
  listConverters,
} from "./registry";
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
        network: emptyNetworkData(),
        issues: [],
      },
      { name: "Synergi", extensions: [".mdb"] },
    );

    expect(getConverter("synergi")).toBe(converter);
    expect(getConverter("synergi")!.name).toEqual("Synergi");
    expect(getConverter("synergi")!.extensions).toEqual([".mdb"]);
  });

  it("lists the registered converters", () => {
    const converter = stubConverter(
      "synergi",
      { network: emptyNetworkData(), issues: [] },
      { name: "Synergi", extensions: [".mdb"] },
    );

    expect(listConverters()).toEqual([{ vendor: "synergi", converter }]);
    expect(converterExtensions(listConverters())).toEqual([".mdb"]);
  });

  it("finds the converter that handles a file", () => {
    const converter = stubConverter(
      "synergi",
      { network: emptyNetworkData(), issues: [] },
      { name: "Synergi", extensions: [".mdb"] },
    );
    const entries = listConverters();

    expect(converterForFile(entries, "MY-NETWORK.MDB")).toEqual({
      vendor: "synergi",
      converter,
    });
    expect(converterForFile(entries, "my-network.inp")).toBeNull();
    expect(converterForFile([], "my-network.mdb")).toBeNull();
  });
});
