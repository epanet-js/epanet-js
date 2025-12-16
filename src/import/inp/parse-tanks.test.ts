import { parseInp } from "./parse-inp";
import { Asset, AssetsMap, Tank } from "src/hydraulic-model";

describe("parse tanks", () => {
  it("creates a tank from the tank data", () => {
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    ;ID   Elev.  InitLvl  MinLvl  MaxLvl  Diam  MinVol  VolCurve  Overflow
    ;---------------------------------------------------------------------
    T1    100     15       5       25     120   14       *          YES

    [COORDINATES]
    T1\t${lng}\t${lat}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.id).not.toBeUndefined();
    expect(tank.id).not.toEqual("T1");
    expect(tank.type).toEqual("tank");
    expect(tank.elevation).toEqual(100);
    expect(tank.initialLevel).toEqual(15);
    expect(tank.minLevel).toEqual(5);
    expect(tank.maxLevel).toEqual(25);
    expect(tank.diameter).toEqual(120);
    expect(tank.minVolume).toEqual(14);
    expect(tank.overflow).toEqual(true);
    expect(tank.coordinates).toEqual([-10, 10]);
    expect(issues).toBeNull();
  });

  it("tolerates references with different case", () => {
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    ;ID   Elev.  InitLvl  MinLvl  MaxLvl  Diam  MinVol  VolCurve  Overflow
    ;---------------------------------------------------------------------
    T1    100     15       5       25     120   14       *          YES

    [COORDINATES]
    t1\t${lng}\t${lat}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.id).not.toBeUndefined();
    expect(tank.id).not.toEqual("T1");
    expect(tank.overflow).toEqual(true);
    expect(tank.coordinates).toEqual([-10, 10]);
    expect(issues).toBeNull();
  });

  it("registers CURVES section as used when tank references a volume curve", () => {
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    ;ID   Elev.  InitLvl  MinLvl  MaxLvl  Diam  MinVol  VolCurve  Overflow
    ;---------------------------------------------------------------------
    T1    100     15       5       25     120   14       TANK1_VOL  YES

    [COORDINATES]
    T1\t${lng}\t${lat}
    `;

    const { hydraulicModel, issues, stats } = parseInp(inp);

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.id).not.toBeUndefined();
    expect(tank.type).toEqual("tank");
    expect(tank.overflow).toEqual(true);
    expect(tank.coordinates).toEqual([-10, 10]);

    expect(stats.counts.get("[CURVES]")).toBeUndefined();
    expect(issues?.hasTankCurves).toBe(1);
  });

  it("does not register CURVES section when tank uses asterisk placeholder", () => {
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    ;ID   Elev.  InitLvl  MinLvl  MaxLvl  Diam  MinVol  VolCurve  Overflow
    ;---------------------------------------------------------------------
    T1    100     15       5       25     120   14       *          YES

    [COORDINATES]
    T1\t${lng}\t${lat}
    `;

    const { hydraulicModel, issues, stats } = parseInp(inp);

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.id).not.toBeUndefined();
    expect(tank.type).toEqual("tank");
    expect(tank.overflow).toEqual(true);
    expect(tank.coordinates).toEqual([-10, 10]);

    expect(stats.counts.get("[CURVES]")).toBeUndefined();
    expect(issues?.hasTankCurves).toBeFalsy();
  });

  it("sets overflow to false when tank overflow is NO", () => {
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    ;ID   Elev.  InitLvl  MinLvl  MaxLvl  Diam  MinVol  VolCurve  Overflow
    ;---------------------------------------------------------------------
    T1    100     15       5       25     120   14       *          NO

    [COORDINATES]
    T1\t${lng}\t${lat}
    `;

    const { hydraulicModel } = parseInp(inp);

    const tank = getByLabel(hydraulicModel.assets, "T1") as Tank;
    expect(tank.overflow).toEqual(false);
  });

  const getByLabel = (assets: AssetsMap, label: string): Asset | undefined => {
    return [...assets.values()].find((a) => a.label === label);
  };
});
