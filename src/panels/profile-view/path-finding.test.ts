import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation/results-reader";
import { shortestPathByDistance, shortestPathByFlow } from "./path-finding";

type FlowMap = Record<number, number | null>;

const stubResults = (flows: FlowMap): ResultsReader => {
  const flowFor = (id: number) => (id in flows ? flows[id] : null);
  const pipeResult = (id: number) => {
    const flow = flowFor(id);
    return flow === null
      ? null
      : ({ flow } as ReturnType<ResultsReader["getPipe"]>);
  };
  const pumpResult = (id: number) => {
    const flow = flowFor(id);
    return flow === null
      ? null
      : ({ flow } as ReturnType<ResultsReader["getPump"]>);
  };
  const valveResult = (id: number) => {
    const flow = flowFor(id);
    return flow === null
      ? null
      : ({ flow } as ReturnType<ResultsReader["getValve"]>);
  };
  return {
    getJunction: () => null,
    getTank: () => null,
    getReservoir: () => null,
    getPipe: pipeResult,
    getPump: pumpResult,
    getValve: valveResult,
    getPumpEnergy: () => null,
    getAllValues: () => [],
  } as unknown as ResultsReader;
};

describe("shortestPathByDistance", () => {
  it("picks the shorter of two parallel branches", () => {
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

    const path = shortestPathByDistance(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
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

    const path = shortestPathByDistance(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
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

    const path = shortestPathByDistance(
      model.topology,
      model.assets,
      IDS.A,
      IDS.A,
    );

    expect(path).toBeNull();
  });
});

describe("shortestPathByFlow", () => {
  it("prefers the high-flow route over the geometrically shorter one", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      shortLowFlow1: 5,
      shortLowFlow2: 6,
      longHighFlow1: 7,
      longHighFlow2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.shortLowFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.shortLowFlow2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.longHighFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.longHighFlow2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const results = stubResults({
      [IDS.shortLowFlow1]: 0.001,
      [IDS.shortLowFlow2]: 0.001,
      [IDS.longHighFlow1]: 50,
      [IDS.longHighFlow2]: 50,
    });

    const distancePath = shortestPathByDistance(
      model.topology,
      model.assets,
      IDS.A,
      IDS.C,
    );
    expect(distancePath!.linkIds).toEqual([
      IDS.shortLowFlow1,
      IDS.shortLowFlow2,
    ]);

    const flowPath = shortestPathByFlow(
      model.topology,
      model.assets,
      results,
      IDS.A,
      IDS.C,
    );
    expect(flowPath!.linkIds).toEqual([IDS.longHighFlow1, IDS.longHighFlow2]);
  });

  it("uses the absolute value of flow so reverse direction still ranks high", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      forward: 4,
      reverse: 5,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.forward, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 1,
      })
      .aPipe(IDS.reverse, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 1,
      })
      .build();

    const results = stubResults({
      [IDS.forward]: 25,
      [IDS.reverse]: -25,
    });

    const path = shortestPathByFlow(
      model.topology,
      model.assets,
      results,
      IDS.A,
      IDS.C,
    );

    expect(path!.linkIds).toEqual([IDS.forward, IDS.reverse]);
  });

  it("still finds a path when every link has zero or missing flow", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      P1: 4,
      P2: 5,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .build();

    const results = stubResults({
      [IDS.P1]: 0,
    });

    const path = shortestPathByFlow(
      model.topology,
      model.assets,
      results,
      IDS.A,
      IDS.C,
    );

    expect(path).not.toBeNull();
    expect(path!.linkIds).toEqual([IDS.P1, IDS.P2]);
  });

  it("prefers a branch with measurable flow over a branch with no flow data", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      noFlow1: 5,
      noFlow2: 6,
      withFlow1: 7,
      withFlow2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.noFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.noFlow2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.withFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 10,
      })
      .aPipe(IDS.withFlow2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 10,
      })
      .build();

    const results = stubResults({
      [IDS.withFlow1]: 5,
      [IDS.withFlow2]: 5,
    });

    const path = shortestPathByFlow(
      model.topology,
      model.assets,
      results,
      IDS.A,
      IDS.C,
    );

    expect(path!.linkIds).toEqual([IDS.withFlow1, IDS.withFlow2]);
  });

  it("dispatches flow lookup by link type for pumps and valves", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      pumpRoute: 5,
      pipeAfterPump: 6,
      valveRoute: 7,
      pipeAfterValve: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPump(IDS.pumpRoute, { startNodeId: IDS.A, endNodeId: IDS.B })
      .aPipe(IDS.pipeAfterPump, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 1,
      })
      .aValve(IDS.valveRoute, { startNodeId: IDS.A, endNodeId: IDS.D })
      .aPipe(IDS.pipeAfterValve, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 1,
      })
      .build();

    const valveDominantResults = stubResults({
      [IDS.pumpRoute]: 0.001,
      [IDS.pipeAfterPump]: 0.001,
      [IDS.valveRoute]: 100,
      [IDS.pipeAfterValve]: 100,
    });

    const valveDominantPath = shortestPathByFlow(
      model.topology,
      model.assets,
      valveDominantResults,
      IDS.A,
      IDS.C,
    );
    expect(valveDominantPath!.linkIds).toEqual([
      IDS.valveRoute,
      IDS.pipeAfterValve,
    ]);

    const pumpDominantResults = stubResults({
      [IDS.pumpRoute]: 100,
      [IDS.pipeAfterPump]: 100,
      [IDS.valveRoute]: 0.001,
      [IDS.pipeAfterValve]: 0.001,
    });

    const pumpDominantPath = shortestPathByFlow(
      model.topology,
      model.assets,
      pumpDominantResults,
      IDS.A,
      IDS.C,
    );
    expect(pumpDominantPath!.linkIds).toEqual([
      IDS.pumpRoute,
      IDS.pipeAfterPump,
    ]);
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

    const results = stubResults({ [IDS.P1]: 10 });
    const path = shortestPathByFlow(
      model.topology,
      model.assets,
      results,
      IDS.A,
      IDS.C,
    );

    expect(path).toBeNull();
  });
});
