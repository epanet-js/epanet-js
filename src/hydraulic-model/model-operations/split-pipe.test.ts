import { splitPipe } from "./split-pipe";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Pipe } from "../asset-types/pipe";

describe("splitPipe", () => {
  it("splits a pipe at specified coordinates", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const newNodeId = "J3";

    const { putAssets, deleteAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: "P1",
      splitCoordinates: [5, 0],
      newNodeId,
    });

    expect(putAssets).toHaveLength(2);
    expect(deleteAssets).toEqual(["P1"]);

    const [pipe1, pipe2] = putAssets!;
    expect(pipe1.type).toBe("pipe");
    expect(pipe2.type).toBe("pipe");
    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [5, 0],
      [10, 0],
    ]);
    expect((pipe1 as Pipe).connections).toEqual(["J1", newNodeId]);
    expect((pipe2 as Pipe).connections).toEqual([newNodeId, "J2"]);
  });

  it("generates correct labels for split pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("MainPipe", {
        startNodeId: "J1",
        endNodeId: "J2",
        label: "MainPipe",
      })
      .build();

    const { putAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: "MainPipe",
      splitCoordinates: [5, 0],
      newNodeId: "J3",
    });

    const [pipe1, pipe2] = putAssets!;
    expect(pipe1.label).toBe("MainPipe");
    expect(pipe2.label).toBe("MainPipe_1");
  });

  it("handles label collisions correctly", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aNode("J3", [0, 5])
      .aNode("J4", [10, 5])
      .aPipe("TestPipe", {
        startNodeId: "J1",
        endNodeId: "J2",
        label: "TestPipe",
      })
      .aPipe("TestPipe_1", {
        startNodeId: "J3",
        endNodeId: "J4",
        label: "TestPipe_1",
      })
      .build();

    hydraulicModel.labelManager.register("TestPipe_1", "pipe", "TestPipe_1");

    const { putAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: "TestPipe",
      splitCoordinates: [5, 0],
      newNodeId: "J5",
    });

    const [pipe1, pipe2] = putAssets!;
    expect(pipe1.label).toBe("TestPipe");
    expect(pipe2.label).toBe("TestPipe_2");
  });

  it("follows logical progression when splitting numbered pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("MYLABEL_1", {
        startNodeId: "J1",
        endNodeId: "J2",
        label: "MYLABEL_1",
      })
      .build();

    const { putAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: "MYLABEL_1",
      splitCoordinates: [5, 0],
      newNodeId: "J3",
    });

    const [pipe1, pipe2] = putAssets!;
    expect(pipe1.label).toBe("MYLABEL_1");
    expect(pipe2.label).toBe("MYLABEL_2");
  });

  it("copies all properties from original pipe", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .build();

    const originalPipe = hydraulicModel.assetBuilder.buildPipe({
      label: "SpecialPipe",
      coordinates: [
        [0, 0],
        [10, 0],
      ],
    });
    originalPipe.setProperty("diameter", 200);
    originalPipe.setProperty("roughness", 0.1);
    originalPipe.setProperty("minorLoss", 0.5);
    originalPipe.setProperty("initialStatus", "open");

    hydraulicModel.assets.set(originalPipe.id, originalPipe);

    const { putAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: originalPipe.id,
      splitCoordinates: [5, 0],
      newNodeId: "J3",
    });

    const [pipe1, pipe2] = putAssets!;

    expect(pipe1.getProperty("diameter")).toBe(200);
    expect(pipe1.getProperty("roughness")).toBe(0.1);
    expect(pipe1.getProperty("minorLoss")).toBe(0.5);
    expect(pipe1.getProperty("initialStatus")).toBe("open");

    expect(pipe2.getProperty("diameter")).toBe(200);
    expect(pipe2.getProperty("roughness")).toBe(0.1);
    expect(pipe2.getProperty("minorLoss")).toBe(0.5);
    expect(pipe2.getProperty("initialStatus")).toBe("open");
  });

  it("updates lengths for split pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const { putAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: "P1",
      splitCoordinates: [5, 0],
      newNodeId: "J3",
    });

    const [pipe1, pipe2] = putAssets!;

    const length1 = (pipe1 as Pipe).length;
    const length2 = (pipe2 as Pipe).length;

    expect(length1).toBeGreaterThan(0);
    expect(length2).toBeGreaterThan(0);
    expect(length1).toBeLessThan(length1 + length2);
  });

  it("throws error for invalid pipe ID", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .build();

    expect(() => {
      splitPipe(hydraulicModel, {
        pipeIdToSplit: "nonexistent",
        splitCoordinates: [5, 0],
        newNodeId: "J2",
      });
    }).toThrow("Invalid pipe ID: nonexistent");
  });

  it("uses split coordinates exactly as split point", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const splitCoordinates: [number, number] = [5.123, 0.456];

    const { putAssets } = splitPipe(hydraulicModel, {
      pipeIdToSplit: "P1",
      splitCoordinates,
      newNodeId: "J3",
    });

    const [pipe1, pipe2] = putAssets!;

    expect(pipe1.coordinates[pipe1.coordinates.length - 1]).toEqual(
      splitCoordinates,
    );
    expect(pipe2.coordinates[0]).toEqual(splitCoordinates);
  });
});
