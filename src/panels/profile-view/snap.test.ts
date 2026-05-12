import { describe, expect, it } from "vitest";
import type { ProfileLink, ProfilePoint } from "./chart-data";
import { pickSldSnap } from "./snap";

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

const reservoir = (nodeId: number, cumulativeLength: number): ProfilePoint => ({
  nodeId,
  nodeType: "reservoir",
  cumulativeLength,
  elevation: 0,
  head: null,
  pressure: null,
  label: `R${nodeId}`,
  coordinates: [0, 0],
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

const chartStub = {
  convertToPixel: (_axis: unknown, value: number) => value,
};

describe("pickSldSnap priority", () => {
  it("prefers a tank over a pump within tolerance", () => {
    const result = pickSldSnap(chartStub, [tank(1, 100)], [pump(2, 102)], 101);
    expect(result?.kind).toBe("node");
    expect(result?.kind === "node" && result.index).toBe(0);
  });

  it("prefers a reservoir over a non-prv valve within tolerance", () => {
    const result = pickSldSnap(
      chartStub,
      [reservoir(1, 100)],
      [valve(2, 103, "psv")],
      102,
    );
    expect(result?.kind).toBe("node");
  });

  it("prefers a pump over a non-prv valve within tolerance", () => {
    const result = pickSldSnap(
      chartStub,
      [],
      [pump(1, 100), valve(2, 103, "psv")],
      102,
    );
    expect(result?.kind).toBe("link");
    expect(result?.kind === "link" && result.link.type).toBe("pump");
  });

  it("prefers a prv over a non-prv valve within tolerance", () => {
    const result = pickSldSnap(
      chartStub,
      [],
      [valve(1, 100, "prv"), valve(2, 102, "psv")],
      101,
    );
    expect(result?.kind).toBe("link");
    expect(result?.kind === "link" && result.link.linkId).toBe(1);
  });

  it("prefers a non-prv valve over a junction within tolerance", () => {
    const result = pickSldSnap(
      chartStub,
      [junction(1, 100)],
      [valve(2, 102, "psv")],
      101,
    );
    expect(result?.kind).toBe("link");
    expect(result?.kind === "link" && result.link.linkId).toBe(2);
  });

  it("skips junctions when their tier is hidden", () => {
    const result = pickSldSnap(chartStub, [junction(1, 100)], [], 100, {
      showJunctions: false,
      showOtherValves: true,
    });
    expect(result).toBeNull();
  });

  it("skips other valves when their tier is hidden", () => {
    const result = pickSldSnap(chartStub, [], [valve(1, 100, "psv")], 100, {
      showJunctions: true,
      showOtherValves: false,
    });
    expect(result).toBeNull();
  });

  it("still selects pumps and prvs when secondary tiers are hidden", () => {
    const result = pickSldSnap(
      chartStub,
      [],
      [pump(1, 100), valve(2, 110, "prv")],
      109,
      { showJunctions: false, showOtherValves: false },
    );
    expect(result?.kind).toBe("link");
    expect(result?.kind === "link" && result.link.type).toBe("valve");
  });

  it("returns null when nothing is within tolerance", () => {
    const result = pickSldSnap(chartStub, [tank(1, 200)], [pump(2, 250)], 100);
    expect(result).toBeNull();
  });

  it("picks the nearest within a tier when multiple are within tolerance", () => {
    const result = pickSldSnap(chartStub, [], [pump(1, 95), pump(2, 102)], 100);
    expect(result?.kind === "link" && result.link.linkId).toBe(2);
  });
});
