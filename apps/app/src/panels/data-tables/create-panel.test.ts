import {
  createAssetTablePanel,
  createCustomerPointTablePanel,
  defaultDataTablePanels,
} from "./create-panel";

describe("createAssetTablePanel", () => {
  it("opens in the bottom dock and is closable by default", () => {
    const panel = createAssetTablePanel("junction");

    expect(panel.type).toEqual("asset-table");
    expect(panel.assetType).toEqual("junction");
    expect(panel.initialDock).toEqual("bottom");
    expect(panel.availableInVerticalLayout).toBe(true);
    expect(panel.closable).toBe(true);
  });

  it("generates a distinct id per panel", () => {
    const ids = [
      createAssetTablePanel("junction").id,
      createAssetTablePanel("junction").id,
    ];

    expect(new Set(ids).size).toEqual(2);
  });

  it("accepts an explicit id and closability", () => {
    const panel = createAssetTablePanel("pipe", {
      id: "pipe",
      closable: false,
    });

    expect(panel.id).toEqual("pipe");
    expect(panel.closable).toBe(false);
  });
});

describe("createCustomerPointTablePanel", () => {
  it("opens in the bottom dock and is closable by default", () => {
    const panel = createCustomerPointTablePanel();

    expect(panel.type).toEqual("customer-point-table");
    expect(panel.closable).toBe(true);
  });
});

describe("defaultDataTablePanels", () => {
  it("seeds one unclosable table per asset type plus customer points", () => {
    const panels = defaultDataTablePanels();

    expect(panels.map((p) => p.id)).toEqual([
      "junction",
      "pipe",
      "pump",
      "valve",
      "reservoir",
      "tank",
      "customer-point",
    ]);
    expect(panels.every((p) => !p.closable)).toBe(true);
  });

  it("returns a fresh list each call", () => {
    expect(defaultDataTablePanels()).not.toBe(defaultDataTablePanels());
  });
});
