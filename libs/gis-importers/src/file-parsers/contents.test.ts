import type { Feature } from "geojson";
import { contentsOf } from "./contents";

const aPoint = (properties: Record<string, unknown>): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties,
});

describe("contentsOf", () => {
  it("offers an attribute any record states", () => {
    const contents = contentsOf([
      aPoint({ NAME: "north" }),
      aPoint({ CODE: "a" }),
    ]);

    expect(contents.attributes.map((a) => a.name)).toEqual(["CODE", "NAME"]);
  });

  it("sorts attributes by name", () => {
    const contents = contentsOf([aPoint({ b: 1, a: 2, C: 3 })]);

    expect(contents.attributes.map((a) => a.name)).toEqual(["a", "b", "C"]);
  });

  it("marks an attribute every record states", () => {
    const contents = contentsOf([
      aPoint({ NAME: "north", CODE: "a" }),
      aPoint({ NAME: "south" }),
    ]);

    const byName = new Map(contents.attributes.map((a) => [a.name, a]));
    expect(byName.get("NAME")!.onEveryRecord).toBe(true);
    expect(byName.get("CODE")!.onEveryRecord).toBe(false);
  });

  it("ignores a blank value when deciding what a record states", () => {
    const contents = contentsOf([
      aPoint({ NAME: "north" }),
      aPoint({ NAME: "  " }),
    ]);

    expect(contents.attributes[0].onEveryRecord).toBe(false);
  });

  it("leaves out an attribute no record states", () => {
    const contents = contentsOf([aPoint({ NAME: null })]);

    expect(contents.attributes).toEqual([]);
  });

  it("is a number only when every stated value reads as one", () => {
    const contents = contentsOf([
      aPoint({ DEMAND: 10, SIZE: 4 }),
      aPoint({ DEMAND: "12.5", SIZE: "INS" }),
    ]);

    const byName = new Map(contents.attributes.map((a) => [a.name, a]));
    expect(byName.get("DEMAND")!.type).toBe("number");
    expect(byName.get("SIZE")!.type).toBe("text");
  });

  it("counts every record, including one with no properties", () => {
    const contents = contentsOf([
      aPoint({ NAME: "north" }),
      { ...aPoint({}), properties: null },
    ]);

    expect(contents.recordCount).toBe(2);
  });

  it("reports one geometry kind, normalising the single and multi forms", () => {
    const multi: Feature = {
      type: "Feature",
      geometry: { type: "MultiPoint", coordinates: [[0, 0]] },
      properties: {},
    };

    expect(
      contentsOf([aPoint({}), multi]).groups.map((group) => group.geometry),
    ).toEqual(["point"]);
  });

  it("lists every kind of a source of mixed geometry, once and in order", () => {
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

    expect(
      contentsOf([line, aPoint({}), line]).groups.map(
        (group) => group.geometry,
      ),
    ).toEqual(["point", "line"]);
  });
});
