import { describe, expect, it } from "vitest";
import { AssetsMap } from "../assets-map";
import {
  buildJunction,
  buildPipe,
  buildPump,
  buildTank,
} from "../test-helpers";
import {
  detachControlReferences,
  remapControlLinkReference,
  remapControlNodeReference,
} from "./references";
import {
  Controls,
  VariableSpeedPumpControl,
  buildDefaultLevelSetting,
  buildTimedSetting,
  buildVariableSpeedPump,
} from "./types";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  T1: 4,
  T2: 5,
  PU1: 6,
  PU2: 7,
  PU3: 8,
  P1: 9,
} as const;

const buildAssets = (outletId: number = IDS.J2) =>
  new AssetsMap(
    [
      buildJunction({ id: IDS.J1 }),
      buildJunction({ id: IDS.J2 }),
      buildJunction({ id: IDS.J3 }),
      buildTank({ id: IDS.T1 }),
      buildTank({ id: IDS.T2 }),
      buildPump({ id: IDS.PU1, connections: [IDS.J1, outletId] }),
      buildPump({ id: IDS.PU2, connections: [IDS.J1, IDS.J3] }),
      buildPump({ id: IDS.PU3, connections: [IDS.J1, IDS.J3] }),
      buildPipe({ id: IDS.P1, connections: [IDS.J2, IDS.J3] }),
    ].map((asset) => [asset.id, asset]),
  );

const aVariableSpeedPump = (
  changes: Partial<Omit<VariableSpeedPumpControl, "id" | "type">> = {},
) =>
  buildVariableSpeedPump(
    {
      linkId: IDS.PU1,
      quantity: "pressure",
      targetId: IDS.J3,
      target: 30,
      minSpeed: 0.5,
      maxSpeed: 1.2,
      laggedPumpIds: [],
      schedule: [{ time: 0, target: 30 }],
      ...changes,
    },
    "vsp-1",
  );

const T1_LEVELS = { tankId: IDS.T1, offLevel: 5, onLevel: 1 };
const T2_LEVELS = { tankId: IDS.T2, offLevel: 4, onLevel: 2 };

describe("detachControlReferences", () => {
  it("returns null when no control references a removed asset", () => {
    const controls: Controls = [aVariableSpeedPump()];

    expect(
      detachControlReferences(controls, new Set([IDS.P1]), buildAssets()),
    ).toBeNull();
  });

  it("drops every control of a removed pump", () => {
    const controls: Controls = [
      buildTimedSetting(IDS.PU2, [], "timed-1"),
      aVariableSpeedPump({ linkId: IDS.PU2 }),
      buildDefaultLevelSetting(IDS.PU3, IDS.T1, 1, 5, 1, "level-1"),
    ];

    const result = detachControlReferences(
      controls,
      new Set([IDS.PU2]),
      buildAssets(),
    );

    expect(result).toEqual([controls[2]]);
  });

  it("drops a level-setting control whose tank is removed", () => {
    const controls: Controls = [
      buildDefaultLevelSetting(IDS.PU2, IDS.T1, 1, 5, 1, "level-1"),
    ];

    expect(
      detachControlReferences(controls, new Set([IDS.T1]), buildAssets()),
    ).toEqual([]);
  });

  it("falls back to the pressure at the outlet when the target node is removed", () => {
    const controls: Controls = [
      aVariableSpeedPump({ targetId: IDS.J3, laggedPumpIds: [IDS.PU2] }),
    ];

    const result = detachControlReferences(
      controls,
      new Set([IDS.J3]),
      buildAssets(),
    );

    expect(result).toStrictEqual([
      {
        id: "vsp-1",
        type: "variable-speed-pump",
        linkId: IDS.PU1,
        quantity: "pressure",
        targetId: IDS.J2,
        target: 0,
        minSpeed: 0.5,
        maxSpeed: 1.2,
        laggedPumpIds: [IDS.PU2],
        schedule: [],
      },
    ]);
  });

  it("falls back to the level of a tank outlet", () => {
    const controls: Controls = [
      aVariableSpeedPump({ targetId: IDS.J3, tankLevels: T1_LEVELS }),
    ];

    const [control] = detachControlReferences(
      controls,
      new Set([IDS.J3]),
      buildAssets(IDS.T1),
    )! as VariableSpeedPumpControl[];

    expect(control).toMatchObject({
      quantity: "level",
      targetId: IDS.T1,
      tankLevels: T1_LEVELS,
    });
  });

  it("falls back to pressure at a junction outlet and drops the tank levels when the target tank is removed", () => {
    const controls: Controls = [
      aVariableSpeedPump({
        quantity: "level",
        targetId: IDS.T1,
        tankLevels: T1_LEVELS,
      }),
    ];

    const [control] = detachControlReferences(
      controls,
      new Set([IDS.T1]),
      buildAssets(),
    )! as VariableSpeedPumpControl[];

    expect(control).toMatchObject({ quantity: "pressure", targetId: IDS.J2 });
    expect(control).not.toHaveProperty("tankLevels");
  });

  it("falls back to the pump itself when the flow target pipe is removed", () => {
    const controls: Controls = [
      aVariableSpeedPump({
        quantity: "flow",
        targetId: IDS.P1,
        tankLevels: T2_LEVELS,
      }),
    ];

    const [control] = detachControlReferences(
      controls,
      new Set([IDS.P1]),
      buildAssets(),
    )! as VariableSpeedPumpControl[];

    expect(control).toMatchObject({
      id: "vsp-1",
      quantity: "flow",
      targetId: IDS.PU1,
      target: 0,
      schedule: [],
      tankLevels: T2_LEVELS,
    });
  });

  it("omits the tank levels when their tank is removed", () => {
    const controls: Controls = [aVariableSpeedPump({ tankLevels: T2_LEVELS })];

    const [control] = detachControlReferences(
      controls,
      new Set([IDS.T2]),
      buildAssets(),
    )! as VariableSpeedPumpControl[];

    expect(control).not.toHaveProperty("tankLevels");
    expect(control).toMatchObject({ targetId: IDS.J3, target: 30 });
  });

  it("filters removed pumps out of the lagged pumps", () => {
    const controls: Controls = [
      aVariableSpeedPump({ laggedPumpIds: [IDS.PU2, IDS.PU3] }),
    ];

    const [control] = detachControlReferences(
      controls,
      new Set([IDS.PU2]),
      buildAssets(),
    )! as VariableSpeedPumpControl[];

    expect(control.laggedPumpIds).toEqual([IDS.PU3]);
  });

  it("drops the control when the outlet cannot be resolved", () => {
    const controls: Controls = [aVariableSpeedPump({ targetId: IDS.J3 })];

    expect(
      detachControlReferences(
        controls,
        new Set([IDS.J3, IDS.J2]),
        buildAssets(),
      ),
    ).toEqual([]);
  });

  it("keeps the identity of untouched controls", () => {
    const untouched = buildTimedSetting(IDS.PU3, [], "timed-1");
    const otherVsp = aVariableSpeedPump({ linkId: IDS.PU2, targetId: IDS.J1 });
    const controls: Controls = [
      untouched,
      aVariableSpeedPump({ tankLevels: T2_LEVELS }),
      otherVsp,
    ];

    const result = detachControlReferences(
      controls,
      new Set([IDS.T2]),
      buildAssets(),
    )!;

    expect(result[0]).toBe(untouched);
    expect(result[1]).not.toBe(controls[1]);
    expect(result[2]).toBe(otherVsp);
  });
});

