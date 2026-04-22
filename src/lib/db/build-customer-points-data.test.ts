import { presets } from "src/lib/project-settings/quantities-spec";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { buildCustomerPointsData } from "./build-customer-points-data";
import {
  findMaxId,
  type AssetRows,
  type CustomerPointRow,
  type CustomerPointDemandRow,
  type CustomerPointsData,
} from "./rows";

const emptyAssetRows = (): AssetRows => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
});

const emptyCpData = (): CustomerPointsData => ({
  customerPoints: [],
  demands: [],
});

const makeFactories = (maxId = 0) =>
  initializeModelFactories({
    idGenerator: new ConsecutiveIdsGenerator(maxId),
    labelManager: new LabelManager(),
    defaults: presets.LPS.defaults,
  });

const makeCpRow = (overrides: Partial<CustomerPointRow>): CustomerPointRow => ({
  id: 0,
  label: "CP0",
  coord_x: 0,
  coord_y: 0,
  pipe_id: null,
  junction_id: null,
  snap_x: null,
  snap_y: null,
  ...overrides,
});

const makeDemandRow = (
  overrides: Partial<CustomerPointDemandRow>,
): CustomerPointDemandRow => ({
  customer_point_id: 0,
  ordinal: 0,
  base_demand: 0,
  pattern_id: null,
  ...overrides,
});

describe("buildCustomerPointsData", () => {
  it("returns empty maps when no rows are provided", () => {
    const { customerPoints, customerPointsLookup, customerDemands } =
      buildCustomerPointsData(emptyCpData(), makeFactories());

    expect(customerPoints.size).toBe(0);
    expect(customerDemands.size).toBe(0);
    expect(customerPointsLookup.hasConnections(1)).toBe(false);
  });

  it("loads an unconnected customer point with an empty demand entry", () => {
    const IDS = { CP1: 1 } as const;
    const data: CustomerPointsData = {
      customerPoints: [
        makeCpRow({ id: IDS.CP1, label: "CP1", coord_x: 3, coord_y: 4 }),
      ],
      demands: [],
    };

    const { customerPoints, customerPointsLookup, customerDemands } =
      buildCustomerPointsData(data, makeFactories(IDS.CP1));

    const cp = customerPoints.get(IDS.CP1);
    expect(cp).toBeDefined();
    expect(cp!.label).toBe("CP1");
    expect(cp!.coordinates).toEqual([3, 4]);
    expect(cp!.connection).toBeNull();
    expect(customerPointsLookup.hasConnections(IDS.CP1)).toBe(false);
    expect(customerDemands.get(IDS.CP1)).toEqual([]);
  });

  it("connects a customer point and indexes it under pipe and junction", () => {
    const IDS = { J1: 1, P1: 2, CP1: 3 } as const;
    const data: CustomerPointsData = {
      customerPoints: [
        makeCpRow({
          id: IDS.CP1,
          label: "CP1",
          coord_x: 10,
          coord_y: 20,
          pipe_id: IDS.P1,
          junction_id: IDS.J1,
          snap_x: 11,
          snap_y: 21,
        }),
      ],
      demands: [],
    };

    const { customerPoints, customerPointsLookup } = buildCustomerPointsData(
      data,
      makeFactories(IDS.CP1),
    );

    const cp = customerPoints.get(IDS.CP1)!;
    expect(cp.connection).toEqual({
      pipeId: IDS.P1,
      junctionId: IDS.J1,
      snapPoint: [11, 21],
    });
    expect(customerPointsLookup.getCustomerPoints(IDS.P1).has(cp)).toBe(true);
    expect(customerPointsLookup.getCustomerPoints(IDS.J1).has(cp)).toBe(true);
  });

  it("treats partial connection columns as unconnected", () => {
    const IDS = { P1: 1, CP1: 2 } as const;
    const data: CustomerPointsData = {
      customerPoints: [
        makeCpRow({
          id: IDS.CP1,
          label: "CP1",
          pipe_id: IDS.P1,
          junction_id: null,
          snap_x: 1,
          snap_y: 2,
        }),
      ],
      demands: [],
    };

    const { customerPoints, customerPointsLookup } = buildCustomerPointsData(
      data,
      makeFactories(IDS.CP1),
    );

    expect(customerPoints.get(IDS.CP1)!.connection).toBeNull();
    expect(customerPointsLookup.hasConnections(IDS.P1)).toBe(false);
  });

  it("preserves demand order by ordinal", () => {
    const IDS = { CP1: 1 } as const;
    const data: CustomerPointsData = {
      customerPoints: [makeCpRow({ id: IDS.CP1, label: "CP1" })],
      demands: [
        makeDemandRow({
          customer_point_id: IDS.CP1,
          ordinal: 0,
          base_demand: 5,
        }),
        makeDemandRow({
          customer_point_id: IDS.CP1,
          ordinal: 1,
          base_demand: 7,
        }),
      ],
    };

    const { customerDemands } = buildCustomerPointsData(
      data,
      makeFactories(IDS.CP1),
    );

    expect(customerDemands.get(IDS.CP1)).toEqual([
      { baseDemand: 5, patternId: undefined },
      { baseDemand: 7, patternId: undefined },
    ]);
  });

  it("passes numeric pattern_id through as patternId", () => {
    const IDS = { CP1: 1, PAT1: 99 } as const;
    const data: CustomerPointsData = {
      customerPoints: [makeCpRow({ id: IDS.CP1, label: "CP1" })],
      demands: [
        makeDemandRow({
          customer_point_id: IDS.CP1,
          ordinal: 0,
          base_demand: 2,
          pattern_id: IDS.PAT1,
        }),
      ],
    };

    const { customerDemands } = buildCustomerPointsData(
      data,
      makeFactories(IDS.CP1),
    );

    expect(customerDemands.get(IDS.CP1)).toEqual([
      { baseDemand: 2, patternId: IDS.PAT1 },
    ]);
  });

  it("registers loaded labels so new customer points avoid collisions", () => {
    const IDS = { CP1: 1 } as const;
    const data: CustomerPointsData = {
      customerPoints: [makeCpRow({ id: IDS.CP1, label: "CP1" })],
      demands: [],
    };

    const factories = makeFactories(IDS.CP1);
    buildCustomerPointsData(data, factories);
    const fresh = factories.customerPointFactory.create([0, 0]);

    expect(fresh.label).not.toBe("CP1");
  });
});

describe("findMaxId", () => {
  it("includes customer point ids in the scan", () => {
    const assetRows = emptyAssetRows();
    const cpData: CustomerPointsData = {
      customerPoints: [makeCpRow({ id: 123, label: "CP1" })],
      demands: [],
    };

    expect(findMaxId(assetRows, cpData)).toBe(123);
  });

  it("returns the max across assets and customer points", () => {
    const assetRows = emptyAssetRows();
    assetRows.junctions = [
      {
        id: 200,
        type: "junction",
        label: null,
        is_active: 1,
        coord_x: 0,
        coord_y: 0,
        elevation: null,
        initial_quality: null,
        chemical_source_type: null,
        chemical_source_strength: null,
        chemical_source_pattern_id: null,
        emitter_coefficient: null,
      },
    ];
    const cpData: CustomerPointsData = {
      customerPoints: [makeCpRow({ id: 50, label: "CP1" })],
      demands: [],
    };

    expect(findMaxId(assetRows, cpData)).toBe(200);
  });
});
