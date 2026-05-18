import { describe, expect, it } from "vitest";
import type { ProfileLink, ProfilePoint } from "../chart-data";
import {
  DEFAULT_ASSUMED_STRIP_WIDTH,
  OTHER_VALVE_MIN_SPACING_PX,
  SECONDARY_MIN_SPACING_PX,
  computeSldVisibility,
} from "./visibility";

const junction = (nodeId: number, cumulativeLength: number): ProfilePoint => ({
  nodeId,
  nodeType: "junction",
  cumulativeLength,
  elevation: 0,
  head: null,
  pressure: null,
  label: `J${nodeId}`,
  coordinates: [0, 0],
});

const tank = (nodeId: number, cumulativeLength: number): ProfilePoint => ({
  nodeId,
  nodeType: "tank",
  cumulativeLength,
  elevation: 0,
  head: null,
  pressure: null,
  label: `T${nodeId}`,
  coordinates: [0, 0],
});

const valve = (
  linkId: number,
  midLength: number,
  valveKind: string,
): ProfileLink => ({
  linkId,
  type: "valve",
  valveKind,
  status: "active",
  isActive: true,
  startLength: midLength - 1,
  endLength: midLength + 1,
  midLength,
  label: `V${linkId}`,
  reversed: false,
});

describe("computeSldVisibility", () => {
  it("shows secondary tier when items are sparse for the strip width", () => {
    const points = [junction(1, 0), junction(2, 100), junction(3, 200)];
    const result = computeSldVisibility({
      points,
      links: [],
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: 200,
      stripPixelWidth: 800,
    });

    expect(result.showJunctions).toBe(true);
  });

  it("hides junctions when their average pixel spacing falls below the threshold", () => {
    const points = Array.from({ length: 100 }, (_, i) => junction(i, i));
    const result = computeSldVisibility({
      points,
      links: [],
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: 99,
      stripPixelWidth: 800,
    });

    expect(800 / 100 < SECONDARY_MIN_SPACING_PX).toBe(true);
    expect(result.showJunctions).toBe(false);
  });

  it("hides non-prv valves independently of prv presence", () => {
    const links = Array.from({ length: 60 }, (_, i) =>
      valve(i, i, i === 7 ? "prv" : "psv"),
    );
    const result = computeSldVisibility({
      points: [],
      links,
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: 59,
      stripPixelWidth: 800,
    });

    expect(result.showOtherValves).toBe(false);
  });

  it("requires more breathing room for non-prv valves than for junctions", () => {
    const valveCount = Math.ceil(800 / SECONDARY_MIN_SPACING_PX) - 2;
    const links = Array.from({ length: valveCount }, (_, i) =>
      valve(i, i, "psv"),
    );

    expect(800 / valveCount >= SECONDARY_MIN_SPACING_PX).toBe(true);
    expect(800 / valveCount < OTHER_VALVE_MIN_SPACING_PX).toBe(true);

    const result = computeSldVisibility({
      points: [],
      links,
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: valveCount - 1,
      stripPixelWidth: 800,
    });

    expect(result.showOtherValves).toBe(false);
  });

  it("falls back to DEFAULT_ASSUMED_STRIP_WIDTH when stripPixelWidth is null", () => {
    const points = Array.from({ length: 100 }, (_, i) => junction(i, i));
    const result = computeSldVisibility({
      points,
      links: [],
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: 99,
      stripPixelWidth: null,
    });

    const expected =
      DEFAULT_ASSUMED_STRIP_WIDTH / 100 >= SECONDARY_MIN_SPACING_PX;
    expect(result.showJunctions).toBe(expected);
  });

  it("returns sane defaults for an empty path", () => {
    const result = computeSldVisibility({
      points: [],
      links: [],
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: 0,
      stripPixelWidth: 800,
    });

    expect(result.showJunctions).toBe(true);
    expect(result.showOtherValves).toBe(true);
  });

  it("does not count items outside the visible zoom window", () => {
    const points = Array.from({ length: 100 }, (_, i) => junction(i, i));
    const result = computeSldVisibility({
      points,
      links: [],
      zoomStart: 0,
      zoomEnd: 10,
      totalLength: 99,
      stripPixelWidth: 800,
    });

    expect(result.showJunctions).toBe(true);
  });

  it("ignores tanks (priority tier) when judging junction density", () => {
    const points = [
      tank(1, 0),
      tank(2, 50),
      tank(3, 100),
      junction(4, 25),
      junction(5, 75),
    ];
    const result = computeSldVisibility({
      points,
      links: [],
      zoomStart: 0,
      zoomEnd: 100,
      totalLength: 100,
      stripPixelWidth: 100,
    });

    expect(result.showJunctions).toBe(true);
  });
});
