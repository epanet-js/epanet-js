import { describe, expect, it } from "vitest";
import { updateVertices } from "./update-vertices";
import { LinkAsset } from "../asset-types";
import { HydraulicModelBuilder } from "../../__helpers__/hydraulic-model-builder";
import { Position } from "geojson";

describe("updateVertices", () => {
  it("updates link vertices while preserving start and end node coordinates", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
        coordinates: [
          [0, 0],
          [25, 10],
          [75, -10],
          [100, 0],
        ],
      })
      .build();

    const newVertices: Position[] = [
      [30, 20],
      [70, -20],
    ];

    const { putAssets } = updateVertices(hydraulicModel, {
      linkId: "AB",
      newVertices,
    });

    expect(putAssets).toHaveLength(1);

    const updatedLink = putAssets![0] as LinkAsset;
    expect(updatedLink.id).toEqual("AB");
    expect(updatedLink.coordinates).toEqual([
      [0, 0],
      [30, 20],
      [70, -20],
      [100, 0],
    ]);
  });

  it("handles link with no intermediate vertices (straight link)", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
      })
      .build();

    const newVertices: Position[] = [[50, 25]];

    const { putAssets } = updateVertices(hydraulicModel, {
      linkId: "AB",
      newVertices,
    });

    const updatedLink = putAssets![0] as LinkAsset;
    expect(updatedLink.coordinates).toEqual([
      [0, 0],
      [50, 25],
      [100, 0],
    ]);
  });

  it("handles empty vertices array (creates straight link)", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
        coordinates: [
          [0, 0],
          [25, 10],
          [75, -10],
          [100, 0],
        ],
      })
      .build();

    const newVertices: Position[] = [];

    const { putAssets } = updateVertices(hydraulicModel, {
      linkId: "AB",
      newVertices,
    });

    const updatedLink = putAssets![0] as LinkAsset;
    expect(updatedLink.coordinates).toEqual([
      [0, 0],
      [100, 0],
    ]);
  });

  it("updates customer points connected to the pipe", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
        coordinates: [
          [0, 0],
          [50, 0],
          [100, 0],
        ],
      })
      .aCustomerPoint("CP1", {
        coordinates: [25, 5],
        connection: {
          pipeId: "AB",
          snapPoint: [25, 0],
          junctionId: "A",
        },
      })
      .aCustomerPoint("CP2", {
        coordinates: [75, -5],
        connection: {
          pipeId: "AB",
          snapPoint: [75, 0],
          junctionId: "B",
        },
      })
      .build();

    const newVertices: Position[] = [[50, 20]];

    const { putAssets, putCustomerPoints } = updateVertices(hydraulicModel, {
      linkId: "AB",
      newVertices,
    });

    expect(putAssets).toHaveLength(1);
    expect(putCustomerPoints).toHaveLength(2);

    const updatedLink = putAssets![0] as LinkAsset;
    expect(updatedLink.coordinates).toEqual([
      [0, 0],
      [50, 20],
      [100, 0],
    ]);

    const cp1 = putCustomerPoints!.find((cp) => cp.id === "CP1");
    const cp2 = putCustomerPoints!.find((cp) => cp.id === "CP2");

    expect(cp1).toBeDefined();
    expect(cp2).toBeDefined();

    expect(cp1!.connection!.pipeId).toBe("AB");
    expect(cp2!.connection!.pipeId).toBe("AB");

    expect(cp1!.connection!.snapPoint).not.toEqual([25, 0]);
    expect(cp2!.connection!.snapPoint).not.toEqual([75, 0]);
  });

  it("handles link with no connected customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
        coordinates: [
          [0, 0],
          [50, 10],
          [100, 0],
        ],
      })
      .build();

    const newVertices: Position[] = [[60, 20]];

    const { putAssets, putCustomerPoints } = updateVertices(hydraulicModel, {
      linkId: "AB",
      newVertices,
    });

    expect(putAssets).toHaveLength(1);
    expect(putCustomerPoints).toBeUndefined();

    const updatedLink = putAssets![0] as LinkAsset;
    expect(updatedLink.coordinates).toEqual([
      [0, 0],
      [60, 20],
      [100, 0],
    ]);
  });

  it("throws error for non-existent link", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .build();

    expect(() => {
      updateVertices(hydraulicModel, {
        linkId: "NONEXISTENT",
        newVertices: [[50, 10]] as Position[],
      });
    }).toThrowError("Link NONEXISTENT not found or is not a link");
  });

  it("throws error when trying to update a node instead of link", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
      })
      .build();

    expect(() => {
      updateVertices(hydraulicModel, {
        linkId: "A",
        newVertices: [[50, 10]] as Position[],
      });
    }).toThrowError("Link A not found or is not a link");
  });

  it("preserves other link properties", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [0, 0])
      .aNode("B", [100, 0])
      .aPipe("AB", {
        startNodeId: "A",
        endNodeId: "B",
        length: 1,
        diameter: 200,
        roughness: 100,
        coordinates: [
          [0, 0],
          [50, 0],
          [100, 0],
        ],
      })
      .build();

    const newVertices: Position[] = [
      [40, 15],
      [60, -15],
    ];
    const originalLink = hydraulicModel.assets.get("AB") as LinkAsset;

    const { putAssets } = updateVertices(hydraulicModel, {
      linkId: "AB",
      newVertices,
    });

    const updatedLink = putAssets![0] as LinkAsset;

    expect((updatedLink as any).diameter).toBe((originalLink as any).diameter);
    expect((updatedLink as any).roughness).toBe(
      (originalLink as any).roughness,
    );

    expect(updatedLink.coordinates).toEqual([
      [0, 0],
      [40, 15],
      [60, -15],
      [100, 0],
    ]);
  });
});
