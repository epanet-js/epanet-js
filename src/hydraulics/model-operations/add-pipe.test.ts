import { describe, expect, it } from "vitest";
import { addPipe } from "./add-pipe";
import {
  LinkAsset,
  NodeAsset,
  createPipe,
  getLinkConnections,
  getLinkCoordinates,
} from "../assets";
import { HydraulicModelBuilder } from "../__helpers__/hydraulic-model-builder";

describe("addPipe", () => {
  it("updates connections", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [10, 10])
      .aNode("B", [30, 30])
      .build();

    const startNode = hydraulicModel.assets.get("A") as NodeAsset;
    const endNode = hydraulicModel.assets.get("B") as NodeAsset;

    const pipe = createPipe(
      [
        [10, 10],
        [20, 20],
        [30, 30],
      ],
      "PIPE",
    );

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    if (!putAssets) throw new Error(`Put assets is empty`);
    expect(putAssets[0].id).toEqual("PIPE");
    expect(getLinkConnections(putAssets[0] as LinkAsset)).toEqual(["A", "B"]);
  });

  it("removes redundant vertices", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [10, 10])
      .aNode("B", [30, 30])
      .build();

    const startNode = hydraulicModel.assets.get("A") as NodeAsset;
    const endNode = hydraulicModel.assets.get("B") as NodeAsset;

    const pipe = createPipe(
      [
        [10, 10],
        [20, 20],
        [20, 20],
        [25, 25],
        [25, 25 + 1e-10],
        [30, 30],
        [30, 30],
      ],
      "PIPE",
    );

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    if (!putAssets) throw new Error(`Put assets is empty`);
    expect(putAssets[0].id).toEqual("PIPE");
    expect(getLinkCoordinates(putAssets[0] as LinkAsset)).toEqual([
      [10, 10],
      [20, 20],
      [25, 25],
      [30, 30],
    ]);
  });
});
