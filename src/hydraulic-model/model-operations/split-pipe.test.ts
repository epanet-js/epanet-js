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

    const pipe = hydraulicModel.assets.get("P1") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets, deleteAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
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
    expect((pipe1 as Pipe).connections).toEqual(["J1", splitNode.id]);
    expect((pipe2 as Pipe).connections).toEqual([splitNode.id, "J2"]);
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

    const pipe = hydraulicModel.assets.get("MainPipe") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
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

    const pipe = hydraulicModel.assets.get("TestPipe") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J5",
      coordinates: [5, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
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

    const pipe = hydraulicModel.assets.get("MYLABEL_1") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
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

    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe: originalPipe,
      splits: [splitNode],
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

    const pipe = hydraulicModel.assets.get("P1") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets!;

    const length1 = (pipe1 as Pipe).length;
    const length2 = (pipe2 as Pipe).length;

    expect(length1).toBeGreaterThan(0);
    expect(length2).toBeGreaterThan(0);
    expect(length1).toBeLessThan(length1 + length2);
  });

  it("throws error when no splits provided", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const pipe = hydraulicModel.assets.get("P1") as Pipe;

    expect(() => {
      splitPipe(hydraulicModel, {
        pipe,
        splits: [],
      });
    }).toThrow("At least one split is required");
  });

  it("uses split coordinates exactly as split point", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const splitCoordinates: [number, number] = [5.123, 0.456];

    const pipe = hydraulicModel.assets.get("P1") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: splitCoordinates,
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets!;

    expect(pipe1.coordinates[pipe1.coordinates.length - 1]).toEqual(
      splitCoordinates,
    );
    expect(pipe2.coordinates[0]).toEqual(splitCoordinates);
  });

  it("stress test: splits pipe with 2 splits producing 3 pipes with correct labels and lengths", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [0.00009, 0])
      .aPipe("MY_PIPE", {
        startNodeId: "J1",
        endNodeId: "J2",
        label: "MY_PIPE",
      })
      .build();

    const pipe = hydraulicModel.assets.get("MY_PIPE") as Pipe;
    const splitNode1 = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [0.000027, 0],
    });
    const splitNode2 = hydraulicModel.assetBuilder.buildJunction({
      label: "J4",
      coordinates: [0.000063, 0],
    });

    const { putAssets, deleteAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode1, splitNode2],
    });

    expect(putAssets).toHaveLength(3);
    expect(deleteAssets).toEqual(["MY_PIPE"]);

    const [pipe1, pipe2, pipe3] = putAssets! as Pipe[];

    expect(pipe1.label).toBe("MY_PIPE");
    expect(pipe2.label).toBe("MY_PIPE_1");
    expect(pipe3.label).toBe("MY_PIPE_2");

    expect(pipe1.connections).toEqual(["J1", splitNode1.id]);
    expect(pipe2.connections).toEqual([splitNode1.id, splitNode2.id]);
    expect(pipe3.connections).toEqual([splitNode2.id, "J2"]);

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [0.000027, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [0.000027, 0],
      [0.000063, 0],
    ]);
    expect(pipe3.coordinates).toEqual([
      [0.000063, 0],
      [0.00009, 0],
    ]);

    const totalLength = pipe1.length + pipe2.length + pipe3.length;
    expect(totalLength).toBeCloseTo(10, 0);
    expect(pipe1.length).toBeCloseTo(3, 0);
    expect(pipe2.length).toBeCloseTo(4, 0);
    expect(pipe3.length).toBeCloseTo(3, 0);
  });

  it("handles multiple splits with complex coordinates", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [20, 10])
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [10, 5],
          [20, 10],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get("P1") as Pipe;
    const splitNode1 = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 2.5],
    });
    const splitNode2 = hydraulicModel.assetBuilder.buildJunction({
      label: "J4",
      coordinates: [15, 7.5],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode1, splitNode2],
    });

    expect(putAssets).toHaveLength(3);

    const [pipe1, pipe2, pipe3] = putAssets! as Pipe[];

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [5, 2.5],
    ]);
    expect(pipe2.coordinates).toEqual([
      [5, 2.5],
      [10, 5],
      [15, 7.5],
    ]);
    expect(pipe3.coordinates).toEqual([
      [15, 7.5],
      [20, 10],
    ]);
  });

  it("preserves all properties across multiple segments", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .build();

    const originalPipe = hydraulicModel.assetBuilder.buildPipe({
      label: "TestPipe",
      coordinates: [
        [0, 0],
        [10, 0],
      ],
    });
    originalPipe.setProperty("diameter", 300);
    originalPipe.setProperty("roughness", 0.15);
    originalPipe.setProperty("minorLoss", 0.8);
    originalPipe.setProperty("initialStatus", "closed");

    hydraulicModel.assets.set(originalPipe.id, originalPipe);

    const splitNode1 = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [3, 0],
    });
    const splitNode2 = hydraulicModel.assetBuilder.buildJunction({
      label: "J4",
      coordinates: [7, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe: originalPipe,
      splits: [splitNode1, splitNode2],
    });

    const [pipe1, pipe2, pipe3] = putAssets! as Pipe[];

    [pipe1, pipe2, pipe3].forEach((pipe) => {
      expect(pipe.getProperty("diameter")).toBe(300);
      expect(pipe.getProperty("roughness")).toBe(0.15);
      expect(pipe.getProperty("minorLoss")).toBe(0.8);
      expect(pipe.getProperty("initialStatus")).toBe("closed");
      expect(pipe.length).toBeGreaterThan(0);
    });
  });

  it("handles splits in reverse order correctly", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aPipe("REVERSE_TEST", {
        startNodeId: "J1",
        endNodeId: "J2",
        label: "REVERSE_TEST",
      })
      .build();

    const pipe = hydraulicModel.assets.get("REVERSE_TEST") as Pipe;
    const splitNode1 = hydraulicModel.assetBuilder.buildJunction({
      label: "J4",
      coordinates: [7, 0],
    });
    const splitNode2 = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [3, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode1, splitNode2],
    });

    expect(putAssets).toHaveLength(3);

    const [pipe1, pipe2, pipe3] = putAssets! as Pipe[];

    expect(pipe1.label).toBe("REVERSE_TEST");
    expect(pipe2.label).toBe("REVERSE_TEST_1");
    expect(pipe3.label).toBe("REVERSE_TEST_2");

    expect(pipe1.connections).toEqual(["J1", splitNode2.id]);
    expect(pipe2.connections).toEqual([splitNode2.id, splitNode1.id]);
    expect(pipe3.connections).toEqual([splitNode1.id, "J2"]);

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [3, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [3, 0],
      [7, 0],
    ]);
    expect(pipe3.coordinates).toEqual([
      [7, 0],
      [10, 0],
    ]);
  });

  it("preserves vertices correctly when split between vertices", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [100, 0])
      .aPipe("MULTI_VERTEX", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [20, 0],
          [40, 0],
          [60, 0],
          [80, 0],
          [100, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get("MULTI_VERTEX") as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [33, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets! as Pipe[];

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [20, 0],
      [33, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [33, 0],
      [40, 0],
      [60, 0],
      [80, 0],
      [100, 0],
    ]);
  });
});
