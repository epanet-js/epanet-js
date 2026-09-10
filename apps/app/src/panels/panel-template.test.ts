import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { createAssetTablePanel } from "./data-tables/create-panel";
import { createHglProfilePanel } from "./hgl-profile/create-panel";
import { createNetworkReviewPanel } from "./network-review/create-panel";
import { createCustomerPointTablePanel } from "./data-tables/create-panel";
import type { Panel } from "./panel";
import {
  type PanelContentState,
  contentStateFor,
  panelDescription,
  panelFor,
  panelLabel,
  withContentState,
} from "./panel-template";

const translate = ((key: string) => {
  const labels: Record<string, string> = {
    junctions: "Junctions",
    pipes: "Pipes",
    customerPoints: "Customer points",
    "hglProfile.title": "HGL profile",
    "networkReview.title": "Network Review",
  };
  return labels[key] ?? key;
}) as never;

const hydraulicModel = HydraulicModelBuilder.with()
  .aJunction(1)
  .aJunction(2)
  .aPipe(10, { startNodeId: 1, endNodeId: 2 })
  .aCustomerPoint(7, {})
  .build();

const context = { translate, hydraulicModel };

const labelOf = (panel: Panel) => panelFor(panel).buildLabel(panel, context);
const descriptionOf = (panel: Panel) => panelDescription(panel, context);

describe("panel definitions", () => {
  it("labels asset tables by their asset type", () => {
    expect(labelOf(createAssetTablePanel("junction"))).toEqual("Junctions");
    expect(labelOf(createAssetTablePanel("pipe"))).toEqual("Pipes");
  });

  it("labels customer point tables", () => {
    expect(labelOf(createCustomerPointTablePanel())).toEqual("Customer points");
  });

  it("labels the HGL panel", () => {
    expect(labelOf(createHglProfilePanel())).toEqual("HGL profile");
  });

  it("labels the network review panel", () => {
    expect(labelOf(createNetworkReviewPanel())).toEqual("Network Review");
  });

  it("keeps the label free of the scope a table is holding", () => {
    const panel = createAssetTablePanel("junction", { assetIds: [1, 2, 10] });

    expect(labelOf(panel)).toEqual("Junctions");
  });
});

describe("panelDescription", () => {
  it("counts only the rows a scoped table will show", () => {
    const panel = createAssetTablePanel("junction", { assetIds: [1, 2, 10] });

    expect(descriptionOf(panel)).toEqual("(2)");
  });

  it("counts zero when the scope holds none of its type", () => {
    const panel = createAssetTablePanel("pipe", { assetIds: [1, 2] });

    expect(descriptionOf(panel)).toEqual("(0)");
  });

  it("stops counting an asset once it leaves the model", () => {
    const panel = createAssetTablePanel("junction", { assetIds: [1, 2, 999] });

    expect(descriptionOf(panel)).toEqual("(2)");
  });

  it("counts the customer points a scoped table will show", () => {
    const panel = createCustomerPointTablePanel({ customerPointIds: [7, 999] });

    expect(descriptionOf(panel)).toEqual("(1)");
  });

  it("describes nothing when a table holds the whole model", () => {
    expect(descriptionOf(createAssetTablePanel("junction"))).toBeUndefined();
    expect(descriptionOf(createCustomerPointTablePanel())).toBeUndefined();
  });

  it("describes nothing for a panel type without a description", () => {
    expect(descriptionOf(createHglProfilePanel())).toBeUndefined();
  });
});

describe("panelLabel", () => {
  it("falls back to the type's own label", () => {
    const panel = createAssetTablePanel("junction");

    expect(panelLabel(panel, undefined, context)).toEqual("Junctions");
  });

  it("prefers a rename by the user", () => {
    const panel = createAssetTablePanel("junction");

    expect(panelLabel(panel, "My table", context)).toEqual("My table");
  });
});

describe("withContentState", () => {
  it("stores content state under the panel's id", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });

    const states = withContentState({}, panel.id, panel.type, {
      scrollTop: 120,
    });

    expect(states).toEqual({ junction: { scrollTop: 120 } });
  });

  it("replaces only that panel's content state", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });
    const before: Record<string, PanelContentState> = {
      junction: { scrollTop: 1 },
      pipe: { scrollTop: 40 },
    };

    const states = withContentState(before, panel.id, panel.type, {
      scrollTop: 8,
    });

    expect(states).toEqual({
      junction: { scrollTop: 8 },
      pipe: { scrollTop: 40 },
    });
  });

  it("rejects state that belongs to a different panel type", () => {
    const hgl = createHglProfilePanel();

    // @ts-expect-error the HGL panel has no grid state
    withContentState({}, hgl.id, hgl.type, { scrollTop: 120 });
  });
});

describe("contentStateFor", () => {
  it("round-trips through withContentState", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });

    const states = withContentState({}, panel.id, panel.type, {
      sorting: [{ id: "label", desc: true }],
    });

    expect(contentStateFor(states, panel.id, panel.type)).toEqual({
      sorting: [{ id: "label", desc: true }],
    });
  });

  it("is undefined for a panel with nothing stored", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });

    expect(contentStateFor({}, panel.id, panel.type)).toBeUndefined();
  });
});
