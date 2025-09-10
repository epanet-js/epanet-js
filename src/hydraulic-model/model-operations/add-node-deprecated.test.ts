import { describe, expect, it } from "vitest";
import { addNodeDeprecated } from "./add-node-deprecated";
import {
  HydraulicModelBuilder,
  buildJunction,
  buildReservoir,
} from "../../__helpers__/hydraulic-model-builder";
import { Junction, Reservoir } from "../asset-types";

describe("addNode", () => {
  it("creates a copy of the node", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const node = buildJunction({ coordinates: [10, 10], id: "A" });

    const { putAssets } = addNodeDeprecated(hydraulicModel, {
      node,
    });

    expect(putAssets![0].id).toEqual("A");
    const junctionToCreate = putAssets![0] as Junction;
    expect(junctionToCreate.coordinates).toEqual([10, 10]);
  });

  it("adds a label to the junction when missing", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const node = buildJunction({
      id: "junction",
      label: "",
    });

    const { putAssets } = addNodeDeprecated(hydraulicModel, {
      node,
    });

    const junctionToCreate = putAssets![0] as Junction;
    expect(junctionToCreate.id).toEqual("junction");
    expect(junctionToCreate.label).toEqual("J1");
  });

  it("preserves existing label when present", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const node = buildJunction({
      id: "junction",
      label: "CUSTOM",
    });

    const { putAssets } = addNodeDeprecated(hydraulicModel, {
      node,
    });

    const junctionToCreate = putAssets![0] as Junction;
    expect(junctionToCreate.id).toEqual("junction");
    expect(junctionToCreate.label).toEqual("CUSTOM");
  });

  it("adds a label to the reservoir when missing", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const node = buildReservoir({
      id: "reservoir",
      label: "",
    });

    const { putAssets } = addNodeDeprecated(hydraulicModel, {
      node,
    });

    const reservoirToCreate = putAssets![0] as Reservoir;
    expect(reservoirToCreate.id).toEqual("reservoir");
    expect(reservoirToCreate.label).toEqual("R1");
  });

  it("returns proper note for junction", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const node = buildJunction({ id: "junction" });

    const { note } = addNodeDeprecated(hydraulicModel, {
      node,
    });

    expect(note).toEqual("Add junction");
  });

  it("returns proper note for reservoir", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();
    const node = buildReservoir({ id: "reservoir" });

    const { note } = addNodeDeprecated(hydraulicModel, {
      node,
    });

    expect(note).toEqual("Add reservoir");
  });
});
