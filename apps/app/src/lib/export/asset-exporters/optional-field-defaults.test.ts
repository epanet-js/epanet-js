import type { Asset, AssetType, Pipe } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  buildExportDefaults,
  resolveExportValue,
  resolveExportProperties,
} from "./optional-field-defaults";

const anAsset = (type: string) => ({ type }) as Asset;

const aPipe = (material?: string) =>
  ({ type: "pipe" as AssetType, material }) as Pipe;

const castIron = buildExportDefaults(
  HydraulicModelBuilder.with()
    .aPipeMaterial({
      label: "Cast Iron",
      entries: [{ age: 0, roughness: 120 }],
    })
    .build(),
);

describe("optional-field-defaults", () => {
  describe("resolveExportValue", () => {
    it("substitutes the EPANET default for unmapped optional fields", () => {
      expect(resolveExportValue(anAsset("pipe"), "minorLoss", undefined)).toBe(
        0,
      );
      expect(resolveExportValue(anAsset("valve"), "minorLoss", undefined)).toBe(
        0,
      );
      expect(
        resolveExportValue(
          anAsset("junction"),
          "emitterCoefficient",
          undefined,
        ),
      ).toBe(0);
      expect(resolveExportValue(anAsset("tank"), "minVolume", undefined)).toBe(
        0,
      );
      expect(
        resolveExportValue(anAsset("tank"), "mixingFraction", undefined),
      ).toBe(1);
      expect(resolveExportValue(anAsset("pump"), "speed", undefined)).toBe(1);
    });

    it("also substitutes the default when the value is null", () => {
      expect(resolveExportValue(anAsset("pipe"), "minorLoss", null)).toBe(0);
      expect(resolveExportValue(anAsset("pump"), "speed", null)).toBe(1);
    });

    it("keeps a provided value untouched", () => {
      expect(resolveExportValue(anAsset("pipe"), "minorLoss", 5)).toBe(5);
      expect(resolveExportValue(anAsset("pump"), "speed", 2)).toBe(2);
    });

    it("leaves required nullable fields blank (no default substituted)", () => {
      expect(resolveExportValue(anAsset("pipe"), "diameter", null)).toBe(null);
      expect(resolveExportValue(anAsset("pipe"), "length", null)).toBe(null);
      expect(resolveExportValue(anAsset("pipe"), "roughness", undefined)).toBe(
        undefined,
      );
      expect(resolveExportValue(anAsset("tank"), "minLevel", null)).toBe(null);
    });

    it("leaves unknown fields and asset types untouched", () => {
      expect(resolveExportValue(anAsset("pipe"), "label", null)).toBe(null);
      expect(
        resolveExportValue(anAsset("unknown"), "minorLoss", undefined),
      ).toBe(undefined);
    });

    it("substitutes the inferred roughness when one is available", () => {
      expect(
        resolveExportValue(aPipe("Cast Iron"), "roughness", null, castIron),
      ).toBe(120);
    });

    it("leaves roughness blank when nothing can be inferred", () => {
      expect(
        resolveExportValue(aPipe("PVC"), "roughness", null, castIron),
      ).toBe(null);
      expect(resolveExportValue(aPipe("Cast Iron"), "roughness", null)).toBe(
        null,
      );
    });

    it("does not infer for another field or asset type", () => {
      expect(
        resolveExportValue(aPipe("Cast Iron"), "diameter", null, castIron),
      ).toBe(null);
      expect(
        resolveExportValue(anAsset("valve"), "roughness", null, castIron),
      ).toBe(null);
    });
  });

  describe("resolveExportProperties", () => {
    it("fills optional field defaults for undefined values", () => {
      const resolved = resolveExportProperties(anAsset("tank"), {
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
      const resolved = resolveExportProperties(anAsset("pipe"), props);

      expect(resolved).not.toBe(props);
      expect(resolved.minorLoss).toBe(0);
      expect(props.minorLoss).toBe(undefined);
    });

    it("preserves provided values", () => {
      const resolved = resolveExportProperties(anAsset("pipe"), {
        minorLoss: 3,
      });
      expect(resolved.minorLoss).toBe(3);
    });

    it("fills an empty roughness with the inferred value", () => {
      const resolved = resolveExportProperties(
        aPipe("Cast Iron"),
        { roughness: null },
        castIron,
      );

      expect(resolved.roughness).toBe(120);
    });

    it("keeps the roughness stored on the pipe", () => {
      const resolved = resolveExportProperties(
        aPipe("Cast Iron"),
        { roughness: 90 },
        castIron,
      );

      expect(resolved.roughness).toBe(90);
    });
  });
});
