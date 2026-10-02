import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";
import type { AssetId, LinkAsset } from "@epanet-js/hydraulic-model";
import { reverseLink } from "./reverse-link";

const { labelManager } = buildTestFactories();

const reverse = (hydraulicModel: HydraulicModel, linkId: AssetId) => {
  const changeSet = reverseLink(hydraulicModel, { linkId });
  applyOperation(hydraulicModel, changeSet, labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ReturnType<typeof reverse>) =>
  changeSet.summary().map(({ entity, kind }) => `${entity}:${kind}`);

const linkOf = (hydraulicModel: HydraulicModel, linkId: AssetId) =>
  hydraulicModel.assets.get(linkId) as LinkAsset;

describe("reverse-link", () => {
  it("reverses pipe connections and coordinates", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
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

    const changeSet = reverse(model, IDS.P1);

    expect(changeSet.name).toBe("reverseLink");
    expect(changedEntities(changeSet)).toEqual(["pipe:update"]);

    const reversedPipe = linkOf(model, IDS.P1);
    expect(reversedPipe.connections).toEqual([IDS.J2, IDS.J1]);
    expect(model.topology.getNodes(IDS.P1)).toEqual([IDS.J2, IDS.J1]);
    expect(reversedPipe.coordinates).toEqual([
      [10, 0],
      [5, 0],
      [0, 0],
    ]);
  });

  it("reverses pump connections and coordinates", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [20, 0] })
      .aPump(IDS.PU1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
          [20, 0],
        ],
      })
      .build();

    const changeSet = reverse(model, IDS.PU1);

    expect(changeSet.name).toBe("reverseLink");
    expect(changedEntities(changeSet)).toEqual(["pump:update"]);

    const reversedPump = linkOf(model, IDS.PU1);
    expect(reversedPump.connections).toEqual([IDS.J2, IDS.J1]);
    expect(model.topology.getNodes(IDS.PU1)).toEqual([IDS.J2, IDS.J1]);
    expect(reversedPump.coordinates).toEqual([
      [20, 0],
      [10, 0],
      [0, 0],
    ]);
  });

  it("reverses valve connections and coordinates", () => {
    const IDS = { J1: 1, J2: 2, V1: 3 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [15, 0] })
      .aValve(IDS.V1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [7.5, 0],
          [15, 0],
        ],
      })
      .build();

    const changeSet = reverse(model, IDS.V1);

    expect(changeSet.name).toBe("reverseLink");
    expect(changedEntities(changeSet)).toEqual(["valve:update"]);

    const reversedValve = linkOf(model, IDS.V1);
    expect(reversedValve.connections).toEqual([IDS.J2, IDS.J1]);
    expect(model.topology.getNodes(IDS.V1)).toEqual([IDS.J2, IDS.J1]);
    expect(reversedValve.coordinates).toEqual([
      [15, 0],
      [7.5, 0],
      [0, 0],
    ]);
  });

  it("handles links with minimal coordinates (2 points)", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .build();

    reverse(model, IDS.P1);

    const reversedPipe = linkOf(model, IDS.P1);
    expect(reversedPipe.connections).toEqual([IDS.J2, IDS.J1]);
    expect(reversedPipe.coordinates).toEqual([
      [10, 0],
      [0, 0],
    ]);
  });

  it("handles complex pipe geometry with many vertices", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 10] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [2, 1],
          [4, 3],
          [6, 6],
          [8, 8],
          [10, 10],
        ],
      })
      .build();

    reverse(model, IDS.P1);

    const reversedPipe = linkOf(model, IDS.P1);
    expect(reversedPipe.connections).toEqual([IDS.J2, IDS.J1]);
    expect(reversedPipe.coordinates).toEqual([
      [10, 10],
      [8, 8],
      [6, 6],
      [4, 3],
      [2, 1],
      [0, 0],
    ]);
  });

  it("throws error for non-existent link", () => {
    const model = HydraulicModelBuilder.with({ labelManager }).build();
    const nonExistentLinkId = 1;

    expect(() => {
      reverseLink(model, { linkId: nonExistentLinkId });
    }).toThrow("Link with id 1 not found");
  });

  it("throws error for node asset instead of link", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    expect(() => {
      reverseLink(model, { linkId: IDS.J1 });
    }).toThrow(`Link with id ${IDS.J1} not found`);
  });

  it("preserves asset immutability", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
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

    const originalPipe = model.assets.get(IDS.P1)!;
    const originalCoordinates = [...originalPipe.coordinates];

    reverseLink(model, { linkId: IDS.P1 });

    expect((originalPipe as any).connections[0]).toBe(IDS.J1);
    expect((originalPipe as any).connections[1]).toBe(IDS.J2);
    expect(originalPipe.coordinates).toEqual(originalCoordinates);
  });
});
