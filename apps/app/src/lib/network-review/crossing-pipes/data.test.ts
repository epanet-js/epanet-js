import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeCrossingPipes } from "./data";

describe("decodeCrossingPipes", () => {
  it("sorts crossing pipes by diameter (ascending)", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      J5: 5,
      J6: 6,
      P1: 7,
      P2: 8,
      P3: 9,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aJunction(IDS.J6)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
        label: "SmallPipe1",
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 100,
        label: "SmallPipe2",
      })
      .aPipe(IDS.P3, {
        startNodeId: IDS.J5,
        endNodeId: IDS.J6,
        diameter: 200,
        label: "LargePipe",
      })
      .build();

    const linkIdsLookup = [IDS.P1, IDS.P2, IDS.P3];
    const encodedCrossingPipes = [
      { pipe1Id: 2, pipe2Id: 1, intersectionPoint: [0, 0] },
      { pipe1Id: 0, pipe2Id: 1, intersectionPoint: [1, 1] },
    ];

    const crossings = decodeCrossingPipes(
      model,
      linkIdsLookup,
      encodedCrossingPipes,
    );

    expect(crossings).toHaveLength(2);
    // First crossing should have smaller diameter pipes
    expect(crossings[0].pipe1Id).toBe(IDS.P1);
    expect(crossings[0].pipe2Id).toBe(IDS.P2);
    // Second crossing has one larger diameter pipe
    expect(crossings[1].pipe1Id).toBe(IDS.P2);
    expect(crossings[1].pipe2Id).toBe(IDS.P3);
  });

  it("sorts crossing pipes with same diameter by label (alphabetical)", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      J5: 5,
      J6: 6,
      P1: 7,
      P2: 8,
      P3: 9,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aJunction(IDS.J6)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
        label: "PipeC",
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 100,
        label: "PipeB",
      })
      .aPipe(IDS.P3, {
        startNodeId: IDS.J5,
        endNodeId: IDS.J6,
        diameter: 100,
        label: "PipeA",
      })
      .build();

    const linkIdsLookup = [IDS.P1, IDS.P2, IDS.P3];
    const encodedCrossingPipes = [
      { pipe1Id: 0, pipe2Id: 1, intersectionPoint: [0, 0] },
      { pipe1Id: 2, pipe2Id: 1, intersectionPoint: [1, 1] },
    ];

    const crossings = decodeCrossingPipes(
      model,
      linkIdsLookup,
      encodedCrossingPipes,
    );

    expect(crossings).toHaveLength(2);
    expect(crossings[0].pipe1Id).toBe(IDS.P3); // PipeA
    expect(crossings[0].pipe2Id).toBe(IDS.P2); // PipeB
    expect(crossings[1].pipe1Id).toBe(IDS.P2); // PipeB
    expect(crossings[1].pipe2Id).toBe(IDS.P1); // PipeC
  });

  it("sorts pipe pairs within each crossing (smaller diameter pipe first)", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
        label: "SmallPipe",
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 200,
        label: "LargePipe",
      })
      .build();

    const linkIdsLookup = [IDS.P1, IDS.P2];
    // Encode with larger diameter first
    const encodedCrossingPipes = [
      { pipe1Id: 1, pipe2Id: 0, intersectionPoint: [0, 0] },
    ];

    const crossings = decodeCrossingPipes(
      model,
      linkIdsLookup,
      encodedCrossingPipes,
    );

    expect(crossings).toHaveLength(1);
    // Should be reordered to smaller diameter first
    expect(crossings[0].pipe1Id).toBe(IDS.P1); // diameter 100
    expect(crossings[0].pipe2Id).toBe(IDS.P2); // diameter 200
  });

  it("handles multiple crossings with mixed diameters correctly", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      J3: 3,
      J4: 4,
      J5: 5,
      J6: 6,
      J7: 7,
      J8: 8,
      P1: 9,
      P2: 10,
      P3: 11,
      P4: 12,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.J5)
      .aJunction(IDS.J6)
      .aJunction(IDS.J7)
      .aJunction(IDS.J8)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 50,
        label: "Tiny",
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 100,
        label: "Small",
      })
      .aPipe(IDS.P3, {
        startNodeId: IDS.J5,
        endNodeId: IDS.J6,
        diameter: 150,
        label: "Medium",
      })
      .aPipe(IDS.P4, {
        startNodeId: IDS.J7,
        endNodeId: IDS.J8,
        diameter: 200,
        label: "Large",
      })
      .build();

    const linkIdsLookup = [IDS.P1, IDS.P2, IDS.P3, IDS.P4];
    const encodedCrossingPipes = [
      { pipe1Id: 3, pipe2Id: 2, intersectionPoint: [3, 3] }, // Large x Medium
      { pipe1Id: 0, pipe2Id: 1, intersectionPoint: [0, 0] }, // Tiny x Small
      { pipe1Id: 1, pipe2Id: 3, intersectionPoint: [2, 2] }, // Small x Large
    ];

    const crossings = decodeCrossingPipes(
      model,
      linkIdsLookup,
      encodedCrossingPipes,
    );

    expect(crossings).toHaveLength(3);
    // Should be sorted by pipe1 diameter, then pipe2 diameter
    expect(crossings[0].pipe1Id).toBe(IDS.P1); // 50
    expect(crossings[0].pipe2Id).toBe(IDS.P2); // 100
    expect(crossings[1].pipe1Id).toBe(IDS.P2); // 100
    expect(crossings[1].pipe2Id).toBe(IDS.P4); // 200
    expect(crossings[2].pipe1Id).toBe(IDS.P3); // 150
    expect(crossings[2].pipe2Id).toBe(IDS.P4); // 200
  });

  it("preserves intersection point coordinates after decoding", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        diameter: 100,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        diameter: 100,
      })
      .build();

    const linkIdsLookup = [IDS.P1, IDS.P2];
    const encodedCrossingPipes = [
      { pipe1Id: 0, pipe2Id: 1, intersectionPoint: [123.456, 789.012] },
    ];

    const crossings = decodeCrossingPipes(
      model,
      linkIdsLookup,
      encodedCrossingPipes,
    );

    expect(crossings).toHaveLength(1);
    expect(crossings[0].intersectionPoint).toEqual([123.456, 789.012]);
  });
});
