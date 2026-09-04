import { createAssetTablePanel } from "./data-tables/create-panel";
import { createHglProfilePanel } from "./hgl-profile/create-panel";
import { createCustomerPointTablePanel } from "./data-tables/create-panel";
import type { Panel } from "./panel";
import {
  type PanelContentState,
  contentStateFor,
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
  };
  return labels[key] ?? key;
}) as never;

const labelOf = (panel: Panel) => panelFor(panel).buildLabel(panel, translate);

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
});

describe("panelLabel", () => {
  it("falls back to the type's own label", () => {
    const panel = createAssetTablePanel("junction");

    expect(panelLabel(panel, undefined, translate)).toEqual("Junctions");
  });

  it("prefers a rename by the user", () => {
    const panel = createAssetTablePanel("junction");

    expect(panelLabel(panel, "My table", translate)).toEqual("My table");
  });
});

describe("withContentState", () => {
  it("stores content state under the panel's id", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });

    const states = withContentState({}, panel, { scrollTop: 120 });

    expect(states).toEqual({ junction: { scrollTop: 120 } });
  });

  it("replaces only that panel's content state", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });
    const before: Record<string, PanelContentState> = {
      junction: { scrollTop: 1 },
      pipe: { scrollTop: 40 },
    };

    const states = withContentState(before, panel, { scrollTop: 8 });

    expect(states).toEqual({
      junction: { scrollTop: 8 },
      pipe: { scrollTop: 40 },
    });
  });

  it("rejects state that belongs to a different panel type", () => {
    const hgl = createHglProfilePanel();

    // @ts-expect-error the HGL panel has no grid state
    withContentState({}, hgl, { scrollTop: 120 });
  });
});

describe("contentStateFor", () => {
  it("round-trips through withContentState", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });

    const states = withContentState({}, panel, {
      sorting: [{ id: "label", desc: true }],
    });

    expect(contentStateFor(states, panel)).toEqual({
      sorting: [{ id: "label", desc: true }],
    });
  });

  it("is undefined for a panel with nothing stored", () => {
    const panel = createAssetTablePanel("junction", { id: "junction" });

    expect(contentStateFor({}, panel)).toBeUndefined();
  });
});
