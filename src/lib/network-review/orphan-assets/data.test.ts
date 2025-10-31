import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeOrphanAssets } from "./data";

describe("decodeOrphanAssets", () => {
  it("returns results sorted by type and assetId", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("1", { label: "J2" })
      .aJunction("10", { label: "J1" })
      .aPump("9", { label: "PM2" })
      .aPump("8", { label: "PM1" })
      .aValve("7", { label: "V2" })
      .aValve("6", { label: "V1" })
      .aTank("5", { label: "T2" })
      .aTank("4", { label: "T1" })
      .aReservoir("3", { label: "R2" })
      .aReservoir("2", { label: "R1" })
      .build();
    const nodeIdsLookup = ["1", "10", "5", "4", "3", "2"];
    const linkIdsLookup = ["9", "8", "7", "6"];
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
