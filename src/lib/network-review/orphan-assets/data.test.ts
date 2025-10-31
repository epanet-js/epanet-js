import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeOrphanAssets } from "./data";

const IDS = {
  J1: 1,
  J2: 2,
  PM1: 3,
  PM2: 4,
  V1: 5,
  V2: 6,
  T1: 7,
  T2: 8,
  R1: 9,
  R2: 10,
} as const;

describe("decodeOrphanAssets", () => {
  it("returns results sorted by type and assetId", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J2, { label: "J2" })
      .aJunction(IDS.J1, { label: "J1" })
      .aPump(IDS.PM2, { label: "PM2" })
      .aPump(IDS.PM1, { label: "PM1" })
      .aValve(IDS.V2, { label: "V2" })
      .aValve(IDS.V1, { label: "V1" })
      .aTank(IDS.T2, { label: "T2" })
      .aTank(IDS.T1, { label: "T1" })
      .aReservoir(IDS.R2, { label: "R2" })
      .aReservoir(IDS.R1, { label: "R1" })
      .build();
    const nodeIdsLookup = [
      String(IDS.J2),
      String(IDS.J1),
      String(IDS.T2),
      String(IDS.T1),
      String(IDS.R2),
      String(IDS.R1),
    ];
    const linkIdsLookup = [
      String(IDS.PM2),
      String(IDS.PM1),
      String(IDS.V2),
      String(IDS.V1),
    ];
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
