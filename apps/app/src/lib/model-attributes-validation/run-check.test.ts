import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { validateModelAttributes } from "./run-check";
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
  });

  it("ignores assets without rules", async () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1" })
      .aReservoir(2, { label: "R1" })
      .build();

    expect(await validateModelAttributes(model)).toEqual([]);
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
