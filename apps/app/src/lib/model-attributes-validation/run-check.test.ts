import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { countValidationIssues, validateModelAttributes } from "./run-check";
import { RULES_BY_ID } from "./repository";
import { RULES } from "./rules";
import { ValidationIssues } from "./types";

const ruleIdsOf = (issues: ValidationIssues) =>
  issues.map(([ruleId]) => ruleId);

const entityIdsOf = (issues: ValidationIssues, ruleId: string) =>
  issues.find(([id]) => id === ruleId)?.[1];

const severityOf = (ruleId: string) => RULES_BY_ID.get(ruleId)?.severity;

describe("validateModelAttributes", () => {
  describe("pipe roughness", () => {
    it("flags a missing roughness as a present error", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { label: "P1", roughness: null, diameter: 100, length: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([["pipe.roughness.present", [1]]]);
    });

    it("flags a zero roughness as a positive error", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { label: "P1", roughness: 0, diameter: 100, length: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).toEqual(["pipe.roughness.positive"]);
    });

    it("flags a negative roughness as a positive error", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: -5, diameter: 100, length: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(ruleIdsOf(issues)).toEqual(["pipe.roughness.positive"]);
    });

    it("accepts a positive roughness", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: 130, diameter: 100, length: 100 })
        .build();

      expect(await validateModelAttributes(model)).toEqual([]);
    });

    it("reports a single issue per pipe with fail-fast (present before positive)", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: null, diameter: 100, length: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(ruleIdsOf(issues)).toEqual(["pipe.roughness.present"]);
    });

    it("validates every pipe across the model", async () => {
      const builder = HydraulicModelBuilder.with();
      for (let id = 1; id <= 25; id++) {
        builder.aPipe(id, { roughness: null, diameter: 100, length: 100 });
      }
      const model = builder.build();

      const issues = await validateModelAttributes(model);

      expect(countValidationIssues(issues)).toBe(25);
      expect(ruleIdsOf(issues)).toEqual(["pipe.roughness.present"]);
    });
  });

  describe("required attributes", () => {
    it("flags a missing reservoir head", async () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir(1, { label: "R1", head: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([["reservoir.head.present", [1]]]);
    });

    it("flags a missing junction elevation", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1", elevation: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([["node.elevation.present", [1]]]);
    });

    it("flags a missing tank elevation", async () => {
      const model = HydraulicModelBuilder.with()
        .aTank(1, {
          elevation: null,
          initialLevel: 5,
          diameter: 100,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).toContain("node.elevation.present");
    });

    it("does not require an elevation on a reservoir (it uses head)", async () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir(1, { head: 100, elevation: null })
        .build();

      expect(await validateModelAttributes(model)).toEqual([]);
    });

    it("flags a missing valve diameter", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { diameter: null, setting: 10 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(ruleIdsOf(issues)).toEqual(["valve.diameter.present"]);
    });

    it("flags a zero valve diameter as a positive error", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { diameter: 0, setting: 10 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(ruleIdsOf(issues)).toEqual(["valve.diameter.positive"]);
    });

    it("flags a missing valve setting", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { kind: "tcv", setting: null, diameter: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).toContain("valve.setting.present");
    });

    it("does not require a setting for a gpv valve", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { kind: "gpv", setting: null, diameter: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).not.toContain("valve.setting.present");
    });

    it("requires a setting for a pcv valve", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { kind: "pcv", setting: null, diameter: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).toContain("valve.setting.present");
    });

    it("flags a missing tank diameter unless a volume curve is set", async () => {
      const withoutCurve = HydraulicModelBuilder.with()
        .aTank(1, {
          diameter: null,
          elevation: 50,
          initialLevel: 5,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(withoutCurve))).toContain(
        "tank.diameter.present",
      );

      const withCurve = HydraulicModelBuilder.with()
        .aTank(2, {
          diameter: null,
          volumeCurveId: 9,
          elevation: 50,
          initialLevel: 5,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(withCurve))).not.toContain(
        "tank.diameter.present",
      );
    });

    it("allows a zero tank initial level but flags a missing one", async () => {
      const zero = HydraulicModelBuilder.with()
        .aTank(1, {
          initialLevel: 0,
          elevation: 50,
          diameter: 100,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(zero))).not.toContain(
        "tank.initialLevel.nonNegative",
      );

      const missing = HydraulicModelBuilder.with()
        .aTank(2, {
          initialLevel: null,
          elevation: 50,
          diameter: 100,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(missing))).toContain(
        "tank.initialLevel.present",
      );
    });

    it("flags a zero pipe length", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { length: 0, roughness: 100, diameter: 100 })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(model))).toContain(
        "pipe.length.positive",
      );
    });

    it("flags pump power only for constant-power pumps", async () => {
      const powerPump = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "power",
          power: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(powerPump))).toContain(
        "pump.power.positive",
      );

      const curvePump = HydraulicModelBuilder.with()
        .aJunction(4, { elevation: 50 })
        .aJunction(5, { elevation: 50 })
        .aPump(2, {
          startNodeId: 4,
          endNodeId: 5,
          definitionType: "designPointCurve",
          power: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(curvePump))).not.toContain(
        "pump.power.positive",
      );
    });

    it("flags a missing power as a present error", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "power",
        })
        .build();
      // The standard factory fills a default power; clear it to model an
      // unmapped/empty power (as the null-values import factory produces).
      model.assets.get(1)!.setProperty("power", undefined);
      expect(ruleIdsOf(await validateModelAttributes(model))).toContain(
        "pump.power.present",
      );
    });

    it("flags a curve-based pump that has no curve", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "designPointCurve",
          curve: [],
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(model))).toContain(
        "pump.curve.present",
      );
    });

    it("flags a curve-based pump with an invalid curve", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "designPointCurve",
          curve: [{ x: 0, y: 100 }],
        })
        .build();
      const ruleIds = ruleIdsOf(await validateModelAttributes(model));
      expect(ruleIds).toContain("pump.curve.valid");
      expect(ruleIds).not.toContain("pump.curve.present");
    });

    it("flags a named-curve pump that has no curveId", async () => {
      const missing = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "curveId",
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(missing))).toContain(
        "pump.curveId.present",
      );

      const withCurveId = HydraulicModelBuilder.with()
        .aJunction(4, { elevation: 50 })
        .aJunction(5, { elevation: 50 })
        .aPumpCurve({
          id: 9,
          points: [
            { x: 0, y: 200 },
            { x: 1, y: 100 },
          ],
        })
        .aPump(1, {
          startNodeId: 4,
          endNodeId: 5,
          definitionType: "curveId",
          curveId: 9,
        })
        .build();
      const withCurveIdRuleIds = ruleIdsOf(
        await validateModelAttributes(withCurveId),
      );
      expect(withCurveIdRuleIds).not.toContain("pump.curveId.present");
      expect(withCurveIdRuleIds).not.toContain("pump.curveId.valid");
    });

    it("flags a named-curve pump whose curveId does not resolve to a curve", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "curveId",
          curveId: 9,
        })
        .build();
      const ruleIds = ruleIdsOf(await validateModelAttributes(model));
      expect(ruleIds).toContain("pump.curveId.valid");
      expect(ruleIds).not.toContain("pump.curveId.present");
    });

    it("flags a named-curve pump whose resolved curve is not monotonic", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPumpCurve({
          id: 9,
          points: [
            { x: 0, y: 100 },
            { x: 1, y: 200 },
          ],
        })
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "curveId",
          curveId: 9,
        })
        .build();
      const ruleIds = ruleIdsOf(await validateModelAttributes(model));
      expect(ruleIds).toContain("pump.curveId.valid");
      expect(ruleIds).not.toContain("pump.curveId.present");
    });

    it("flags tank max/min levels only when no volume curve is set", async () => {
      const diameterTank = HydraulicModelBuilder.with()
        .aTank(1, {
          maxLevel: 0,
          minLevel: -1,
          elevation: 50,
          initialLevel: 5,
          diameter: 100,
        })
        .build();
      const ruleIds = ruleIdsOf(await validateModelAttributes(diameterTank));
      expect(ruleIds).toContain("tank.maxLevel.positive");
      expect(ruleIds).toContain("tank.minLevel.nonNegative");

      const curveTank = HydraulicModelBuilder.with()
        .aTank(2, {
          maxLevel: 0,
          minLevel: -1,
          volumeCurveId: 9,
          elevation: 50,
          initialLevel: 5,
        })
        .build();
      const curveRuleIds = ruleIdsOf(await validateModelAttributes(curveTank));
      expect(curveRuleIds).not.toContain("tank.maxLevel.positive");
      expect(curveRuleIds).not.toContain("tank.minLevel.nonNegative");
    });

    it("flags a missing (null) min or max level as a present error", async () => {
      const model = HydraulicModelBuilder.with()
        .aTank(1, {
          minLevel: null,
          maxLevel: null,
          elevation: 50,
          initialLevel: 5,
          diameter: 100,
        })
        .build();
      const ruleIds = ruleIdsOf(await validateModelAttributes(model));
      expect(ruleIds).toContain("tank.minLevel.present");
      expect(ruleIds).toContain("tank.maxLevel.present");
    });

    it("flags an initial level outside the min/max range as an error", async () => {
      const aboveMax = HydraulicModelBuilder.with()
        .aTank(1, {
          minLevel: 0,
          maxLevel: 10,
          initialLevel: 15,
          elevation: 50,
          diameter: 100,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(aboveMax))).toContain(
        "tank.initialLevel.withinLevelRange",
      );

      const belowMin = HydraulicModelBuilder.with()
        .aTank(2, {
          minLevel: 5,
          maxLevel: 10,
          initialLevel: 2,
          elevation: 50,
          diameter: 100,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(belowMin))).toContain(
        "tank.initialLevel.withinLevelRange",
      );
    });

    it("allows an initial level at the range boundaries", async () => {
      const model = HydraulicModelBuilder.with()
        .aTank(1, {
          minLevel: 0,
          maxLevel: 10,
          initialLevel: 10,
          elevation: 50,
          diameter: 100,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(model))).not.toContain(
        "tank.initialLevel.withinLevelRange",
      );
    });

    it("does not flag the level range for curve-based tanks", async () => {
      const model = HydraulicModelBuilder.with()
        .aTank(1, {
          minLevel: 0,
          maxLevel: 10,
          initialLevel: 15,
          volumeCurveId: 9,
          elevation: 50,
        })
        .build();
      const ruleIds = ruleIdsOf(await validateModelAttributes(model));
      expect(ruleIds).not.toContain("tank.initialLevel.withinLevelRange");
    });

    it("warns about a zero-storage tank (minLevel == maxLevel)", async () => {
      const model = HydraulicModelBuilder.with()
        .aTank(1, {
          minLevel: 10,
          maxLevel: 10,
          initialLevel: 10,
          elevation: 50,
          diameter: 100,
        })
        .build();
      const issues = await validateModelAttributes(model);
      const aboveMin = ruleIdsOf(issues).includes(
        "tank.maxLevel.aboveMinLevel",
      );
      expect(aboveMin).toBe(true);
      expect(severityOf("tank.maxLevel.aboveMinLevel")).toEqual("warning");
    });
  });

  describe("optional attribute value checks", () => {
    it("flags a negative minor loss as an error (EPANET rejects it)", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, {
          minorLoss: -5,
          diameter: 100,
          length: 100,
          roughness: 100,
        })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).toEqual(["pipe.minorLoss.nonNegative"]);
    });

    it("accepts a zero minor loss", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { minorLoss: 0, diameter: 100, length: 100, roughness: 100 })
        .build();

      expect(ruleIdsOf(await validateModelAttributes(model))).not.toContain(
        "pipe.minorLoss.nonNegative",
      );
    });

    it("flags a negative emitter coefficient as a warning (EPANET runs)", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(1, { emitterCoefficient: -5, elevation: 50 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(ruleIdsOf(issues)).toEqual([
        "junction.emitterCoefficient.nonNegative",
      ]);
    });

    it("warns on an out-of-range mixing fraction only for 2comp tanks", async () => {
      const twoComp = HydraulicModelBuilder.with()
        .aTank(1, {
          mixingModel: "2comp",
          mixingFraction: 1.5,
          elevation: 50,
          initialLevel: 5,
          diameter: 100,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(twoComp))).toContain(
        "tank.mixingFraction.unitRange",
      );

      const mixed = HydraulicModelBuilder.with()
        .aTank(2, {
          mixingModel: "mixed",
          mixingFraction: 1.5,
          elevation: 50,
          initialLevel: 5,
          diameter: 100,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(mixed))).not.toContain(
        "tank.mixingFraction.unitRange",
      );
    });

    it("flags a negative energy price as an error (EPANET rejects it)", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2, { elevation: 50 })
        .aJunction(3, { elevation: 50 })
        .aPump(1, { startNodeId: 2, endNodeId: 3, energyPrice: -5 })
        .build();

      const issues = await validateModelAttributes(model);
      const energyPriceIssue = ruleIdsOf(issues).includes(
        "pump.energyPrice.nonNegative",
      );
      expect(energyPriceIssue).toBe(true);
      expect(severityOf("pump.energyPrice.nonNegative")).toBe("error");
    });

    it("warns on a negative source strength only when a source is active", async () => {
      const withSource = HydraulicModelBuilder.with()
        .aJunction(1, {
          chemicalSourceType: "concen",
          chemicalSourceStrength: -5,
          elevation: 50,
        })
        .build();
      const issues = await validateModelAttributes(withSource);
      const strengthIssue = ruleIdsOf(issues).includes(
        "node.chemicalSourceStrength.nonNegative",
      );
      expect(strengthIssue).toBe(true);
      expect(severityOf("node.chemicalSourceStrength.nonNegative")).toBe(
        "warning",
      );

      const noSource = HydraulicModelBuilder.with()
        .aJunction(2, { chemicalSourceStrength: -5, elevation: 50 })
        .build();
      expect(ruleIdsOf(await validateModelAttributes(noSource))).not.toContain(
        "node.chemicalSourceStrength.nonNegative",
      );
    });

    it("groups negative source strength across node types into one rule", async () => {
      const source = {
        chemicalSourceType: "concen" as const,
        chemicalSourceStrength: -5,
      };
      const model = HydraulicModelBuilder.with()
        .aJunction(1, { ...source, elevation: 50 })
        .aReservoir(2, { ...source, head: 100 })
        .aTank(3, {
          ...source,
          elevation: 50,
          initialLevel: 5,
          diameter: 100,
          maxLevel: 10,
          minLevel: 0,
        })
        .build();

      const issues = await validateModelAttributes(model);

      expect(
        entityIdsOf(issues, "node.chemicalSourceStrength.nonNegative"),
      ).toHaveLength(3);
    });
  });

  it("ignores assets without rules", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 50 })
      .aReservoir(2, { label: "R1", head: 100 })
      .build();

    expect(await validateModelAttributes(model)).toEqual([]);
  });

  describe("pipe installation year", () => {
    it("flags an out-of-range year as a warning", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, {
          label: "P1",
          year: 999,
          roughness: 100,
          diameter: 100,
          length: 100,
        })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([["pipe.year.valid", [1]]]);
    });

    it("flags a non-integer year as a warning", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { year: 1995.5, roughness: 100, diameter: 100, length: 100 })
        .build();

      expect(ruleIdsOf(await validateModelAttributes(model))).toContain(
        "pipe.year.valid",
      );
    });

    it("accepts a valid year and an empty year", async () => {
      const withYear = HydraulicModelBuilder.with()
        .aPipe(1, { year: 1995, roughness: 100, diameter: 100, length: 100 })
        .build();
      const withoutYear = HydraulicModelBuilder.with()
        .aPipe(2, { roughness: 100, diameter: 100, length: 100 })
        .build();

      expect(ruleIdsOf(await validateModelAttributes(withYear))).not.toContain(
        "pipe.year.valid",
      );
      expect(
        ruleIdsOf(await validateModelAttributes(withoutYear)),
      ).not.toContain("pipe.year.valid");
    });
  });

  describe("customer point connection", () => {
    it("flags a disconnected customer point as a warning", async () => {
      const model = HydraulicModelBuilder.with()
        .aCustomerPoint(1, { label: "CP1" })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([["customerPoint.connected", [1]]]);
    });

    it("accepts a connected customer point", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(1, { elevation: 50 })
        .aJunction(2, { coordinates: [10, 0], elevation: 50 })
        .aPipe(3, {
          startNodeId: 1,
          endNodeId: 2,
          roughness: 130,
          diameter: 100,
          length: 100,
        })
        .aCustomerPoint(4, {
          label: "CP1",
          connection: { pipeId: 3, junctionId: 1 },
        })
        .build();

      expect(await validateModelAttributes(model)).toEqual([]);
    });
  });

  describe("rules subset", () => {
    it("runs only the rules provided", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: null, diameter: 100, length: 100 })
        .aCustomerPoint(2, { label: "CP1" })
        .build();
      const pipeRules = RULES.filter((rule) => rule.entityType === "pipe");

      const issues = await validateModelAttributes(model, { rules: pipeRules });

      expect(ruleIdsOf(issues)).toEqual(["pipe.roughness.present"]);
    });
  });

  describe("cancellation", () => {
    it("rejects when the signal is already aborted", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: null })
        .build();
      const controller = new AbortController();
      controller.abort();

      await expect(
        validateModelAttributes(model, { signal: controller.signal }),
      ).rejects.toMatchObject({ name: "AbortError" });
    });
  });
});

