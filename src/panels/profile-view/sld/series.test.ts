import { describe, expect, it } from "vitest";
import type { SeriesOption } from "echarts";
import type { ProfileLink, ProfilePoint } from "../chart-data";
import { buildSldSeries } from "./series";
import type { SldIcons } from "./use-sld-icons";
import type { SldVisibility } from "./visibility";

const stubIcons: SldIcons = {
  pumpUrl: () => null,
  valveUrl: () => null,
  iconUrl: () => null,
};

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

const pipe = (linkId: number, start: number, end: number): ProfileLink => ({
  linkId,
  type: "pipe",
  status: "open",
  isActive: true,
  startLength: start,
  endLength: end,
  midLength: (start + end) / 2,
  label: `P${linkId}`,
  reversed: false,
});

const pump = (linkId: number, start: number, end: number): ProfileLink => ({
  linkId,
  type: "pump",
  status: "on",
  isActive: true,
  startLength: start,
  endLength: end,
  midLength: (start + end) / 2,
  label: `Pump${linkId}`,
  reversed: false,
});

const valve = (
  linkId: number,
  start: number,
  end: number,
  valveKind: string,
): ProfileLink => ({
  linkId,
  type: "valve",
  valveKind,
  status: "active",
  isActive: true,
  startLength: start,
  endLength: end,
  midLength: (start + end) / 2,
  label: `V${linkId}`,
  reversed: false,
});

const findByName = (series: SeriesOption[], name: string): SeriesOption[] =>
  series.filter((s) => s.name === name);

const dataLength = (s: SeriesOption): number => {
  const data = (s as { data?: unknown[] }).data ?? [];
  return data.length;
};

