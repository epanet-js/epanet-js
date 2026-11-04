import { describe, it, expect } from "vitest";
import { isCurveInUse } from "./curve-usage";
import type { Curves } from "./curves";
import { initializeHydraulicModel } from "./hydraulic-model";
import type { Asset } from "./asset-types";
import { buildPump, buildTank, buildValve } from "./test-helpers";

describe("isCurveInUse", () => {
  const IDS = { CURVE: 10, OTHER_CURVE: 11, J1: 1, J2: 2, LINK: 3, T1: 4 };
  const points = [{ x: 0, y: 0 }];

  it("detects a tank volume curve", () => {
    const hydraulicModel = aModel(
      [buildTank({ id: IDS.T1, volumeCurveId: IDS.CURVE })],
      curves([IDS.CURVE, "volume"]),
    );

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(true);
  });

  it("detects a valve curve", () => {
    const hydraulicModel = aModel(
      [
        buildValve({
          id: IDS.LINK,
          connections: [IDS.J1, IDS.J2],
          kind: "gpv",
          curveId: IDS.CURVE,
        }),
      ],
      curves([IDS.CURVE, "headloss"]),
    );

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(true);
  });

  it("detects a pump efficiency curve", () => {
    const hydraulicModel = aModel(
      [
        buildPump({
          id: IDS.LINK,
          connections: [IDS.J1, IDS.J2],
          efficiencyCurveId: IDS.CURVE,
        }),
      ],
      curves([IDS.CURVE, "efficiency"]),
    );

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(true);
  });

  it("ignores curves nothing references", () => {
    const hydraulicModel = aModel(
      [buildTank({ id: IDS.T1, volumeCurveId: IDS.OTHER_CURVE })],
      curves([IDS.CURVE, "volume"], [IDS.OTHER_CURVE, "volume"]),
    );

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(false);
  });

  const curves = (
    ...entries: [number, "volume" | "headloss" | "efficiency"][]
  ): Curves =>
    new Map(
      entries.map(([id, type]) => [id, { id, label: `C${id}`, type, points }]),
    );
});

const aModel = (assets: Asset[], curves: Curves) =>
  initializeHydraulicModel({
    assets: new Map(assets.map((asset) => [asset.id, asset])),
    curves,
  });
