import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeOrphanAssets } from "./data";

describe("decodeOrphanAssets", () => {
  it("returns results sorted by type and assetId", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("0", { label: "J2" })
      .aJunction("9", { label: "J1" })
      .aPump("8", { label: "PM2" })
      .aPump("7", { label: "PM1" })
      .aValve("6", { label: "V2" })
      .aValve("5", { label: "V1" })
      .aTank("4", { label: "T2" })
      .aTank("3", { label: "T1" })
      .aReservoir("2", { label: "R2" })
      .aReservoir("1", { label: "R1" })
      .build();
    const nodeIdsLookup = ["0", "9", "4", "3", "2", "1"];
    const linkIdsLookup = ["8", "7", "6", "5"];
    const rawOrphanAssets = {
      orphanNodes: [0, 1, 2, 3, 4, 5],
      orphanLinks: [0, 1, 2, 3],
    };

    const orphanAssets = decodeOrphanAssets(
      model,
      nodeIdsLookup,
      linkIdsLookup,
      rawOrphanAssets,
    );

    expect(orphanAssets.map((asset) => asset.label)).toEqual([
      "R1",
      "R2",
      "T1",
      "T2",
      "V1",
      "V2",
      "PM1",
      "PM2",
      "J1",
      "J2",
    ]);
  });
});
