import { splitPipe } from "./split-pipe";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { Pipe } from "../asset-types/pipe";

describe("splitPipe", () => {
  it("splits a pipe at specified coordinates", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets, deleteAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    expect(putAssets).toHaveLength(2);
    expect(deleteAssets).toEqual([IDS.P1]);

    const [pipe1, pipe2] = putAssets as Pipe[];
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
    expect(pipe1.connections).toEqual([IDS.J1, splitNode.id]);
    expect(pipe2.connections).toEqual([splitNode.id, IDS.J2]);
  });

  it("generates correct labels for split pipes", () => {
    const IDS = { J1: 1, J2: 2, MainPipe: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.MainPipe, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        label: "MainPipe",
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.MainPipe) as Pipe;
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
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      TestPipe: 5,
      TestPipe_1: 6,
    } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 5])
      .aNode(IDS.J4, [10, 5])
      .aPipe(IDS.TestPipe, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        label: "TestPipe",
      })
      .aPipe(IDS.TestPipe_1, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        label: "TestPipe_1",
      })
      .build();

    hydraulicModel.labelManager.register("TestPipe_1", "pipe", IDS.TestPipe_1);

    const pipe = hydraulicModel.assets.get(IDS.TestPipe) as Pipe;
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
    const IDS = { J1: 1, J2: 2, MYLABEL_1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.MYLABEL_1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        label: "MYLABEL_1",
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.MYLABEL_1) as Pipe;
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
    const IDS = { J1: 1, J2: 2 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
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
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
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
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;

    expect(() => {
      splitPipe(hydraulicModel, {
        pipe,
        splits: [],
      });
    }).toThrow("At least one split is required");
  });

  it("uses split coordinates exactly as split point", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const splitCoordinates: [number, number] = [5.123, 0.456];

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
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
    const IDS = { J1: 1, J2: 2, MY_PIPE: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [0.00009, 0])
      .aPipe(IDS.MY_PIPE, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        label: "MY_PIPE",
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.MY_PIPE) as Pipe;
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
    expect(deleteAssets).toEqual([IDS.MY_PIPE]);

    const [pipe1, pipe2, pipe3] = putAssets as Pipe[];

    expect(pipe1.label).toBe("MY_PIPE");
    expect(pipe2.label).toBe("MY_PIPE_1");
    expect(pipe3.label).toBe("MY_PIPE_2");

    expect(pipe1.connections).toEqual([IDS.J1, splitNode1.id]);
    expect(pipe2.connections).toEqual([splitNode1.id, splitNode2.id]);
    expect(pipe3.connections).toEqual([splitNode2.id, IDS.J2]);

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
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 10])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 5],
          [20, 10],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
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

    const [pipe1, pipe2, pipe3] = putAssets as Pipe[];

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
    const IDS = { J1: 1, J2: 2 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
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
    const IDS = { J1: 1, J2: 2, REVERSE_TEST: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.REVERSE_TEST, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        label: "REVERSE_TEST",
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.REVERSE_TEST) as Pipe;
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

    const [pipe1, pipe2, pipe3] = putAssets as Pipe[];

    expect(pipe1.label).toBe("REVERSE_TEST");
    expect(pipe2.label).toBe("REVERSE_TEST_1");
    expect(pipe3.label).toBe("REVERSE_TEST_2");

    expect(pipe1.connections).toEqual([IDS.J1, splitNode2.id]);
    expect(pipe2.connections).toEqual([splitNode2.id, splitNode1.id]);
    expect(pipe3.connections).toEqual([splitNode1.id, IDS.J2]);

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
    const IDS = { J1: 1, J2: 2, MULTI_VERTEX: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [100, 0])
      .aPipe(IDS.MULTI_VERTEX, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
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

    const pipe = hydraulicModel.assets.get(IDS.MULTI_VERTEX) as Pipe;
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

  it("reconnects customer points to appropriate split segments", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const customerPoint1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 50,
    });
    const customerPoint2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [8, 1],
      demand: 75,
    });

    // Connect customer points to the original pipe
    customerPoint1.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPoint2.connect({
      pipeId: IDS.P1,
      snapPoint: [8, 0],
      junctionId: IDS.J2,
    });

    hydraulicModel.customerPoints.set(customerPoint1.id, customerPoint1);
    hydraulicModel.customerPoints.set(customerPoint2.id, customerPoint2);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint1);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint2);

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets, putCustomerPoints } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    expect(putAssets).toHaveLength(2);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints).toHaveLength(2);

    const [reconnectedCP1, reconnectedCP2] = putCustomerPoints!;
    const [splitPipeWithActiveTopology1, splitPipeWithActiveTopology2] =
      putAssets as Pipe[];

    // Customer point 1 should connect to the first split (closer to J1)
    expect(reconnectedCP1.connection?.pipeId).toBe(
      splitPipeWithActiveTopology1.id,
    );
    expect(reconnectedCP1.connection?.junctionId).toBe(IDS.J1);

    // Customer point 2 should connect to the second split (closer to J2)
    expect(reconnectedCP2.connection?.pipeId).toBe(
      splitPipeWithActiveTopology2.id,
    );
    expect(reconnectedCP2.connection?.junctionId).toBe(IDS.J2);
  });

  it("handles multiple splits with customer points correctly", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5, CP3: 6 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const customerPoint1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [3, 1],
      demand: 30,
    });
    const customerPoint2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [10, 1],
      demand: 50,
    });
    const customerPoint3 = buildCustomerPoint(IDS.CP3, {
      coordinates: [17, 1],
      demand: 40,
    });

    // Connect customer points to original pipe at different locations
    customerPoint1.connect({
      pipeId: IDS.P1,
      snapPoint: [3, 0],
      junctionId: IDS.J1,
    });
    customerPoint2.connect({
      pipeId: IDS.P1,
      snapPoint: [10, 0],
      junctionId: IDS.J1,
    });
    customerPoint3.connect({
      pipeId: IDS.P1,
      snapPoint: [17, 0],
      junctionId: IDS.J2,
    });

    hydraulicModel.customerPoints.set(customerPoint1.id, customerPoint1);
    hydraulicModel.customerPoints.set(customerPoint2.id, customerPoint2);
    hydraulicModel.customerPoints.set(customerPoint3.id, customerPoint3);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint1);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint2);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint3);

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode1 = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [7, 0],
    });
    const splitNode2 = hydraulicModel.assetBuilder.buildJunction({
      label: "J4",
      coordinates: [14, 0],
    });

    const { putAssets, putCustomerPoints } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode1, splitNode2],
    });

    expect(putAssets).toHaveLength(3);
    expect(putCustomerPoints).toHaveLength(3);

    const [pipe1, pipe2, pipe3] = putAssets as Pipe[];
    const reconnectedPoints = putCustomerPoints!;

    // Verify each customer point is connected to the correct split segment
    const cp1Reconnected = reconnectedPoints.find((cp) => cp.id === IDS.CP1);
    const cp2Reconnected = reconnectedPoints.find((cp) => cp.id === IDS.CP2);
    const cp3Reconnected = reconnectedPoints.find((cp) => cp.id === IDS.CP3);

    expect(cp1Reconnected?.connection?.pipeId).toBe(pipe1.id); // [0,0] to [7,0]
    expect(cp2Reconnected?.connection?.pipeId).toBe(pipe2.id); // [7,0] to [14,0]
    expect(cp3Reconnected?.connection?.pipeId).toBe(pipe3.id); // [14,0] to [20,0]
  });

  it("handles split with no customer points connected", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets, putCustomerPoints } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    expect(putAssets).toHaveLength(2);
    expect(putCustomerPoints).toBeUndefined();
  });

  it("preserves customer point properties when reconnecting", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const customerPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [3, 1],
      demand: 125,
    });

    customerPoint.connect({
      pipeId: IDS.P1,
      snapPoint: [3, 0],
      junctionId: IDS.J1,
    });

    hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint);

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets, putCustomerPoints } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    expect(putAssets).toHaveLength(2);
    expect(putCustomerPoints).toHaveLength(1);

    const reconnectedPoint = putCustomerPoints![0];
    expect(reconnectedPoint.id).toBe(IDS.CP1);
    expect(reconnectedPoint.baseDemand).toBe(125);
    expect(reconnectedPoint.coordinates).toEqual([3, 1]);
    expect(reconnectedPoint.connection?.snapPoint).toEqual([3, 0]);
  });

  it("disconnects customer points when split has no junctions", () => {
    const IDS = { R1: 1, J1: 2, P1: 3, CP1: 4, CP2: 5 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { coordinates: [0, 0] })
      .aNode(IDS.J1, [10, 0])
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const customerPoint1 = buildCustomerPoint(IDS.CP1, {
      coordinates: [2, 1],
      demand: 50,
    });
    const customerPoint2 = buildCustomerPoint(IDS.CP2, {
      coordinates: [8, 1],
      demand: 75,
    });

    customerPoint1.connect({
      pipeId: IDS.P1,
      snapPoint: [2, 0],
      junctionId: IDS.J1,
    });
    customerPoint2.connect({
      pipeId: IDS.P1,
      snapPoint: [8, 0],
      junctionId: IDS.J1,
    });

    hydraulicModel.customerPoints.set(customerPoint1.id, customerPoint1);
    hydraulicModel.customerPoints.set(customerPoint2.id, customerPoint2);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint1);
    hydraulicModel.customerPointsLookup.addConnection(customerPoint2);

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitReservoir = hydraulicModel.assetBuilder.buildReservoir({
      label: "R2",
      coordinates: [5, 0],
    });

    const { putAssets, putCustomerPoints } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitReservoir],
    });

    expect(putAssets).toHaveLength(2);
    expect(putCustomerPoints).toHaveLength(2);

    const [splitPipeWithActiveTopology1, splitPipeWithActiveTopology2] =
      putAssets as Pipe[];
    const [reconnectedCP1, reconnectedCP2] = putCustomerPoints!;

    expect(splitPipeWithActiveTopology1.connections).toEqual([
      IDS.R1,
      splitReservoir.id,
    ]);
    expect(splitPipeWithActiveTopology2.connections).toEqual([
      splitReservoir.id,
      IDS.J1,
    ]);

    const cp1 = reconnectedCP1.id === IDS.CP1 ? reconnectedCP1 : reconnectedCP2;
    const cp2 = reconnectedCP1.id === IDS.CP2 ? reconnectedCP1 : reconnectedCP2;

    expect(cp1.connection).toBeNull();
    expect(cp2.connection?.pipeId).toBe(splitPipeWithActiveTopology2.id);
    expect(cp2.connection?.junctionId).toBe(IDS.J1);
  });

  it("removes matching vertex when splitting at vertex location", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [5, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets as Pipe[];
    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [5, 0],
      [10, 0],
    ]);
  });

  it("handles multiple vertices correctly", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
          [15, 0],
          [20, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [10, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets as Pipe[];
    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [10, 0],
      [15, 0],
      [20, 0],
    ]);
  });

  it("does not remove first or last vertex", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNodeAtStart = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [0, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNodeAtStart],
    });

    const [pipe1, pipe2] = putAssets as Pipe[];
    expect(pipe1.coordinates.length).toBeGreaterThan(1);
    expect(pipe2.coordinates.length).toBeGreaterThan(1);
  });

  it("preserves all intermediate vertices when splitting at middle vertex", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [100, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [25, 0],
          [50, 0],
          [75, 0],
          [100, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [50, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets as Pipe[];

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [25, 0],
      [50, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [50, 0],
      [75, 0],
      [100, 0],
    ]);
  });

  it("splits correctly when split point is very close to a vertex", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [0.0001, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [0.000025, 0],
          [0.00005, 0],
          [0.000075, 0],
          [0.0001, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [0.000049, 0],
    });

    const { putAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    const [pipe1, pipe2] = putAssets as Pipe[];

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [0.000025, 0],
      [0.000049, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [0.000049, 0],
      [0.00005, 0],
      [0.000075, 0],
      [0.0001, 0],
    ]);
  });

  it("splits 3-vertex pipe when snapping exactly to middle vertex", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
          [20, 0],
        ],
      })
      .build();

    const pipe = hydraulicModel.assets.get(IDS.P1) as Pipe;
    const splitNode = hydraulicModel.assetBuilder.buildJunction({
      label: "J3",
      coordinates: [10, 0],
    });

    const { putAssets, deleteAssets } = splitPipe(hydraulicModel, {
      pipe,
      splits: [splitNode],
    });

    expect(deleteAssets).toEqual([IDS.P1]);
    expect(putAssets).toHaveLength(2);

    const [pipe1, pipe2] = putAssets as Pipe[];

    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(pipe2.coordinates).toEqual([
      [10, 0],
      [20, 0],
    ]);
    expect(pipe1.connections).toEqual([IDS.J1, splitNode.id]);
    expect(pipe2.connections).toEqual([splitNode.id, IDS.J2]);
  });

  it("preserves isActive when splitting active pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: true,
      })
      .build();

    const pipe = model.assets.get(IDS.P1) as Pipe;
    const splitNode = model.assetBuilder.buildJunction({
      coordinates: [50, 0],
    });

    const moment = splitPipe(model, {
      pipe,
      splits: [splitNode],
    });

    const { putAssets } = moment;
    expect(putAssets).toHaveLength(2);

    const [pipe1, pipe2] = putAssets as Pipe[];
    expect(pipe1.isActive).toBe(true);
    expect(pipe2.isActive).toBe(true);
  });

  it("preserves isActive when splitting inactive pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const pipe = model.assets.get(IDS.P1) as Pipe;
    const splitNode = model.assetBuilder.buildJunction({
      coordinates: [50, 0],
    });

    const moment = splitPipe(model, {
      pipe,
      splits: [splitNode],
    });

    const { putAssets } = moment;
    expect(putAssets).toHaveLength(2);

    const [pipe1, pipe2] = putAssets as Pipe[];
    expect(pipe1.isActive).toBe(false);
    expect(pipe2.isActive).toBe(false);
  });

  it("creates inactive split segments when original pipe is inactive", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [150, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const pipe = model.assets.get(IDS.P1) as Pipe;
    const splitNode1 = model.assetBuilder.buildJunction({
      coordinates: [50, 0],
    });
    const splitNode2 = model.assetBuilder.buildJunction({
      coordinates: [100, 0],
    });

    const moment = splitPipe(model, {
      pipe,
      splits: [splitNode1, splitNode2],
    });

    const { putAssets } = moment;
    expect(putAssets).toHaveLength(3);

    const pipes = putAssets as Pipe[];
    expect(pipes[0].isActive).toBe(false);
    expect(pipes[1].isActive).toBe(false);
    expect(pipes[2].isActive).toBe(false);
  });
});