describe("remapControlLinkReference", () => {
  it("re-points a flow target to the new link", () => {
    const controls: Controls = [
      aVariableSpeedPump({ quantity: "flow", targetId: IDS.P1 }),
    ];

    const [control] = remapControlLinkReference(
      controls,
      IDS.P1,
      IDS.PU3,
    )! as VariableSpeedPumpControl[];

    expect(control).toEqual({ ...controls[0], targetId: IDS.PU3 });
  });

  it("re-points a lagged pump in place", () => {
    const controls: Controls = [
      aVariableSpeedPump({ laggedPumpIds: [IDS.PU2, IDS.PU3] }),
    ];

    const [control] = remapControlLinkReference(
      controls,
      IDS.PU2,
      IDS.P1,
    )! as VariableSpeedPumpControl[];

    expect(control.laggedPumpIds).toEqual([IDS.P1, IDS.PU3]);
  });

  it("never re-points the control's own link", () => {
    const controls: Controls = [
      buildTimedSetting(IDS.PU1, [], "timed-1"),
      buildDefaultLevelSetting(IDS.PU1, IDS.T1, 1, 5, 1, "level-1"),
    ];

    expect(remapControlLinkReference(controls, IDS.PU1, IDS.PU2)).toBeNull();
  });
});

describe("remapControlNodeReference", () => {
  const T3 = 20;
  const J4 = 21;

  it("turns a pressure target into a level target when the node becomes a tank", () => {
    const controls: Controls = [aVariableSpeedPump({ targetId: IDS.J3 })];

    const [control] = remapControlNodeReference(
      controls,
      IDS.J3,
      buildTank({ id: T3 }),
    )! as VariableSpeedPumpControl[];

    expect(control).toEqual({
      ...controls[0],
      quantity: "level",
      targetId: T3,
    });
  });

  it("turns a level target into a pressure target and omits its tank levels when the tank becomes a junction", () => {
    const controls: Controls = [
      aVariableSpeedPump({
        quantity: "level",
        targetId: IDS.T1,
        tankLevels: T1_LEVELS,
      }),
    ];

    const [control] = remapControlNodeReference(
      controls,
      IDS.T1,
      buildJunction({ id: J4 }),
    )! as VariableSpeedPumpControl[];

    expect(control).toMatchObject({
      quantity: "pressure",
      targetId: J4,
      target: 30,
      schedule: [{ time: 0, target: 30 }],
    });
    expect(control).not.toHaveProperty("tankLevels");
  });

  it("re-points the tank levels when the tank is replaced by a tank", () => {
    const controls: Controls = [
      aVariableSpeedPump({ quantity: "flow", targetId: IDS.PU1 }),
      aVariableSpeedPump({ linkId: IDS.PU2, tankLevels: T1_LEVELS }),
    ];

    const [flow, pressure] = remapControlNodeReference(
      controls,
      IDS.T1,
      buildTank({ id: T3 }),
    )! as VariableSpeedPumpControl[];

    expect(flow).toBe(controls[0]);
    expect(pressure.tankLevels).toEqual({ ...T1_LEVELS, tankId: T3 });
  });

  it("re-points a level-setting control to a new tank", () => {
    const controls: Controls = [
      buildDefaultLevelSetting(IDS.PU2, IDS.T1, 1, 5, 1, "level-1"),
    ];

    expect(
      remapControlNodeReference(controls, IDS.T1, buildTank({ id: T3 })),
    ).toEqual([{ ...controls[0], tankId: T3 }]);
  });

  it("drops a level-setting control when its tank becomes a junction", () => {
    const controls: Controls = [
      buildDefaultLevelSetting(IDS.PU2, IDS.T1, 1, 5, 1, "level-1"),
    ];

    expect(
      remapControlNodeReference(controls, IDS.T1, buildJunction({ id: J4 })),
    ).toEqual([]);
  });
});
