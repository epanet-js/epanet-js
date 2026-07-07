import {
  resolveExportValue,
  resolveExportProperties,
} from "./optional-field-defaults";

describe("optional-field-defaults", () => {
  describe("resolveExportValue", () => {
    it("substitutes the EPANET default for unmapped optional fields", () => {
      expect(resolveExportValue("pipe", "minorLoss", undefined)).toBe(0);
      expect(resolveExportValue("valve", "minorLoss", undefined)).toBe(0);
      expect(
        resolveExportValue("junction", "emitterCoefficient", undefined),
      ).toBe(0);
      expect(resolveExportValue("tank", "minVolume", undefined)).toBe(0);
      expect(resolveExportValue("tank", "mixingFraction", undefined)).toBe(1);
      expect(resolveExportValue("pump", "speed", undefined)).toBe(1);
    });

    it("also substitutes the default when the value is null", () => {
      expect(resolveExportValue("pipe", "minorLoss", null)).toBe(0);
      expect(resolveExportValue("pump", "speed", null)).toBe(1);
    });

    it("keeps a provided value untouched", () => {
      expect(resolveExportValue("pipe", "minorLoss", 5)).toBe(5);
      expect(resolveExportValue("pump", "speed", 2)).toBe(2);
    });

    it("leaves required nullable fields blank (no default substituted)", () => {
      expect(resolveExportValue("pipe", "diameter", null)).toBe(null);
      expect(resolveExportValue("pipe", "length", null)).toBe(null);
      expect(resolveExportValue("pipe", "roughness", undefined)).toBe(
        undefined,
      );
      expect(resolveExportValue("tank", "minLevel", null)).toBe(null);
    });

    it("leaves unknown fields and asset types untouched", () => {
      expect(resolveExportValue("pipe", "label", null)).toBe(null);
      expect(resolveExportValue("unknown", "minorLoss", undefined)).toBe(
        undefined,
      );
    });
  });

  describe("resolveExportProperties", () => {
    it("fills optional field defaults for undefined values", () => {
      const resolved = resolveExportProperties("tank", {
        minVolume: undefined,
        mixingFraction: undefined,
        initialQuality: undefined,
        minLevel: null,
      });

      expect(resolved.minVolume).toBe(0);
      expect(resolved.mixingFraction).toBe(1);
      expect(resolved.initialQuality).toBe(0);
      expect(resolved.minLevel).toBe(null);
    });

    it("returns a copy without mutating the input", () => {
      const props = { minorLoss: undefined as number | undefined };
      const resolved = resolveExportProperties("pipe", props);

      expect(resolved).not.toBe(props);
      expect(resolved.minorLoss).toBe(0);
      expect(props.minorLoss).toBe(undefined);
    });

    it("preserves provided values", () => {
      const resolved = resolveExportProperties("pipe", { minorLoss: 3 });
      expect(resolved.minorLoss).toBe(3);
    });
  });
});