describe("buildSldSeries", () => {
  describe("default visibility (back-compat)", () => {
    it("returns empty array when there are no links", () => {
      expect(
        buildSldSeries({
          points: [junction(1, 0)],
          links: [],
          sldY: 0,
          pipeColor: "#000",
          nodeColor: "#000",
          sldIcons: stubIcons,
        }),
      ).toEqual([]);
    });

    it("emits all series when no visibility is provided", () => {
      const series = buildSldSeries({
        points: [tank(1, 0), junction(2, 50), reservoir(3, 100)],
        links: [
          pipe(10, 0, 100),
          pump(11, 100, 105),
          valve(12, 105, 110, "prv"),
          valve(13, 110, 115, "psv"),
        ],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
      });

      expect(findByName(series, "sldPipes").length).toBe(1);
      expect(findByName(series, "sldPumpValves").length).toBe(1);
      expect(findByName(series, "sldNodes").length).toBeGreaterThanOrEqual(3);
      expect(findByName(series, "sldPumpIcons").length).toBe(1);
      expect(findByName(series, "sldValveIcons").length).toBe(2);
    });
  });

  describe("visibility filtering", () => {
    const hidden: SldVisibility = {
      showJunctions: false,
      showOtherValves: false,
    };

    it("omits junctions and non-prv valves when both tiers are hidden", () => {
      const series = buildSldSeries({
        points: [tank(1, 0), junction(2, 50), junction(3, 80)],
        links: [
          pipe(10, 0, 100),
          valve(11, 100, 105, "prv"),
          valve(12, 105, 110, "psv"),
          valve(13, 110, 115, "fcv"),
        ],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
        visibility: hidden,
      });

      const valveSeries = findByName(series, "sldValveIcons");
      expect(valveSeries.length).toBe(1);
      expect(dataLength(valveSeries[0])).toBe(1);

      const nodeSeries = findByName(series, "sldNodes");
      const totalNodeData = nodeSeries.reduce(
        (acc, s) => acc + dataLength(s),
        0,
      );
      expect(totalNodeData).toBe(1);

      expect(findByName(series, "sldPipes").length).toBe(1);
      expect(findByName(series, "sldPumpValves").length).toBe(1);
    });

    it("does not promote selected hidden junctions or other valves", () => {
      const series = buildSldSeries({
        points: [tank(1, 0), junction(2, 50), junction(3, 80)],
        links: [
          pipe(10, 0, 100),
          valve(11, 100, 105, "psv"),
          valve(12, 105, 110, "fcv"),
        ],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
        selectedIds: new Set<number>([3, 12]),
        visibility: hidden,
      });

      const nodeSeries = findByName(series, "sldNodes");
      const totalNodeData = nodeSeries.reduce(
        (acc, s) => acc + dataLength(s),
        0,
      );
      expect(totalNodeData).toBe(1);

      expect(findByName(series, "sldValveIcons").length).toBe(0);
    });
  });

  describe("selection halo", () => {
    it("renders a halo for selected pumps and prvs at z:6", () => {
      const series = buildSldSeries({
        points: [],
        links: [
          pipe(1, 0, 10),
          pump(2, 10, 11),
          valve(3, 11, 12, "prv"),
          valve(4, 12, 13, "psv"),
        ],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
        selectedIds: new Set<number>([2, 3]),
      });

      const halo = findByName(series, "sldPumpValveSelectionHalo")[0];
      expect(halo).toBeDefined();
      expect(halo.z).toBe(6);
      expect(dataLength(halo)).toBe(2);
    });

    it("hides halo for selected other-valves when secondary tier is hidden", () => {
      const visibility: SldVisibility = {
        showJunctions: true,
        showOtherValves: false,
      };

      const series = buildSldSeries({
        points: [],
        links: [pipe(1, 0, 10), pump(2, 10, 11), valve(3, 11, 12, "psv")],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
        selectedIds: new Set<number>([2, 3]),
        visibility,
      });

      const halo = findByName(series, "sldPumpValveSelectionHalo")[0];
      expect(halo).toBeDefined();
      expect(dataLength(halo)).toBe(1);
    });

    it("does not emit halo when nothing is selected", () => {
      const series = buildSldSeries({
        points: [],
        links: [pipe(1, 0, 10), pump(2, 10, 11)],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
      });

      expect(findByName(series, "sldPumpValveSelectionHalo").length).toBe(0);
    });
  });

  describe("valve split", () => {
    it("emits prv and non-prv valves as separate scatter series with different z", () => {
      const series = buildSldSeries({
        points: [],
        links: [
          pipe(1, 0, 10),
          valve(2, 10, 11, "prv"),
          valve(3, 11, 12, "prv"),
          valve(4, 12, 13, "psv"),
          valve(5, 13, 14, "fcv"),
        ],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
      });

      const valveSeries = findByName(series, "sldValveIcons");
      expect(valveSeries.length).toBe(2);

      const prvSeries = valveSeries.find((s) => s.z === 12);
      const otherSeries = valveSeries.find((s) => s.z === 7);
      expect(prvSeries).toBeDefined();
      expect(otherSeries).toBeDefined();
      expect(dataLength(prvSeries!)).toBe(2);
      expect(dataLength(otherSeries!)).toBe(2);
    });
  });

  describe("z-order priority", () => {
    it("places priority items on a higher zlevel than secondary items", () => {
      const series = buildSldSeries({
        points: [tank(1, 0), reservoir(2, 100), junction(3, 50)],
        links: [
          pipe(10, 0, 100),
          pump(11, 100, 105),
          valve(12, 105, 110, "prv"),
          valve(13, 110, 115, "psv"),
        ],
        sldY: 0,
        pipeColor: "#000",
        nodeColor: "#000",
        sldIcons: stubIcons,
        selectedIds: new Set<number>([11]),
      });

      const pipes = findByName(series, "sldPipes")[0];
      const connectors = findByName(series, "sldPumpValves")[0];
      const pumps = findByName(series, "sldPumpIcons")[0];
      const valveSeries = findByName(series, "sldValveIcons");
      const prv = valveSeries.find((s) => s.z === 12)!;
      const other = valveSeries.find((s) => s.z === 7)!;
      const halo = findByName(series, "sldPumpValveSelectionHalo")[0];
      const tankReservoirSeries = findByName(series, "sldNodes").filter(
        (s) => s.zlevel === 1 && s.z === 13,
      );

      expect(pumps.zlevel).toBe(1);
      expect(prv.zlevel).toBe(1);
      expect(tankReservoirSeries.length).toBe(2);

      expect(pipes.zlevel ?? 0).toBe(0);
      expect(connectors.zlevel ?? 0).toBe(0);
      expect(other.zlevel ?? 0).toBe(0);
      expect(halo.zlevel ?? 0).toBe(0);
    });
  });
});
