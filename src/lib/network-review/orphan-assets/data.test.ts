import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeOrphanAssets, encodeNetworkReviewBuffers } from "./data";
import {
  FixedSizeBufferView,
  EncodedSize,
  decodeId,
  decodeType,
} from "../shared";

describe("HydraulicModel encoding/decoding", () => {
  it("encodes/decodes links correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1")
      .aJunction("J1")
      .aJunction("J2")
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J1" })
      .aValve("V1", { startNodeId: "J1", endNodeId: "J2" })
      .aPump("PM1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const encoded = encodeNetworkReviewBuffers(model);
    const linksView = new FixedSizeBufferView<[number, number]>(
      encoded.links.connections,
      EncodedSize.id * 2,
      (offset, view) => [
        decodeId(offset, view),
        decodeId(offset + EncodedSize.id, view),
      ],
    );
    const linkTypesView = new FixedSizeBufferView<number>(
      encoded.links.types,
      EncodedSize.type,
      decodeType,
    );

    const links = Array.from(linksView.iter()).map((link, idx) => ({
      id: encoded.linkIdsLookup[idx],
      startNode: encoded.nodeIdsLookup[link[0]],
      endNode: encoded.nodeIdsLookup[link[1]],
      isPipe: linkTypesView.getById(idx) === 0,
    }));

    expect(links.length).toBe(3);
    expect(links[0]).toEqual({
      id: "P1",
      startNode: "T1",
      endNode: "J1",
      isPipe: true,
    });
    expect(links[1]).toEqual({
      id: "V1",
      startNode: "J1",
      endNode: "J2",
      isPipe: false,
    });
    expect(links[2]).toEqual({
      id: "PM1",
      startNode: "J1",
      endNode: "J2",
      isPipe: false,
    });
  });

  it("decodeOrphanAssets returns results sorted by type and assetId", () => {
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
