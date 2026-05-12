import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  PipeSimulation,
  PumpSimulation,
  ResultsReader,
  ValveSimulation,
} from "src/simulation/results-reader";
import { findProfilePath } from "./path-finding";

type StatusMap = {
  pipe?: Record<number, PipeSimulation["status"] | null>;
  pump?: Record<number, PumpSimulation["status"] | null>;
  valve?: Record<number, ValveSimulation["status"] | null>;
};

const stubResults = (statuses: StatusMap = {}): ResultsReader => {
  const lookup = <T extends { status: string }>(
    map: Record<number, T["status"] | null> | undefined,
    id: number,
  ) => {
    if (!map || !(id in map)) return null;
    const status = map[id];
    if (status === null) return null;
    return { status } as unknown as T;
  };

  return {
    getJunction: () => null,
    getTank: () => null,
    getReservoir: () => null,
    getPipe: (id: number) => lookup<PipeSimulation>(statuses.pipe, id),
    getPump: (id: number) => lookup<PumpSimulation>(statuses.pump, id),
    getValve: (id: number) => lookup<ValveSimulation>(statuses.valve, id),
    getPumpEnergy: () => null,
    getAllValues: () => [],
  } as unknown as ResultsReader;
};

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.A,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

    expect(path!.linkIds).toEqual([IDS.detour1, IDS.detour2]);
  });

  it("treats a pipe as blocked when sim status is closed even if initialStatus is open", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      shortPipe: 5,
      shortTail: 6,
      detour1: 7,
      detour2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.shortPipe, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        initialStatus: "open",
      })
      .aPipe(IDS.shortTail, {
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

    const results = stubResults({ pipe: { [IDS.shortPipe]: "closed" } });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path!.linkIds).toEqual([IDS.detour1, IDS.detour2]);
  });

  it("treats a pipe as traversable when sim status is open even if initialStatus is closed", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      shortPipe: 4,
      shortTail: 5,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.shortPipe, {
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
      .build();

    const results = stubResults({ pipe: { [IDS.shortPipe]: "open" } });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.shortPipe, IDS.shortTail]);
  });

  it("falls back to initialStatus when results are missing for that link", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      pipeWithoutResult: 4,
      pipeWithResult: 5,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.pipeWithoutResult, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
        initialStatus: "open",
      })
      .aPipe(IDS.pipeWithResult, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
        initialStatus: "open",
      })
      .build();

    const results = stubResults({
      pipe: { [IDS.pipeWithResult]: "open" },
    });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.pipeWithoutResult, IDS.pipeWithResult]);
  });

  it("returns null when every route is blocked", () => {
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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

    expect(path!.linkIds).toEqual([IDS.detour1, IDS.detour2]);
  });

  it("returns null for disconnected nodes even when results are provided", () => {
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

    const results = stubResults({ pipe: { [IDS.P1]: "open" } });

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      results,
    );

    expect(path).toBeNull();
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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

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

    const path = findProfilePath(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
      null,
    );

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.cvPipe, IDS.tail]);
  });
});
