import { expect, describe, it } from "vitest";
import { CustomerPointsLookup } from "./customer-points-lookup";
import { CustomerPoint } from "./customer-points";

describe("CustomerPointsLookup", () => {
  it("provides customer points connected to an asset", () => {
    const IDS = { P1: 1, J1: 2, J2: 3, CP1: 4, CP2: 5 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [1, 1], junctionId: IDS.J1 });

    const cp2 = new CustomerPoint(IDS.CP2, [0, 0], {
      baseDemand: 20,
      label: "cp2",
      demands: [{ baseDemand: 20 }],
    });
    cp2.connect({ pipeId: IDS.P1, snapPoint: [2, 2], junctionId: IDS.J2 });

    lookup.addConnection(cp1);
    lookup.addConnection(cp2);

    expect(lookup.getCustomerPoints(IDS.P1)).toEqual(new Set([cp1, cp2]));
    expect(lookup.getCustomerPoints(IDS.J1)).toEqual(new Set([cp1]));
    expect(lookup.getCustomerPoints(IDS.J2)).toEqual(new Set([cp2]));
  });

  it("removes customer points when removing connections", () => {
    const IDS = { P1: 1, J1: 2, CP1: 3, CP2: 4 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [1, 1], junctionId: IDS.J1 });

    const cp2 = new CustomerPoint(IDS.CP2, [0, 0], {
      baseDemand: 20,
      label: "cp2",
      demands: [{ baseDemand: 20 }],
    });
    cp2.connect({ pipeId: IDS.P1, snapPoint: [2, 2], junctionId: IDS.J1 });

    lookup.addConnection(cp1);
    lookup.addConnection(cp2);

    lookup.removeConnection(cp1);

    expect(lookup.getCustomerPoints(IDS.P1)).toEqual(new Set([cp2]));
    expect(lookup.getCustomerPoints(IDS.J1)).toEqual(new Set([cp2]));
  });

  it("does not crash when removing missing customer point", () => {
    const IDS = { P1: 1, J1: 2, P2: 3, J2: 4, CP1: 5, CP2: 6 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [1, 1], junctionId: IDS.J1 });

    const cp2 = new CustomerPoint(IDS.CP2, [0, 0], {
      baseDemand: 20,
      label: "cp2",
      demands: [{ baseDemand: 20 }],
    });
    cp2.connect({ pipeId: IDS.P2, snapPoint: [2, 2], junctionId: IDS.J2 });

    lookup.addConnection(cp1);

    lookup.removeConnection(cp2);

    expect(lookup.getCustomerPoints(IDS.P1)).toEqual(new Set([cp1]));
  });

  it("allows multiple customer points on same pipe and junction", () => {
    const IDS = { P1: 1, J1: 2, CP1: 3, CP2: 4 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [1, 1], junctionId: IDS.J1 });

    const cp2 = new CustomerPoint(IDS.CP2, [0, 0], {
      baseDemand: 20,
      label: "cp2",
      demands: [{ baseDemand: 20 }],
    });
    cp2.connect({ pipeId: IDS.P1, snapPoint: [2, 2], junctionId: IDS.J1 });

    lookup.addConnection(cp1);
    lookup.addConnection(cp2);

    expect(lookup.getCustomerPoints(IDS.P1)).toEqual(new Set([cp1, cp2]));
    expect(lookup.getCustomerPoints(IDS.J1)).toEqual(new Set([cp1, cp2]));
  });

  it("handles customer points with no connections", () => {
    const IDS = { P1: 1, CP1: 2 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });

    lookup.addConnection(cp1);

    expect(lookup.getCustomerPoints(IDS.P1)).toEqual(new Set());
    expect(lookup.hasConnections(IDS.P1)).toBe(false);
  });

  it("cleans up empty sets when removing last customer point", () => {
    const IDS = { P1: 1, J1: 2, CP1: 3 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [1, 1], junctionId: IDS.J1 });

    lookup.addConnection(cp1);
    expect(lookup.hasConnections(IDS.P1)).toBe(true);
    expect(lookup.hasConnections(IDS.J1)).toBe(true);

    lookup.removeConnection(cp1);
    expect(lookup.hasConnections(IDS.P1)).toBe(false);
    expect(lookup.hasConnections(IDS.J1)).toBe(false);
  });

  it("can clear all connections", () => {
    const IDS = { P1: 1, J1: 2, CP1: 3 } as const;
    const lookup = new CustomerPointsLookup();

    const cp1 = new CustomerPoint(IDS.CP1, [0, 0], {
      baseDemand: 10,
      label: "cp1",
      demands: [{ baseDemand: 10 }],
    });
    cp1.connect({ pipeId: IDS.P1, snapPoint: [1, 1], junctionId: IDS.J1 });

    lookup.addConnection(cp1);
    expect(lookup.hasConnections(IDS.P1)).toBe(true);

    lookup.clear();
    expect(lookup.hasConnections(IDS.P1)).toBe(false);
    expect(lookup.getCustomerPoints(IDS.P1)).toEqual(new Set());
  });
});
