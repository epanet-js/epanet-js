import { describe, expect, it } from "vitest";
import { addPipe } from "./add-pipe";
import {
  LinkAsset,
  createJunction,
  createPipe,
  getLinkConnections,
  getLinkCoordinates,
} from "../assets";
import { HydraulicModelBuilder } from "../__helpers__/hydraulic-model-builder";

describe("addPipe", () => {
  it("updates connections", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = createJunction({ coordinates: [10, 10], id: "A" });
    const endNode = createJunction({ coordinates: [30, 30], id: "B" });

    const pipe = createPipe({
      coordinates: [
        [10, 10],
        [20, 20],
        [30, 30],
      ],
      id: "PIPE",
    });

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    expect(putAssets![0].id).toEqual("PIPE");
    expect(getLinkConnections(putAssets![0] as LinkAsset)).toEqual(["A", "B"]);
  });

  it("removes redundant vertices", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = createJunction({ coordinates: [10, 10], id: "A" });
    const endNode = createJunction({ coordinates: [30, 30], id: "B" });

    const pipe = createPipe({
      coordinates: [
        [10, 10],
        [20, 20],
        [20, 20],
        [25, 25],
        [25, 25 + 1e-10],
        [25 + 1e-10, 25],
        [30, 30],
        [30, 30],
      ],
      id: "PIPE",
    });

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    expect(putAssets![0].id).toEqual("PIPE");
    expect(getLinkCoordinates(putAssets![0] as LinkAsset)).toEqual([
      [10, 10],
      [20, 20],
      [25, 25],
      [30, 30],
    ]);
  });

  it("ensures connectivity with the link endpoints", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = createJunction({ coordinates: [10, 10] });
    const endNode = createJunction({ coordinates: [20, 20] });
    const pipe = createPipe({
      coordinates: [
        [10, 11],
        [15, 15],
        [19 + 1e-10, 20],
        [19, 20],
      ],
      id: "PIPE",
    });

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    expect(putAssets![0].id).toEqual("PIPE");
    expect(getLinkCoordinates(putAssets![0] as LinkAsset)).toEqual([
      [10, 10],
      [15, 15],
      [20, 20],
    ]);
  });
});
