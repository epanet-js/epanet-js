import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { decodeCrossingPipes } from "./data";

describe("decodeCrossingPipes", () => {
  it("sorts crossing pipes by diameter (ascending)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aJunction("J3")
      .aJunction("J4")
      .aJunction("J5")
      .aJunction("J6")
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 100,
        label: "SmallPipe1",
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 100,
        label: "SmallPipe2",
      })
      .aPipe("P3", {
        startNodeId: "J5",
        endNodeId: "J6",
        diameter: 200,
        label: "LargePipe",
      })
      .build();

    const linkIdsLookup = ["P1", "P2", "P3"];
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
    expect(crossings[0].pipe1Id).toBe("P1");
    expect(crossings[0].pipe2Id).toBe("P2");
    // Second crossing has one larger diameter pipe
    expect(crossings[1].pipe1Id).toBe("P2");
    expect(crossings[1].pipe2Id).toBe("P3");
  });

  it("sorts crossing pipes with same diameter by label (alphabetical)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aJunction("J3")
      .aJunction("J4")
      .aJunction("J5")
      .aJunction("J6")
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 100,
        label: "PipeC",
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 100,
        label: "PipeB",
      })
      .aPipe("P3", {
        startNodeId: "J5",
        endNodeId: "J6",
        diameter: 100,
        label: "PipeA",
      })
      .build();

    const linkIdsLookup = ["P1", "P2", "P3"];
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
    expect(crossings[0].pipe1Id).toBe("P3"); // PipeA
    expect(crossings[0].pipe2Id).toBe("P2"); // PipeB
    expect(crossings[1].pipe1Id).toBe("P2"); // PipeB
    expect(crossings[1].pipe2Id).toBe("P1"); // PipeC
  });

  it("sorts pipe pairs within each crossing (smaller diameter pipe first)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aJunction("J3")
      .aJunction("J4")
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 100,
        label: "SmallPipe",
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 200,
        label: "LargePipe",
      })
      .build();

    const linkIdsLookup = ["P1", "P2"];
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
    expect(crossings[0].pipe1Id).toBe("P1"); // diameter 100
    expect(crossings[0].pipe2Id).toBe("P2"); // diameter 200
  });

  it("handles multiple crossings with mixed diameters correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aJunction("J3")
      .aJunction("J4")
      .aJunction("J5")
      .aJunction("J6")
      .aJunction("J7")
      .aJunction("J8")
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 50,
        label: "Tiny",
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 100,
        label: "Small",
      })
      .aPipe("P3", {
        startNodeId: "J5",
        endNodeId: "J6",
        diameter: 150,
        label: "Medium",
      })
      .aPipe("P4", {
        startNodeId: "J7",
        endNodeId: "J8",
        diameter: 200,
        label: "Large",
      })
      .build();

    const linkIdsLookup = ["P1", "P2", "P3", "P4"];
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
    expect(crossings[0].pipe1Id).toBe("P1"); // 50
    expect(crossings[0].pipe2Id).toBe("P2"); // 100
    expect(crossings[1].pipe1Id).toBe("P2"); // 100
    expect(crossings[1].pipe2Id).toBe("P4"); // 200
    expect(crossings[2].pipe1Id).toBe("P3"); // 150
    expect(crossings[2].pipe2Id).toBe("P4"); // 200
  });

  it("preserves intersection point coordinates after decoding", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1")
      .aJunction("J2")
      .aJunction("J3")
      .aJunction("J4")
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2", diameter: 100 })
      .aPipe("P2", { startNodeId: "J3", endNodeId: "J4", diameter: 100 })
      .build();

    const linkIdsLookup = ["P1", "P2"];
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
