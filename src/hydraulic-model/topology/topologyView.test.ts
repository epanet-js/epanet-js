import { describe, it, expect } from "vitest";
import { AssetIndexView } from "../asset-index";
import { TopologyEncoder } from "./topologyEncoder";
import { TopologyView } from "./topologyView";
import { HydraulicModel } from "../hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("TopologyView", () => {
  it("getLinks and getNodes behave the same way as the model topology", () => {
    const IDS = {
      P1: 1,
      P2: 2,
      P3: 3,
      P4: 4,
      J1: 10,
      J2: 20,
      J3: 30,
      J4: 40,
      CentralNode: 50,
      notDefined: 5,
      outOfBounds: 100,
      invalidId: 0,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.CentralNode)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.CentralNode })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.CentralNode })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.CentralNode })
      .aPipe(IDS.P4, { startNodeId: IDS.J4, endNodeId: IDS.CentralNode })
      .build();

    const topology = model.topology;
    const topologyView = getTopologyView(model);

    expect(topologyView.getNodes(IDS.P1)).toEqual(topology.getNodes(IDS.P1));
    expect(topologyView.getNodes(IDS.P4)).toEqual(topology.getNodes(IDS.P4));
    expect(topologyView.getLinks(IDS.J1)).toEqual(topology.getLinks(IDS.J1));
    expect(topologyView.getLinks(IDS.CentralNode)).toEqual(
      topology.getLinks(IDS.CentralNode),
    );
    //Querying incorrect IDs
    expect(topologyView.getLinks(IDS.P1)).toEqual(topology.getLinks(IDS.P1));
    expect(topologyView.getNodes(IDS.J1)).toEqual(topology.getNodes(IDS.J1));
    expect(topologyView.getLinks(IDS.notDefined)).toEqual(
      topology.getLinks(IDS.notDefined),
    );
    expect(topologyView.getNodes(IDS.notDefined)).toEqual(
      topology.getNodes(IDS.notDefined),
    );
    expect(topologyView.getLinks(IDS.outOfBounds)).toEqual(
      topology.getLinks(IDS.outOfBounds),
    );
    expect(topologyView.getNodes(IDS.outOfBounds)).toEqual(
      topology.getNodes(IDS.outOfBounds),
    );
    expect(topologyView.getLinks(IDS.outOfBounds)).toEqual(
      topology.getLinks(IDS.invalidId),
    );
    expect(topologyView.getNodes(IDS.outOfBounds)).toEqual(
      topology.getNodes(IDS.invalidId),
    );

    expect(topologyView.hasLink(IDS.P1)).toEqual(topology.hasLink(IDS.P1));
    expect(topologyView.hasNode(IDS.J1)).toEqual(topology.hasNode(IDS.J1));
    //Querying incorrect IDs
    expect(topologyView.hasNode(IDS.P1)).toEqual(topology.hasNode(IDS.P1));
    expect(topologyView.hasLink(IDS.J1)).toEqual(topology.hasLink(IDS.J1));
    expect(topologyView.hasLink(IDS.notDefined)).toEqual(
      topology.hasLink(IDS.notDefined),
    );
    expect(topologyView.hasNode(IDS.notDefined)).toEqual(
      topology.hasNode(IDS.notDefined),
    );
    expect(topologyView.hasLink(IDS.outOfBounds)).toEqual(
      topology.hasLink(IDS.outOfBounds),
    );
    expect(topologyView.hasNode(IDS.outOfBounds)).toEqual(
      topology.hasNode(IDS.outOfBounds),
    );
    expect(topologyView.hasLink(IDS.outOfBounds)).toEqual(
      topology.hasLink(IDS.invalidId),
    );
    expect(topologyView.hasNode(IDS.outOfBounds)).toEqual(
      topology.hasNode(IDS.invalidId),
    );
  });

  it("handles empty topology", () => {
    const IDS = {
      notDefined: 10,
    } as const;

    const model = HydraulicModelBuilder.empty();

    const topology = model.topology;
    const topologyView = getTopologyView(model);

    expect(topologyView.getLinks(IDS.notDefined)).toEqual(
      topology.getLinks(IDS.notDefined),
    );
    expect(topologyView.getNodes(IDS.notDefined)).toEqual(
      topology.getNodes(IDS.notDefined),
    );
    expect(topologyView.hasLink(IDS.notDefined)).toEqual(
      topology.hasLink(IDS.notDefined),
    );
    expect(topologyView.hasNode(IDS.notDefined)).toEqual(
      topology.hasNode(IDS.notDefined),
    );
  });
});

function getTopologyView(model: HydraulicModel): TopologyView {
  const topologyEncoder = new TopologyEncoder(model.topology, model.assetIndex);
  const assetIndexView = new AssetIndexView(
    model.assetIndex.getEncoder().encode(),
  );
  return new TopologyView(topologyEncoder.encode(), assetIndexView);
}
