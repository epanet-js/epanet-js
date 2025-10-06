import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { HydraulicModelBufferView, encodeHydraulicModel } from "./data";

describe("HydraulicModel encoding/decoding", () => {
  it("encodes/decodes nodes correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1")
      .aJunction("J1")
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J1" })
      .build();

    const { nodeBuffer, pipeBuffer, otherLinkBuffer, idsLookup } =
      encodeHydraulicModel(model);

    const view = new HydraulicModelBufferView(
      nodeBuffer,
      pipeBuffer,
      otherLinkBuffer,
    );

    const nodeIds = Array.from(view.nodes()).map((n) => idsLookup[n.id]);
    expect(nodeIds.length).toBe(2);
    expect(nodeIds).toEqual(["T1", "J1"]);
  });

  it("encodes/decodes pipes correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const { nodeBuffer, pipeBuffer, otherLinkBuffer, idsLookup } =
      encodeHydraulicModel(model);

    const view = new HydraulicModelBufferView(
      nodeBuffer,
      pipeBuffer,
      otherLinkBuffer,
    );

    const pipes = Array.from(view.pipes()).map((n) => ({
      id: idsLookup[n.id],
      startNode: idsLookup[n.startNode],
      endNode: idsLookup[n.endNode],
    }));

    expect(pipes.length).toBe(1);
    expect(pipes[0]).toEqual({ id: "P1", startNode: "J1", endNode: "J2" });
  });

  it("encodes/decodes other links correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aNode("J1")
      .aNode("J2")
      .aValve("V1", { startNodeId: "J1", endNodeId: "J2" })
      .aPump("PM1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const { nodeBuffer, pipeBuffer, otherLinkBuffer, idsLookup } =
      encodeHydraulicModel(model);

    const view = new HydraulicModelBufferView(
      nodeBuffer,
      pipeBuffer,
      otherLinkBuffer,
    );

    const otherLinks = Array.from(view.otherLinks()).map((n) => ({
      id: idsLookup[n.id],
      startNode: idsLookup[n.startNode],
      endNode: idsLookup[n.endNode],
    }));

    expect(otherLinks.length).toBe(2);
    expect(otherLinks[0]).toEqual({ id: "V1", startNode: "J1", endNode: "J2" });
    expect(otherLinks[1]).toEqual({
      id: "PM1",
      startNode: "J1",
      endNode: "J2",
    });
  });
});
