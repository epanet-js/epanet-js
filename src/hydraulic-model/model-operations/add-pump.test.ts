import { describe, expect, it } from "vitest";
import { addPump } from "./add-pump";
import {
  HydraulicModelBuilder,
  buildJunction,
  buildPump,
} from "../../__helpers__/hydraulic-model-builder";
import { Pump } from "../asset-types";

describe("addPump", () => {
  it("updates connections", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
    const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

    const pump = buildPump({
      coordinates: [
        [10, 10],
        [20, 20],
        [30, 30],
      ],
      id: "pump",
    });

    const { putAssets } = addPump(hydraulicModel, {
      startNode,
      endNode,
      pump,
    });

    expect(putAssets![0].id).toEqual("pump");
    const pumpToCreate = putAssets![0] as Pump;
    expect(pumpToCreate.connections).toEqual(["A", "B"]);
  });

  it("removes redundant vertices", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
    const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

    const pump = buildPump({
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
      id: "pump",
    });

    const { putAssets } = addPump(hydraulicModel, {
      startNode,
      endNode,
      pump,
    });

    const pumpToCreate = putAssets![0] as Pump;
    expect(pumpToCreate.id).toEqual("pump");
    expect(pumpToCreate.coordinates).toEqual([
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
    const pump = buildPump({
      coordinates: [
        [10, 11],
        [15, 15],
        [19 + 1e-10, 20],
        [19, 20],
      ],
      id: "pump",
    });

    const { putAssets } = addPump(hydraulicModel, {
      startNode,
      endNode,
      pump,
    });

    const pumpToCreate = putAssets![0] as Pump;
    expect(pumpToCreate.id).toEqual("pump");
    expect(pumpToCreate.coordinates).toEqual([
      [10, 10],
      [15, 15],
      [20, 20],
    ]);
  });

  it("calculates pump length", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startCoordinates = [-4.3760931, 55.9150083];
    const endCoordiantes = [-4.3771833, 55.9133641];
    const startNode = buildJunction({ coordinates: startCoordinates });
    const endNode = buildJunction({ coordinates: endCoordiantes });
    const pump = buildPump({
      coordinates: [startCoordinates, endCoordiantes],
      id: "pump",
    });

    const { putAssets } = addPump(hydraulicModel, {
      startNode,
      endNode,
      pump,
    });

    const pumpToCreate = putAssets![0] as Pump;
    expect(pumpToCreate.id).toEqual("pump");
    expect(pumpToCreate.length).toBeCloseTo(195.04);
  });

  it("adds a label to the pump", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction();
    const endNode = buildJunction();
    const pump = buildPump({
      id: "pump",
      label: "",
    });

    const { putAssets } = addPump(hydraulicModel, {
      startNode,
      endNode,
      pump,
    });

    const pumpToCreate = putAssets![0] as Pump;
    expect(pumpToCreate.id).toEqual("pump");
    expect(pumpToCreate.label).toEqual("PU1");
  });

  it("adds a label to the nodes when missing", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const startNode = buildJunction({ label: "" });
    const endNode = buildJunction({ label: "CUSTOM" });
    const pump = buildPump({
      id: "pump",
      label: "",
    });

    const { putAssets } = addPump(hydraulicModel, {
      startNode,
      endNode,
      pump,
    });

    const [, nodeA, nodeB] = putAssets || [];
    expect(nodeA.label).toEqual("J1");
    expect(nodeB.label).toEqual("CUSTOM");
  });
});
