import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { changeCurves } from "./change-curves";

const IDS = { T1: 1, C1: 10, C2: 11 } as const;

const volumePoints = [
  { x: 0, y: 0 },
  { x: 10, y: 100 },
];

const aModelWithATankCurve = () =>
  HydraulicModelBuilder.with()
    .aCurve({
      id: IDS.C1,
      label: "TANK-VOL",
      type: "volume",
      points: volumePoints,
    })
    .aCurve({
      id: IDS.C2,
      label: "SPARE",
      type: "volume",
      points: volumePoints,
    })
    .aTank(IDS.T1, { volumeCurveId: IDS.C1 })
    .build();

describe("changeCurves", () => {
  it("removes a curve no asset uses", () => {
    const model = aModelWithATankCurve();
    const curves = new Map(model.curves);
    curves.delete(IDS.C2);

    expect(() => changeCurves(model, { curves })).not.toThrow();
  });

  it("refuses to remove a curve an asset uses", () => {
    const model = aModelWithATankCurve();
    const curves = new Map(model.curves);
    curves.delete(IDS.C1);

    expect(() => changeCurves(model, { curves })).toThrow(
      "Cannot remove curve TANK-VOL; it is in use",
    );
  });
});
