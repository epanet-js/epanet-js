import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { isCurveInUse, isPatternInUse } from "./library-usage";

describe("isCurveInUse", () => {
  const IDS = { CURVE: 10, OTHER_CURVE: 11, J1: 1, J2: 2, LINK: 3, T1: 4 };
  const points = [{ x: 0, y: 0 }];

  it("detects a tank volume curve", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCurve({ id: IDS.CURVE, type: "volume", points })
      .aTank(IDS.T1, { volumeCurveId: IDS.CURVE })
      .build();

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(true);
  });

  it("detects a valve curve", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCurve({ id: IDS.CURVE, type: "headloss", points })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aValve(IDS.LINK, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        kind: "gpv",
        curveId: IDS.CURVE,
      })
      .build();

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(true);
  });

  it("detects a pump efficiency curve", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCurve({ id: IDS.CURVE, type: "efficiency", points })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPump(IDS.LINK, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        efficiencyCurveId: IDS.CURVE,
      })
      .build();

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(true);
  });

  it("ignores curves nothing references", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aCurve({ id: IDS.CURVE, type: "volume", points })
      .aCurve({ id: IDS.OTHER_CURVE, type: "volume", points })
      .aTank(IDS.T1, { volumeCurveId: IDS.OTHER_CURVE })
      .build();

    expect(isCurveInUse(hydraulicModel, IDS.CURVE)).toBe(false);
  });
});

describe("isPatternInUse", () => {
  const IDS = { PATTERN: 10, OTHER_PATTERN: 11, J1: 1, CP1: 2, CP2: 3 };

  it("detects a junction demand pattern when customer points have demands", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aDemandPattern(IDS.PATTERN, "PAT1", [1])
      .aDemandPattern(IDS.OTHER_PATTERN, "PAT2", [1])
      .aJunction(IDS.J1)
      .aJunctionDemand(IDS.J1, [{ baseDemand: 1, patternId: IDS.PATTERN }])
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [
        { baseDemand: 1, patternId: IDS.OTHER_PATTERN },
      ])
      .build();

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("checks every customer point, not just the first", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aDemandPattern(IDS.PATTERN, "PAT1", [1])
      .aCustomerPoint(IDS.CP1)
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 1 }])
      .aCustomerPoint(IDS.CP2)
      .aCustomerPointDemand(IDS.CP2, [
        { baseDemand: 1, patternId: IDS.PATTERN },
      ])
      .build();

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("detects a quality source pattern", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPattern(IDS.PATTERN, "PAT1", [1], "qualitySourceStrength")
      .aJunction(IDS.J1, { chemicalSourcePatternId: IDS.PATTERN })
      .build();

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("detects an uncategorized pattern", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPattern(IDS.PATTERN, "PAT1", [1])
      .aJunction(IDS.J1)
      .aJunctionDemand(IDS.J1, [{ baseDemand: 1, patternId: IDS.PATTERN }])
      .build();

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN)).toBe(true);
  });

  it("detects the global energy price pattern", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPattern(IDS.PATTERN, "PAT1", [1], "energyPrice")
      .build();

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN, IDS.PATTERN)).toBe(true);
  });

  it("ignores patterns nothing references", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aDemandPattern(IDS.PATTERN, "PAT1", [1])
      .aDemandPattern(IDS.OTHER_PATTERN, "PAT2", [1])
      .aJunction(IDS.J1)
      .aJunctionDemand(IDS.J1, [
        { baseDemand: 1, patternId: IDS.OTHER_PATTERN },
      ])
      .build();

    expect(isPatternInUse(hydraulicModel, IDS.PATTERN, null)).toBe(false);
  });
});
