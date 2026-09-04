import type { Feature } from "geojson";
import { summarizeFeatures } from "./summarize";

const aPoint = (properties: Record<string, unknown>): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties,
});

describe("summarizeFeatures", () => {
  it("offers an attribute any record states", () => {
    const summary = summarizeFeatures([
      aPoint({ NAME: "north" }),
      aPoint({ CODE: "a" }),
    ]);

    expect(summary.attributes.map((a) => a.name)).toEqual(["CODE", "NAME"]);
  });

  it("sorts attributes by name", () => {
    const summary = summarizeFeatures([aPoint({ b: 1, a: 2, C: 3 })]);

    expect(summary.attributes.map((a) => a.name)).toEqual(["a", "b", "C"]);
  });

  it("marks an attribute every record states", () => {
    const summary = summarizeFeatures([
      aPoint({ NAME: "north", CODE: "a" }),
      aPoint({ NAME: "south" }),
    ]);

    const byName = new Map(summary.attributes.map((a) => [a.name, a]));
    expect(byName.get("NAME")!.onEveryRecord).toBe(true);
    expect(byName.get("CODE")!.onEveryRecord).toBe(false);
  });

  it("ignores a blank value when deciding what a record states", () => {
    const summary = summarizeFeatures([
      aPoint({ NAME: "north" }),
      aPoint({ NAME: "  " }),
    ]);

    expect(summary.attributes[0].onEveryRecord).toBe(false);
  });

  it("leaves out an attribute no record states", () => {
    const summary = summarizeFeatures([aPoint({ NAME: null })]);

    expect(summary.attributes).toEqual([]);
  });

  it("is a number only when every stated value reads as one", () => {
    const summary = summarizeFeatures([
      aPoint({ DEMAND: 10, SIZE: 4 }),
      aPoint({ DEMAND: "12.5", SIZE: "INS" }),
    ]);

    const byName = new Map(summary.attributes.map((a) => [a.name, a]));
    expect(byName.get("DEMAND")!.type).toBe("number");
    expect(byName.get("SIZE")!.type).toBe("text");
  });

  it("counts every record, including one with no properties", () => {
    const summary = summarizeFeatures([
      aPoint({ NAME: "north" }),
      { ...aPoint({}), properties: null },
    ]);

    expect(summary.recordCount).toBe(2);
  });

  it("reports one geometry kind, normalising the single and multi forms", () => {
    const multi: Feature = {
      type: "Feature",
      geometry: { type: "MultiPoint", coordinates: [[0, 0]] },
      properties: {},
    };

    expect(summarizeFeatures([aPoint({}), multi]).geometry).toBe("point");
  });

  it("reports mixed geometry when kinds disagree", () => {
    const line: Feature = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: {},
    };

    expect(summarizeFeatures([aPoint({}), line]).geometry).toBe("mixed");
  });

  it("carries what a reader converted out of, when it says", () => {
    const summary = summarizeFeatures([aPoint({})], "OSGB 1936");

    expect(summary.originalProjection).toBe("OSGB 1936");
    expect(summarizeFeatures([aPoint({})]).originalProjection).toBeUndefined();
  });
});