describe("validateModelAttributes with inferred roughness", () => {
  const modelWith = ({
    material,
    roughness = null,
    year,
    library = ["Cast Iron"],
  }: {
    material?: string;
    roughness?: number | null;
    year?: number;
    library?: string[];
  }) => {
    const builder = HydraulicModelBuilder.with().aPipe(1, {
      label: "P1",
      material,
      roughness,
      year,
      diameter: 100,
      length: 100,
    });
    library.forEach((label) =>
      builder.aPipeMaterial({ label, entries: [{ age: 0, roughness: 120 }] }),
    );
    return builder.build();
  };

  const ruleIds = async (model: ReturnType<typeof modelWith>) =>
    ruleIdsOf(await validateModelAttributes(model, { rules: RULES }));

  describe("required roughness", () => {
    it("accepts a pipe whose roughness comes from the library", async () => {
      expect(await ruleIds(modelWith({ material: "Cast Iron" }))).toEqual([]);
    });

    it("still requires a roughness that cannot be inferred", async () => {
      expect(await ruleIds(modelWith({ material: "PVC" }))).toContain(
        "pipe.roughness.present",
      );
    });

    it("still requires a roughness for a pipe without a material", async () => {
      expect(await ruleIds(modelWith({}))).toContain("pipe.roughness.present");
    });

    it("still rejects an explicit non-positive roughness", async () => {
      expect(
        await ruleIds(modelWith({ material: "Cast Iron", roughness: -5 })),
      ).toEqual(["pipe.roughness.positive"]);
    });

    it("rejects an inferred non-positive roughness", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, {
          label: "P1",
          material: "Cast Iron",
          roughness: null,
          diameter: 100,
          length: 100,
        })
        .aPipeMaterial({
          label: "Cast Iron",
          entries: [{ age: 0, roughness: -5 }],
        })
        .build();

      expect(await ruleIds(model)).toEqual(["pipe.roughness.positive"]);
    });
  });

  describe("material in the library", () => {
    const materialIssues = async (model: ReturnType<typeof modelWith>) =>
      ruleIdsOf(await validateModelAttributes(model, { rules: RULES })).filter(
        (ruleId) => ruleId.startsWith("pipe.material."),
      );

    it("warns when the material has no library entry", async () => {
      expect(await materialIssues(modelWith({ material: "PVC" }))).toEqual([
        "pipe.material.inLibrary",
      ]);
    });

    it("accepts a material that differs from its library entry by case", async () => {
      expect(
        await materialIssues(modelWith({ material: "cast iron" })),
      ).toEqual([]);
    });

    it("stays quiet when the pipe has a roughness of its own", async () => {
      expect(
        await materialIssues(modelWith({ material: "PVC", roughness: 130 })),
      ).toEqual([]);
    });

    it("stays quiet when the library is empty", async () => {
      expect(
        await materialIssues(modelWith({ material: "PVC", library: [] })),
      ).toEqual([]);
    });

    it("stays quiet for a pipe without a material", async () => {
      expect(await materialIssues(modelWith({}))).toEqual([]);
    });

    describe("a known material that yields no roughness", () => {
      const aged = (label: string) =>
        HydraulicModelBuilder.with().aPipeMaterial({
          label,
          entries: [
            { age: 0, roughness: 120 },
            { age: 20, roughness: 90 },
          ],
        });

      const modelWithAgedMaterial = (year?: number) =>
        aged("Cast Iron")
          .aPipe(1, {
            label: "P1",
            material: "Cast Iron",
            roughness: null,
            year,
            diameter: 100,
            length: 100,
          })
          .build();

      it("warns when the pipe has no installation year", async () => {
        const issues = await materialIssues(modelWithAgedMaterial());

        expect(issues).toEqual(["pipe.material.providesRoughness"]);
        expect(severityOf("pipe.material.providesRoughness")).toBe("warning");
      });

      it("stays quiet once the pipe has a year", async () => {
        expect(await materialIssues(modelWithAgedMaterial(2000))).toEqual([]);
      });

      it("warns when the material has no usable entries", async () => {
        const model = HydraulicModelBuilder.with()
          .aPipeMaterial({
            label: "Cast Iron",
            entries: [{ age: null, roughness: null }],
          })
          .aPipe(1, {
            label: "P1",
            material: "Cast Iron",
            roughness: null,
            diameter: 100,
            length: 100,
          })
          .build();

        expect(await materialIssues(model)).toEqual([
          "pipe.material.providesRoughness",
        ]);
      });

      it("reports only the unknown-material warning when both could apply", async () => {
        const model = aged("Cast Iron")
          .aPipe(1, {
            label: "P1",
            material: "PVC",
            roughness: null,
            diameter: 100,
            length: 100,
          })
          .build();

        expect(await materialIssues(model)).toEqual([
          "pipe.material.inLibrary",
        ]);
      });
    });
  });

  describe("inactive assets", () => {
    it("does not flag a disabled pipe with a missing roughness", async () => {
      const IDS = { P1: 1 } as const;
      const model = HydraulicModelBuilder.with()
        .aPipe(IDS.P1, {
          roughness: null,
          diameter: 100,
          length: 100,
          isActive: false,
        })
        .build();

      expect(await validateModelAttributes(model)).toEqual([]);
    });

    it("flags only the active one of two invalid pipes", async () => {
      const IDS = { P1: 1, P2: 2 } as const;
      const model = HydraulicModelBuilder.with()
        .aPipe(IDS.P1, { roughness: null, diameter: 100, length: 100 })
        .aPipe(IDS.P2, {
          roughness: null,
          diameter: 100,
          length: 100,
          isActive: false,
        })
        .build();

      const issues = await validateModelAttributes(model);

      expect(entityIdsOf(issues, "pipe.roughness.present")).toEqual([IDS.P1]);
    });

    it("does not flag a disabled junction with a missing elevation", async () => {
      const IDS = { J1: 1 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: null, isActive: false })
        .build();

      expect(await validateModelAttributes(model)).toEqual([]);
    });
  });
});
