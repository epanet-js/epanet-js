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
  buildMapThemes,
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
  basemap: { style: "satellite", visible: false, labels: false, opacity: 0.4 },
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
    expect(read.basemap).toEqual(symbology.basemap);
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
  it("produces records that read back through buildMapThemes", () => {
    const themes = [
      { id: "theme-1", name: "Pressure", spec: toMapThemeSpec(aSymbology()) },
    ];

    expect(buildMapThemes(serializeMapThemes(themes))).toEqual(themes);
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

describe("buildMapThemes", () => {
  it("skips a record that can't be read and keeps the rest", () => {
    const valid = {
      id: "theme-1",
      name: "Pressure",
      spec: toMapThemeSpec(aSymbology()),
    };
    const json = JSON.stringify([
      { id: "broken", name: "Broken", spec_version: 1, spec: {} },
      { ...valid, spec_version: 1 },
    ]);

    expect(buildMapThemes(json)).toEqual([valid]);
  });

  it("reads nothing from data that isn't JSON", () => {
    expect(buildMapThemes("not-json")).toEqual([]);
  });
});
