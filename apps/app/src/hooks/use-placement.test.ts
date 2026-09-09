import type { Issue } from "@epanet-js/converters";
import { placementFor, type Placement } from "./use-placement";

const gridPlacement: Placement = {
  kind: "transform",
  toWgs84: ([x, y]) => [x / 1000, y / 1000],
};

const unplaced: Issue[] = [
  { code: "coordinateSystemUnknown", severity: "error" },
];

const assumedWgs84: Issue[] = [
  { code: "coordinateSystemMissing", severity: "warning" },
];

describe("placementFor", () => {
  it("places a source the parse could not place with the project's transform", () => {
    expect(placementFor(gridPlacement, unplaced)).toBe(gridPlacement);
  });

  it("leaves a source the parse placed where it is", () => {
    expect(placementFor(gridPlacement, [])).toEqual({ kind: "wgs84" });
  });

  it("treats an assumption that held as placed", () => {
    expect(placementFor(gridPlacement, assumedWgs84)).toEqual({
      kind: "wgs84",
    });
  });

  it("changes nothing for a georeferenced project", () => {
    const wgs84: Placement = { kind: "wgs84" };

    expect(placementFor(wgs84, unplaced)).toEqual({ kind: "wgs84" });
    expect(placementFor(wgs84, [])).toEqual({ kind: "wgs84" });
  });
});
