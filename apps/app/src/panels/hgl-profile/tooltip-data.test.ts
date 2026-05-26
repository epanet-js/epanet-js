import { describe, expect, it } from "vitest";
import type { ProfileLink, ProfilePoint, TerrainPoint } from "./chart-data";
import { getTooltipContent, interpolatePressure } from "./tooltip-data";

const junction = (
  nodeId: number,
  cumulativeLength: number,
  overrides: Partial<ProfilePoint> = {},
): ProfilePoint => ({
  nodeId,
  nodeType: "junction",
  cumulativeLength,
  elevation: 0,
  head: null,
  pressure: null,
  label: `J${nodeId}`,
  coordinates: [0, 0],
  ...overrides,
});

const pipe = (
  linkId: number,
  startLength: number,
  endLength: number,
): ProfileLink => ({
  linkId,
  type: "pipe",
  status: "open",
  isActive: true,
  startLength,
  endLength,
  midLength: (startLength + endLength) / 2,
  label: `P${linkId}`,
  reversed: false,
});

const pump = (linkId: number, midLength: number): ProfileLink => ({
  linkId,
  type: "pump",
  status: "on",
  isActive: true,
  startLength: midLength - 1,
  endLength: midLength + 1,
  midLength,
  label: `Pump${linkId}`,
  reversed: false,
});

describe("interpolatePressure", () => {
  it("returns the midpoint pressure between two nodes", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const points = [
      junction(IDS.J1, 0, { pressure: 50 }),
      junction(IDS.J2, 100, { pressure: 30 }),
    ];

    expect(interpolatePressure(50, points)).toBe(40);
  });

  it("returns null when an adjacent point has null pressure", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const points = [
      junction(IDS.J1, 0, { pressure: 50 }),
      junction(IDS.J2, 100, { pressure: null }),
    ];

    expect(interpolatePressure(50, points)).toBeNull();
  });

  it("returns null for x outside the points range", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const points = [
      junction(IDS.J1, 0, { pressure: 50 }),
      junction(IDS.J2, 100, { pressure: 30 }),
    ];

    expect(interpolatePressure(150, points)).toBeNull();
  });
});

describe("getTooltipContent estimated", () => {
  it("returns interpolated pressure when hovering over a pipe link", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const points = [
      junction(IDS.J1, 0, { elevation: 10, head: 60, pressure: 50 }),
      junction(IDS.J2, 100, { elevation: 10, head: 40, pressure: 30 }),
    ];
    const links = [pipe(IDS.P1, 0, 100)];
    const terrain: TerrainPoint[] = [
      { cumulativeLength: 0, elevation: 10 },
      { cumulativeLength: 100, elevation: 10 },
    ];

    const content = getTooltipContent(50, null, points, links, terrain, true);

    expect(content.kind).toBe("estimated");
    if (content.kind !== "estimated") return;
    expect(content.pressure).toBe(40);
    expect(content.hgl).toBe(50);
    expect(content.elevation).toBe(10);
    expect(content.linkLabel).toBe(`P${IDS.P1}`);
  });

  it("returns null pressure and hgl when hovering over a pump link", () => {
    const IDS = { J1: 1, J2: 2, Pump1: 3 } as const;
    const points = [
      junction(IDS.J1, 0, { elevation: 10, head: 60, pressure: 50 }),
      junction(IDS.J2, 100, { elevation: 10, head: 40, pressure: 30 }),
    ];
    const links = [pump(IDS.Pump1, 50)];

    const content = getTooltipContent(50, null, points, links, null, true);

    expect(content.kind).toBe("estimated");
    if (content.kind !== "estimated") return;
    expect(content.pressure).toBeNull();
    expect(content.hgl).toBeNull();
  });
});
