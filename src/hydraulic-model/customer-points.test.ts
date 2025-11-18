import {
  buildCustomerPoint,
  HydraulicModelBuilder,
} from "src/__helpers__/hydraulic-model-builder";
import { getActiveCustomerPoints } from "./customer-points";

describe("CustomerPoint", () => {
  it("creates customer point with provided ID", () => {
    const IDS = { CP5: 5 };
    const customerPoint = buildCustomerPoint(IDS.CP5, {
      coordinates: [10, 20],
      demand: 100,
    });

    expect(customerPoint.id).toBe(IDS.CP5);
    expect(customerPoint.coordinates).toEqual([10, 20]);
    expect(customerPoint.baseDemand).toBe(100);
  });

  it("creates customer point with zero demand", () => {
    const IDS = { CP1: 1 };
    const customerPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [10, 20],
    });

    expect(customerPoint.id).toBe(IDS.CP1);
    expect(customerPoint.coordinates).toEqual([10, 20]);
    expect(customerPoint.baseDemand).toBe(0);
  });

  it("copies customer point without connection", () => {
    const IDS = { CP1: 1 };
    const originalPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [10, 20],
      demand: 50,
    });

    const copiedPoint = originalPoint.copyDisconnected();

    expect(copiedPoint.id).toBe(originalPoint.id);
    expect(copiedPoint.coordinates).toEqual(originalPoint.coordinates);
    expect(copiedPoint.baseDemand).toBe(originalPoint.baseDemand);
    expect(copiedPoint.connection).toBeNull();

    expect(copiedPoint.coordinates).not.toBe(originalPoint.coordinates);

    copiedPoint.coordinates[0] = 99;
    expect(originalPoint.coordinates[0]).toBe(10);
  });

  it("does not preserve connection data when copying", () => {
    const IDS = { CP1: 1, P1: 2, J1: 3 };
    const originalPoint = buildCustomerPoint(IDS.CP1, {
      coordinates: [10, 20],
      demand: 50,
    });

    const connection = {
      pipeId: IDS.P1,
      snapPoint: [15, 25] as [number, number],
      distance: 7.5,
      junctionId: IDS.J1,
    };

    originalPoint.connect(connection);
    const copiedPoint = originalPoint.copyDisconnected();

    expect(originalPoint.connection).not.toBeNull();
    expect(copiedPoint.connection).toBeNull();
  });
});

describe("getActiveCustomerPoints", () => {
  it("returns all customer points when connected pipe is active", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [25, 0],
        demand: 50,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [25, 0],
        },
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [75, 0],
        demand: 30,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J2,
          snapPoint: [75, 0],
        },
      })
      .build();

    const activeCustomerPoints = getActiveCustomerPoints(
      hydraulicModel.customerPointsLookup,
      hydraulicModel.assets,
      IDS.J1,
    );

    expect(activeCustomerPoints).toHaveLength(1);
    expect(activeCustomerPoints[0].id).toBe(IDS.CP1);
  });

  it("filters out customer points when connected pipe is inactive", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [50, 0],
        demand: 100,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J1,
          snapPoint: [50, 0],
        },
      })
      .build();

    const activeCustomerPoints = getActiveCustomerPoints(
      hydraulicModel.customerPointsLookup,
      hydraulicModel.assets,
      IDS.J1,
    );

    expect(activeCustomerPoints).toHaveLength(0);
  });

  it("returns empty array for disconnected customer points", () => {
    const IDS = { J1: 1, CP1: 2 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [10, 10],
        demand: 75,
      })
      .build();

    const activeCustomerPoints = getActiveCustomerPoints(
      hydraulicModel.customerPointsLookup,
      hydraulicModel.assets,
      IDS.J1,
    );

    expect(activeCustomerPoints).toHaveLength(0);
  });

  it("handles mix of active and inactive pipes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5, CP1: 6, CP2: 7 };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 0] })
      .aJunction(IDS.J3, { coordinates: [200, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: true,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        isActive: false,
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [50, 0],
        demand: 40,
        connection: {
          pipeId: IDS.P1,
          junctionId: IDS.J2,
          snapPoint: [50, 0],
        },
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [150, 0],
        demand: 60,
        connection: {
          pipeId: IDS.P2,
          junctionId: IDS.J2,
          snapPoint: [150, 0],
        },
      })
      .build();

    const activeCustomerPoints = getActiveCustomerPoints(
      hydraulicModel.customerPointsLookup,
      hydraulicModel.assets,
      IDS.J2,
    );

    expect(activeCustomerPoints).toHaveLength(1);
    expect(activeCustomerPoints[0].id).toBe(IDS.CP1);
  });
});
