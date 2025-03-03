import { describe, expect, it } from "vitest";
import { addPipe } from "./add-pipe";
import {
  HydraulicModelBuilder,
  buildJunction,
  buildPipe,
} from "../../__helpers__/hydraulic-model-builder";
import { Pipe } from "../asset-types";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("addPipe", () => {
  it("updates connections", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
    const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

    const pipe = buildPipe({
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
    const pipeToCreate = putAssets![0] as Pipe;
    expect(pipeToCreate.connections).toEqual(["A", "B"]);
  });

  it("removes redundant vertices", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
    const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

    const pipe = buildPipe({
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

    const pipeToCreate = putAssets![0] as Pipe;
    expect(pipeToCreate.id).toEqual("PIPE");
    expect(pipeToCreate.coordinates).toEqual([
      [10, 10],
      [20, 20],
      [25, 25],
      [30, 30],
    ]);
  });

  it("ensures connectivity with the link endpoints", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ coordinates: [10, 10] });
    const endNode = buildJunction({ coordinates: [20, 20] });
    const pipe = buildPipe({
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

    const pipeToCreate = putAssets![0] as Pipe;
    expect(pipeToCreate.id).toEqual("PIPE");
    expect(pipeToCreate.coordinates).toEqual([
      [10, 10],
      [15, 15],
      [20, 20],
    ]);
  });

  it("calculates pipe length", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startCoordinates = [-4.3760931, 55.9150083];
    const endCoordiantes = [-4.3771833, 55.9133641];
    const startNode = buildJunction({ coordinates: startCoordinates });
    const endNode = buildJunction({ coordinates: endCoordiantes });
    const pipe = buildPipe({
      coordinates: [startCoordinates, endCoordiantes],
      id: "PIPE",
    });

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    const pipeToCreate = putAssets![0] as Pipe;
    expect(pipeToCreate.id).toEqual("PIPE");
    expect(pipeToCreate.length).toBeCloseTo(195.04);
  });

  it("adds a label to the pipe", () => {
    stubFeatureOn("FLAG_LABEL_TYPE");
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction();
    const endNode = buildJunction();
    const pipe = buildPipe({
      id: "PIPE",
      label: "",
    });

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    const pipeToCreate = putAssets![0] as Pipe;
    expect(pipeToCreate.id).toEqual("PIPE");
    expect(pipeToCreate.label).toEqual("P1");
  });

  it("adds a label to the nodes when missing", () => {
    stubFeatureOn("FLAG_LABEL_TYPE");
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ label: "" });
    const endNode = buildJunction({ label: "CUSTOM" });
    const pipe = buildPipe({
      id: "PIPE",
      label: "",
    });

    const { putAssets } = addPipe(hydraulicModel, {
      startNode,
      endNode,
      pipe,
    });

    const [, nodeA, nodeB] = putAssets || [];
    expect(nodeA.label).toEqual("J1");
    expect(nodeB.label).toEqual("CUSTOM");
  });
});
