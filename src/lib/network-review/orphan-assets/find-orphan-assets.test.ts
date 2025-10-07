import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findOrphanAssets } from "./find-orphan-assets";
import { encodeHydraulicModel } from "./data";

describe("findOrphanAssets", () => {
  it("should find nodes not connected to other assets in the network", () => {
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aNode("Orphan")
      .build();
    const { idsLookup, ...data } = encodeHydraulicModel(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanNodes).toHaveLength(1);
    expect(orphanLinks).toHaveLength(0);
    expect(idsLookup[orphanNodes[0]]).toEqual("Orphan");
  });

  it("should find valves not connected on both ends to other network pipes", () => {
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aTank("T1")
      .aNode("NoPipeNode")
      .aValve("OrphanValve", { startNodeId: "T1", endNodeId: "NoPipeNode" })
      .build();
    const { idsLookup, ...data } = encodeHydraulicModel(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanLinks).toHaveLength(1);
    expect(orphanNodes).toHaveLength(0);
    expect(idsLookup[orphanLinks[0]]).toEqual("OrphanValve");
  });

  it("should find valves not connected on both ends to other network pipes", () => {
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aTank("T1")
      .aNode("NoPipeNode")
      .aPump("OrphanPump", { startNodeId: "T1", endNodeId: "NoPipeNode" })
      .build();
    const { idsLookup, ...data } = encodeHydraulicModel(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanLinks).toHaveLength(1);
    expect(orphanNodes).toHaveLength(0);
    expect(idsLookup[orphanLinks[0]]).toEqual("OrphanPump");
  });

  it("does not report orphan nodes for nodes connected to valves or pumps", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1")
      .aNode("J1")
      .aValve("V1", { startNodeId: "T1", endNodeId: "J1" })
      .aPump("PU1", { startNodeId: "T1", endNodeId: "J1" })
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();
    const { idsLookup, ...data } = encodeHydraulicModel(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanLinks).toHaveLength(0);
    expect(orphanNodes).toHaveLength(0);
  });
});
