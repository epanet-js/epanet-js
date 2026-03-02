import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { changeProperty, changeProperties } from "./change-property";

describe("change property", () => {
  it("changes a property of an asset", () => {
    const IDS = { junctionID: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.junctionID, { elevation: 15 })
      .build();
    const { patchAssetsAttributes } = changeProperty(hydraulicModel, {
      assetIds: [IDS.junctionID],
      property: "elevation",
      value: 20,
    });

    expect(patchAssetsAttributes).toHaveLength(1);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.junctionID,
      type: "junction",
      properties: { elevation: 20 },
    });
  });

  it("can change properties of many assets", () => {
    const IDS = { A: 1, B: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { elevation: 15 })
      .aReservoir(IDS.B, { elevation: 35 })
      .build();
    const { patchAssetsAttributes } = changeProperty(hydraulicModel, {
      assetIds: [IDS.A, IDS.B],
      property: "elevation",
      value: 20,
    });

    expect(patchAssetsAttributes).toHaveLength(2);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.A,
      type: "junction",
      properties: { elevation: 20 },
    });
    expect(patchAssetsAttributes![1]).toEqual({
      id: IDS.B,
      type: "reservoir",
      properties: { elevation: 20 },
    });
  });

  it("ignores assets that do not have the property provided", () => {
    const IDS = { A: 1, B: 2, PIPE: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A)
      .aJunction(IDS.B)
      .aPipe(IDS.PIPE, { diameter: 10 })
      .build();
    const { patchAssetsAttributes } = changeProperty(hydraulicModel, {
      assetIds: [IDS.A, IDS.B, IDS.PIPE],
      property: "diameter",
      value: 20,
    });

    expect(patchAssetsAttributes).toHaveLength(1);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.PIPE,
      type: "pipe",
      properties: { diameter: 20 },
    });
  });

  it("silently ignores isActive property changes", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();

    const result = changeProperty(hydraulicModel, {
      assetIds: [IDS.J1],
      property: "isActive",
      value: false,
    });

    expect(result.patchAssetsAttributes).toHaveLength(0);
  });
});

describe("change properties", () => {
  it("changes multiple properties of a single asset", () => {
    const IDS = { junctionID: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.junctionID, { elevation: 15 })
      .build();
    const { patchAssetsAttributes } = changeProperties(hydraulicModel, {
      assetIds: [IDS.junctionID],
      changes: [
        { property: "elevation", value: 20 },
        { property: "label", value: "J1" },
      ],
    });

    expect(patchAssetsAttributes).toHaveLength(1);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.junctionID,
      type: "junction",
      properties: { elevation: 20, label: "J1" },
    });
  });

  it("changes multiple properties across multiple assets", () => {
    const IDS = { A: 1, B: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { elevation: 15 })
      .aReservoir(IDS.B, { elevation: 35 })
      .build();
    const { patchAssetsAttributes } = changeProperties(hydraulicModel, {
      assetIds: [IDS.A, IDS.B],
      changes: [{ property: "elevation", value: 20 }],
    });

    expect(patchAssetsAttributes).toHaveLength(2);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.A,
      type: "junction",
      properties: { elevation: 20 },
    });
    expect(patchAssetsAttributes![1]).toEqual({
      id: IDS.B,
      type: "reservoir",
      properties: { elevation: 20 },
    });
  });

  it("ignores properties an asset does not have", () => {
    const IDS = { A: 1, PIPE: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.A)
      .aPipe(IDS.PIPE, { diameter: 10 })
      .build();
    const { patchAssetsAttributes } = changeProperties(hydraulicModel, {
      assetIds: [IDS.A, IDS.PIPE],
      changes: [{ property: "diameter", value: 20 }],
    });

    expect(patchAssetsAttributes).toHaveLength(1);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.PIPE,
      type: "pipe",
      properties: { diameter: 20 },
    });
  });

  it("silently ignores isActive property changes", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const { patchAssetsAttributes } = changeProperties(hydraulicModel, {
      assetIds: [IDS.J1],
      changes: [
        { property: "isActive", value: false },
        { property: "elevation", value: 20 },
      ],
    });

    expect(patchAssetsAttributes).toHaveLength(1);
    expect(patchAssetsAttributes![0]).toEqual({
      id: IDS.J1,
      type: "junction",
      properties: { elevation: 20 },
    });
  });

  it("throws on invalid asset id", () => {
    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();

    expect(() =>
      changeProperties(hydraulicModel, {
        assetIds: [999],
        changes: [{ property: "elevation", value: 20 }],
      }),
    ).toThrow("Invalid asset id 999");
  });
});
