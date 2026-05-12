import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { deriveProfilePath, findProfilePath } from "./path-finding";

describe("findProfilePath", () => {
  it("picks the shorter of two parallel branches when nothing is blocked", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      shortPipe1: 4,
      shortPipe2: 5,
      longPipe: 6,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.shortPipe1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.shortPipe2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.longPipe, {
        startNodeId: IDS.A,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.shortPipe1, IDS.shortPipe2]);
    expect(path!.totalLength).toBe(20);
  });

  it("returns null for disconnected nodes", () => {
    const IDS = { A: 1, B: 2, C: 3, P1: 4 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [5, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 1,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path).toBeNull();
  });

  it("returns null when start equals end", () => {
    const IDS = { A: 1, B: 2, P1: 3 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 1,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.A);

    expect(path).toBeNull();
  });

  it("routes around a closed pipe", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      shortClosed: 5,
      shortClosedTail: 6,
      longOpen1: 7,
      longOpen2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.shortClosed, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        initialStatus: "closed",
      })
      .aPipe(IDS.shortClosedTail, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.longOpen1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.longOpen2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path!.linkIds).toEqual([IDS.longOpen1, IDS.longOpen2]);
  });

  it("routes around a pump that is initially off", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      pumpOff: 5,
      pipeTail: 6,
      detour1: 7,
      detour2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPump(IDS.pumpOff, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        initialStatus: "off",
      })
      .aPipe(IDS.pipeTail, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 1,
      })
      .aPipe(IDS.detour1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.detour2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path!.linkIds).toEqual([IDS.detour1, IDS.detour2]);
  });

  it("routes around a closed valve", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      valveClosed: 5,
      pipeTail: 6,
      detour1: 7,
      detour2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aValve(IDS.valveClosed, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        initialStatus: "closed",
      })
      .aPipe(IDS.pipeTail, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 1,
      })
      .aPipe(IDS.detour1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.detour2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path!.linkIds).toEqual([IDS.detour1, IDS.detour2]);
  });

  it("returns null when every route is blocked by initialStatus", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      closed1: 5,
      closed2: 6,
      closed3: 7,
      closed4: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.closed1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        initialStatus: "closed",
      })
      .aPipe(IDS.closed2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
        initialStatus: "closed",
      })
      .aPipe(IDS.closed3, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 10,
        initialStatus: "closed",
      })
      .aPipe(IDS.closed4, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 10,
        initialStatus: "closed",
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path).toBeNull();
  });

  it("treats inactive links as blocked and takes the active detour", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      inactive: 5,
      inactiveTail: 6,
      detour1: 7,
      detour2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.inactive, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        isActive: false,
      })
      .aPipe(IDS.inactiveTail, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.detour1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.detour2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path!.linkIds).toEqual([IDS.detour1, IDS.detour2]);
  });

  it("traverses valves whose initialStatus is active", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      valve: 4,
      tail: 5,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aValve(IDS.valve, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        initialStatus: "active",
      })
      .aPipe(IDS.tail, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 1,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.valve, IDS.tail]);
  });

  it("traverses check-valve pipes (initialStatus cv)", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      cvPipe: 4,
      tail: 5,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.cvPipe, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 1,
        initialStatus: "cv",
      })
      .aPipe(IDS.tail, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 1,
      })
      .build();

    const path = findProfilePath(model.topology, model.assets, IDS.A, IDS.C);

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.cvPipe, IDS.tail]);
  });
});

describe("deriveProfilePath", () => {
  it("matches findProfilePath for two anchors", () => {
    const IDS = { A: 1, B: 2, C: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.A, endNodeId: IDS.B, length: 10 })
      .aPipe(IDS.P2, { startNodeId: IDS.B, endNodeId: IDS.C, length: 10 })
      .build();

    const path = deriveProfilePath(model.topology, model.assets, [
      IDS.A,
      IDS.C,
    ]);

    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([IDS.A, IDS.B, IDS.C]);
    expect(path!.linkIds).toEqual([IDS.P1, IDS.P2]);
    expect(path!.totalLength).toBe(20);
  });

  it("returns null when an anchor is missing from the model", () => {
    const IDS = { A: 1, B: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.A, endNodeId: IDS.B, length: 10 })
      .build();

    const path = deriveProfilePath(model.topology, model.assets, [IDS.A, 999]);

    expect(path).toBeNull();
  });

  it("returns null when any sub-path has no route", () => {
    const IDS = { A: 1, B: 2, C: 3, P1: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [5, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.A, endNodeId: IDS.B, length: 10 })
      .build();

    const path = deriveProfilePath(model.topology, model.assets, [
      IDS.A,
      IDS.C,
    ]);

    expect(path).toBeNull();
  });

  it("concatenates sub-paths between three anchors", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      P_AB: 5,
      P_BC: 6,
      P_CD: 7,
      P_AC: 8,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [3, 0] })
      .aPipe(IDS.P_AB, { startNodeId: IDS.A, endNodeId: IDS.B, length: 10 })
      .aPipe(IDS.P_BC, { startNodeId: IDS.B, endNodeId: IDS.C, length: 10 })
      .aPipe(IDS.P_CD, { startNodeId: IDS.C, endNodeId: IDS.D, length: 10 })
      .aPipe(IDS.P_AC, { startNodeId: IDS.A, endNodeId: IDS.C, length: 1 })
      .build();

    const path = deriveProfilePath(model.topology, model.assets, [
      IDS.A,
      IDS.B,
      IDS.D,
    ]);

    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([IDS.A, IDS.B, IDS.C, IDS.D]);
    expect(path!.linkIds).toEqual([IDS.P_AB, IDS.P_BC, IDS.P_CD]);
    expect(path!.totalLength).toBe(30);
  });

  it("returns null for fewer than two anchors", () => {
    const IDS = { A: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .build();

    expect(deriveProfilePath(model.topology, model.assets, [])).toBeNull();
    expect(deriveProfilePath(model.topology, model.assets, [IDS.A])).toBeNull();
  });
});
