import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { validateModelAttributes } from "./run-check";
import { groupIssues } from "./issues";
import { RULES } from "./rules";

describe("validateModelAttributes", () => {
  describe("pipe roughness", () => {
    it("flags a missing roughness as a present error", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { label: "P1", roughness: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([
        {
          ruleId: "pipe.roughness.present",
          entityType: "pipe",
          entityId: 1,
          label: "P1",
          field: "roughness",
          severity: "error",
          message: "required",
        },
      ]);
    });

    it("flags a zero roughness as a positive error", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { label: "P1", roughness: 0 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        ruleId: "pipe.roughness.positive",
        severity: "error",
        message: "mustBePositive",
      });
    });

    it("flags a negative roughness as a positive error", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: -5 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe("pipe.roughness.positive");
    });

    it("accepts a positive roughness", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: 130 })
        .build();

      expect(await validateModelAttributes(model)).toEqual([]);
    });

    it("reports a single issue per pipe with fail-fast (present before positive)", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { roughness: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe("pipe.roughness.present");
    });

    it("validates every pipe across the model", async () => {
      const builder = HydraulicModelBuilder.with();
      for (let id = 1; id <= 25; id++) {
        builder.aPipe(id, { roughness: null });
      }
      const model = builder.build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(25);
      expect(
        issues.every((issue) => issue.ruleId === "pipe.roughness.present"),
      ).toBe(true);
    });
  });

  describe("required attributes", () => {
    it("flags a missing reservoir head", async () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir(1, { label: "R1", head: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([
        {
          ruleId: "reservoir.head.present",
          entityType: "reservoir",
          entityId: 1,
          label: "R1",
          field: "head",
          severity: "error",
          message: "required",
        },
      ]);
    });

    it("flags a missing valve diameter", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { diameter: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe("valve.diameter.present");
    });

    it("flags a zero valve diameter as a positive error", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { diameter: 0 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0].ruleId).toBe("valve.diameter.positive");
    });

    it("flags a missing valve setting", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { kind: "tcv", setting: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues.map((i) => i.ruleId)).toContain("valve.setting.present");
    });

    it("does not require a setting for a gpv valve", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { kind: "gpv", setting: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues.map((i) => i.ruleId)).not.toContain(
        "valve.setting.present",
      );
    });

    it("requires a setting for a pcv valve", async () => {
      const model = HydraulicModelBuilder.with()
        .aValve(1, { kind: "pcv", setting: null })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues.map((i) => i.ruleId)).toContain("valve.setting.present");
    });

    it("flags a missing tank diameter unless a volume curve is set", async () => {
      const withoutCurve = HydraulicModelBuilder.with()
        .aTank(1, { diameter: null })
        .build();
      expect(
        (await validateModelAttributes(withoutCurve)).map((i) => i.ruleId),
      ).toContain("tank.diameter.present");

      const withCurve = HydraulicModelBuilder.with()
        .aTank(2, { diameter: null, volumeCurveId: 9 })
        .build();
      expect(
        (await validateModelAttributes(withCurve)).map((i) => i.ruleId),
      ).not.toContain("tank.diameter.present");
    });

    it("allows a zero tank initial level but flags a missing one", async () => {
      const zero = HydraulicModelBuilder.with()
        .aTank(1, { initialLevel: 0 })
        .build();
      expect(
        (await validateModelAttributes(zero)).map((i) => i.ruleId),
      ).not.toContain("tank.initialLevel.nonNegative");

      const missing = HydraulicModelBuilder.with()
        .aTank(2, { initialLevel: null })
        .build();
      expect(
        (await validateModelAttributes(missing)).map((i) => i.ruleId),
      ).toContain("tank.initialLevel.present");
    });

    it("flags a zero pipe length", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { length: 0, roughness: 100 })
        .build();
      expect(
        (await validateModelAttributes(model)).map((i) => i.ruleId),
      ).toContain("pipe.length.positive");
    });

    it("flags pump power only for constant-power pumps", async () => {
      const powerPump = HydraulicModelBuilder.with()
        .aJunction(2)
        .aJunction(3)
        .aPump(1, {
          startNodeId: 2,
          endNodeId: 3,
          definitionType: "power",
          power: 0,
        })
        .build();
      expect(
        (await validateModelAttributes(powerPump)).map((i) => i.ruleId),
      ).toContain("pump.power.positive");

      const curvePump = HydraulicModelBuilder.with()
        .aJunction(4)
        .aJunction(5)
        .aPump(2, {
          startNodeId: 4,
          endNodeId: 5,
          definitionType: "designPointCurve",
          power: 0,
        })
        .build();
      expect(
        (await validateModelAttributes(curvePump)).map((i) => i.ruleId),
      ).not.toContain("pump.power.positive");
    });

    it("flags tank max/min levels only when no volume curve is set", async () => {
      const diameterTank = HydraulicModelBuilder.with()
        .aTank(1, { maxLevel: 0, minLevel: -1 })
        .build();
      const ruleIds = (await validateModelAttributes(diameterTank)).map(
        (i) => i.ruleId,
      );
      expect(ruleIds).toContain("tank.maxLevel.positive");
      expect(ruleIds).toContain("tank.minLevel.nonNegative");

      const curveTank = HydraulicModelBuilder.with()
        .aTank(2, { maxLevel: 0, minLevel: -1, volumeCurveId: 9 })
        .build();
      const curveRuleIds = (await validateModelAttributes(curveTank)).map(
        (i) => i.ruleId,
      );
      expect(curveRuleIds).not.toContain("tank.maxLevel.positive");
      expect(curveRuleIds).not.toContain("tank.minLevel.nonNegative");
    });
  });

  describe("optional attribute value checks", () => {
    it("flags a negative minor loss as an error (EPANET rejects it)", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { minorLoss: -5 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        ruleId: "pipe.minorLoss.nonNegative",
        severity: "error",
      });
    });

    it("accepts a zero minor loss", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { minorLoss: 0 })
        .build();

      expect(
        (await validateModelAttributes(model)).map((i) => i.ruleId),
      ).not.toContain("pipe.minorLoss.nonNegative");
    });

    it("flags a negative emitter coefficient as a warning (EPANET runs)", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(1, { emitterCoefficient: -5 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        ruleId: "junction.emitterCoefficient.nonNegative",
        severity: "warning",
      });
    });

    it("warns on an out-of-range mixing fraction only for 2comp tanks", async () => {
      const twoComp = HydraulicModelBuilder.with()
        .aTank(1, { mixingModel: "2comp", mixingFraction: 1.5 })
        .build();
      expect(
        (await validateModelAttributes(twoComp)).map((i) => i.ruleId),
      ).toContain("tank.mixingFraction.unitRange");

      const mixed = HydraulicModelBuilder.with()
        .aTank(2, { mixingModel: "mixed", mixingFraction: 1.5 })
        .build();
      expect(
        (await validateModelAttributes(mixed)).map((i) => i.ruleId),
      ).not.toContain("tank.mixingFraction.unitRange");
    });

    it("flags a negative energy price as an error (EPANET rejects it)", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(2)
        .aJunction(3)
        .aPump(1, { startNodeId: 2, endNodeId: 3, energyPrice: -5 })
        .build();

      const issues = await validateModelAttributes(model);
      const energyPriceIssue = issues.find(
        (i) => i.ruleId === "pump.energyPrice.nonNegative",
      );
      expect(energyPriceIssue?.severity).toBe("error");
    });

    it("warns on a negative source strength only when a source is active", async () => {
      const withSource = HydraulicModelBuilder.with()
        .aJunction(1, {
          chemicalSourceType: "concen",
          chemicalSourceStrength: -5,
        })
        .build();
      const issues = await validateModelAttributes(withSource);
      const strengthIssue = issues.find(
        (i) => i.ruleId === "node.chemicalSourceStrength.nonNegative",
      );
      expect(strengthIssue?.severity).toBe("warning");

      const noSource = HydraulicModelBuilder.with()
        .aJunction(2, { chemicalSourceStrength: -5 })
        .build();
      expect(
        (await validateModelAttributes(noSource)).map((i) => i.ruleId),
      ).not.toContain("node.chemicalSourceStrength.nonNegative");
    });

    it("groups negative source strength across node types into one rule", async () => {
      const source = {
        chemicalSourceType: "concen" as const,
        chemicalSourceStrength: -5,
      };
      const model = HydraulicModelBuilder.with()
        .aJunction(1, source)
        .aReservoir(2, source)
        .aTank(3, source)
        .build();

      const groups = groupIssues(await validateModelAttributes(model));
      const strengthGroups = groups.filter(
        (g) => g.ruleId === "node.chemicalSourceStrength.nonNegative",
      );
      expect(strengthGroups).toHaveLength(1);
      expect(strengthGroups[0].issues).toHaveLength(3);
    });
  });

  it("ignores assets without rules", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aReservoir(2, { label: "R1" })
      .build();

    expect(await validateModelAttributes(model)).toEqual([]);
  });

  describe("pipe installation year", () => {
    it("flags an out-of-range year as a warning", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { label: "P1", year: 999, roughness: 100 })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([
        {
          ruleId: "pipe.year.valid",
          entityType: "pipe",
          entityId: 1,
          label: "P1",
          field: "year",
          severity: "warning",
          message: "invalidYear",
        },
      ]);
    });

    it("flags a non-integer year as a warning", async () => {
      const model = HydraulicModelBuilder.with()
        .aPipe(1, { year: 1995.5, roughness: 100 })
        .build();

      expect(
        (await validateModelAttributes(model)).map((i) => i.ruleId),
      ).toContain("pipe.year.valid");
    });

    it("accepts a valid year and an empty year", async () => {
      const withYear = HydraulicModelBuilder.with()
        .aPipe(1, { year: 1995, roughness: 100 })
        .build();
      const withoutYear = HydraulicModelBuilder.with()
        .aPipe(2, { roughness: 100 })
        .build();

      expect(
        (await validateModelAttributes(withYear)).map((i) => i.ruleId),
      ).not.toContain("pipe.year.valid");
      expect(
        (await validateModelAttributes(withoutYear)).map((i) => i.ruleId),
      ).not.toContain("pipe.year.valid");
    });
  });

  describe("customer point connection", () => {
    it("flags a disconnected customer point as a warning", async () => {
      const model = HydraulicModelBuilder.with()
        .aCustomerPoint(1, { label: "CP1" })
        .build();

      const issues = await validateModelAttributes(model);

      expect(issues).toEqual([
        {
          ruleId: "customerPoint.connected",
          entityType: "customerPoint",
          entityId: 1,
          label: "CP1",
          field: null,
          severity: "warning",
          message: "disconnected",
        },
      ]);
    });

    it("accepts a connected customer point", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction(1)
        .aJunction(2, { coordinates: [10, 0] })
        .aPipe(3, { startNodeId: 1, endNodeId: 2, roughness: 130 })
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
        .aPipe(1, { roughness: null })
        .aCustomerPoint(2, { label: "CP1" })
        .build();
      const pipeRules = RULES.filter((rule) => rule.entityType === "pipe");

      const issues = await validateModelAttributes(model, { rules: pipeRules });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        ruleId: "pipe.roughness.present",
        entityType: "pipe",
      });
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
