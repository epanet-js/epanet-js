import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { createMockResultsReader } from "src/__helpers__/state";
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

  it("uses a closed pipe when it's the shortest route", () => {
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

    expect(path!.linkIds).toEqual([IDS.shortClosed, IDS.shortClosedTail]);
  });

  it("uses an off pump when it's the shortest route", () => {
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

    expect(path!.linkIds).toEqual([IDS.pumpOff, IDS.pipeTail]);
  });

  it("uses a closed valve when it's the shortest route", () => {
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

    expect(path!.linkIds).toEqual([IDS.valveClosed, IDS.pipeTail]);
  });

  it("returns a route through closed-status links when no other connection exists", () => {
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

    expect(path).not.toBeNull();
    expect(path!.linkIds.length).toBe(2);
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

describe("path-finding with flow weighting", () => {
  it("prefers the higher-flow branch when results are provided", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      lowFlow1: 5,
      lowFlow2: 6,
      highFlow1: 7,
      highFlow2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.lowFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.lowFlow2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.highFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.highFlow2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const results = createMockResultsReader({
      pipes: {
        [IDS.lowFlow1]: { flow: 0.01 },
        [IDS.lowFlow2]: { flow: 0.01 },
        [IDS.highFlow1]: { flow: 100 },
        [IDS.highFlow2]: { flow: 100 },
      },
    });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path!.linkIds).toEqual([IDS.highFlow1, IDS.highFlow2]);
  });

  it("falls back to length-based weighting when results is null", () => {
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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

    expect(path!.linkIds).toEqual([IDS.shortPipe1, IDS.shortPipe2]);
  });

  it("prefers the open route over a closed one because the closed pipe has near-zero flow", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      shortClosedNoFlow: 5,
      shortTail: 6,
      longOpen1: 7,
      longOpen2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.shortClosedNoFlow, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        initialStatus: "closed",
      })
      .aPipe(IDS.shortTail, {
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

    const results = createMockResultsReader({
      pipes: {
        [IDS.shortClosedNoFlow]: { flow: 0, status: "closed" },
        [IDS.shortTail]: { flow: 100, status: "open" },
        [IDS.longOpen1]: { flow: 100, status: "open" },
        [IDS.longOpen2]: { flow: 100, status: "open" },
      },
    });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path!.linkIds).toEqual([IDS.longOpen1, IDS.longOpen2]);
  });

  it("routes through a valve that is closed initially but open at the current step", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      valveOpenAtStep: 5,
      valveTail: 6,
      detour1: 7,
      detour2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aValve(IDS.valveOpenAtStep, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        initialStatus: "closed",
      })
      .aPipe(IDS.valveTail, {
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

    const results = createMockResultsReader({
      valves: {
        [IDS.valveOpenAtStep]: { flow: 100, status: "open" },
      },
      pipes: {
        [IDS.valveTail]: { flow: 100, status: "open" },
        [IDS.detour1]: { flow: 0.001, status: "open" },
        [IDS.detour2]: { flow: 0.001, status: "open" },
      },
    });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path!.linkIds).toEqual([IDS.valveOpenAtStep, IDS.valveTail]);
  });

  it("treats an 'active' valve at the current step the same as an open one", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      activeValve: 5,
      valveTail: 6,
      detour1: 7,
      detour2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aValve(IDS.activeValve, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        initialStatus: "closed",
      })
      .aPipe(IDS.valveTail, {
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

    const results = createMockResultsReader({
      valves: {
        [IDS.activeValve]: { flow: 100, status: "active" },
      },
      pipes: {
        [IDS.valveTail]: { flow: 100, status: "open" },
        [IDS.detour1]: { flow: 0.001, status: "open" },
        [IDS.detour2]: { flow: 0.001, status: "open" },
      },
    });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path!.linkIds).toEqual([IDS.activeValve, IDS.valveTail]);
  });

  it("blocks inactive links regardless of arguments", () => {
    const IDS = { A: 1, B: 2, P: 3 } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aPipe(IDS.P, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        isActive: false,
      })
      .build();

    expect(
      deriveProfilePath(model.topology, model.assets, [IDS.A, IDS.B]),
    ).toBeNull();
    expect(
      findProfilePath(
        model.topology,
        model.assets,
        IDS.A,
        IDS.B,
        createMockResultsReader({
          pipes: { [IDS.P]: { flow: 100, status: "open" } },
        }),
      ),
    ).toBeNull();
  });

  it("applies flow weighting per segment with multiple anchors", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      AB_low: 5,
      AB_high1: 6,
      AB_high2: 7,
      MID: 8,
      BC: 9,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [2, 0] })
      .aJunction(IDS.C, { coordinates: [3, 0] })
      .aJunction(IDS.MID, { coordinates: [1, 1] })
      .aPipe(IDS.AB_low, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.AB_high1, {
        startNodeId: IDS.A,
        endNodeId: IDS.MID,
        length: 100,
      })
      .aPipe(IDS.AB_high2, {
        startNodeId: IDS.MID,
        endNodeId: IDS.B,
        length: 100,
      })
      .aPipe(IDS.BC, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .build();

    const results = createMockResultsReader({
      pipes: {
        [IDS.AB_low]: { flow: 0.01 },
        [IDS.AB_high1]: { flow: 100 },
        [IDS.AB_high2]: { flow: 100 },
        [IDS.BC]: { flow: 50 },
      },
    });

    const path = deriveProfilePath(
      model.topology,
      model.assets,
      [IDS.A, IDS.C],
      results,
    );

    expect(path!.linkIds).toEqual([IDS.AB_high1, IDS.AB_high2, IDS.BC]);
  });
});
