import { mapThemeSpecSchema } from "@epanet-js/ejsdb";
import { aLinkSymbology, aNodeSymbology } from "src/__helpers__/state";
import type { RangeColorRule } from "src/map/symbology/range-color-rule";
import {
  defaultMapThemeSymbology,
  type MapThemeSymbology,
} from "src/state/map-themes";
import { serializeMapThemes, toMapThemeSpec } from "./to-rows";
import {
  buildMapThemeSymbology,
  buildMapThemesData,
  type ThemeColorRule,
} from "./builders";

const keepRule = (rule: ThemeColorRule) => rule as unknown as RangeColorRule;

const aSymbology = (): MapThemeSymbology => ({
  ...defaultMapThemeSymbology,
  node: aNodeSymbology({
    colorRule: {
      property: "pressure",
      mode: "manual",
      rampName: "Temps",
      reversedRamp: true,
      breaks: [10, 20],
      colors: ["#000001", "#000002", "#000003"],
    },
  }),
  link: aLinkSymbology({ labelRule: "label" }),
});

describe("map theme spec", () => {
  it("is a valid spec that reads back to the same settings", () => {
    const symbology = aSymbology();

    const spec = mapThemeSpecSchema.parse(toMapThemeSpec(symbology));
    const read = buildMapThemeSymbology(spec, keepRule);

    expect(read.node.colorRule).toEqual({
      property: "pressure",
      mode: "manual",
      rampName: "Temps",
      reversedRamp: true,
      breaks: [10, 20],
      colors: ["#000001", "#000002", "#000003"],
    });
    expect(read.link.labelRule).toEqual("label");
    expect(read.zone).toEqual(symbology.zone);
  });

  it("reads unknown color properties as no color rule", () => {
    const spec = toMapThemeSpec(aSymbology());

    const read = buildMapThemeSymbology(
      { ...spec, nodeColorBy: "futureProperty", linkColorBy: "pressure" },
      keepRule,
    );

    expect(read.node.colorRule).toBeNull();
    expect(read.link.colorRule).toBeNull();
  });

  it("reads unknown node and link labels as none", () => {
    const spec = toMapThemeSpec(aSymbology());

    const read = buildMapThemeSymbology(
      { ...spec, nodeLabel: "futureProperty", linkLabel: "pressure" },
      keepRule,
    );

    expect(read.node.labelRule).toBeNull();
    expect(read.link.labelRule).toBeNull();
  });

  it("keeps labels by name or by a known property", () => {
    const spec = toMapThemeSpec(aSymbology());

    const read = buildMapThemeSymbology(
      { ...spec, nodeLabel: "pressure", linkLabel: "label" },
      keepRule,
    );

    expect(read.node.labelRule).toEqual("pressure");
    expect(read.link.labelRule).toEqual("label");
  });

  it("reads unknown zone rules as none", () => {
    const spec = toMapThemeSpec(aSymbology());

    const read = buildMapThemeSymbology(
      { ...spec, zonesLabel: "futureLabel", zonesColorBy: "futureRule" },
      keepRule,
    );

    expect(read.zone.labelRule).toBeNull();
    expect(read.zone.colorRule).toBeNull();
  });
});

describe("serializeMapThemes", () => {
  it("produces rows that read back through buildMapThemesData", () => {
    const themes = [
      { id: "theme-1", name: "Pressure", spec: toMapThemeSpec(aSymbology()) },
    ];

    expect(buildMapThemesData(serializeMapThemes(themes))).toEqual(themes);
  });

  it("refuses a theme without a name", () => {
    expect(() =>
      serializeMapThemes([
        { id: "theme-1", name: "", spec: toMapThemeSpec(aSymbology()) },
      ]),
    ).toThrow();
  });

  it("refuses a theme whose colors and breaks don't match", () => {
    const spec = toMapThemeSpec(aSymbology());

    expect(() =>
      serializeMapThemes([
        { id: "theme-1", name: "Broken", spec: { ...spec, nodeBreaks: [1] } },
      ]),
    ).toThrow();
  });
});

describe("buildMapThemesData", () => {
  it("refuses a theme it cannot understand", () => {
    expect(() =>
      buildMapThemesData([{ id: "theme-1", name: "Broken", spec: "nope" }]),
    ).toThrow(/Map theme: spec is not valid JSON/);
    expect(() =>
      buildMapThemesData([{ id: "theme-1", name: "Broken", spec: "{}" }]),
    ).toThrow(/Map theme: spec does not match schema/);
    expect(() =>
      buildMapThemesData([{ id: "theme-1", name: "", spec: "{}" }]),
    ).toThrow(/Map theme: row data does not match schema/);
  });
});
