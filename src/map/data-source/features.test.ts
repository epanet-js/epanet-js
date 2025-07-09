import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SymbologySpec, nullSymbologySpec } from "src/map/symbology";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { buildOptimizedAssetsSource } from "./features";
import { AssetsMap } from "src/hydraulic-model";
import { Quantities, presets } from "src/model-metadata/quantities-spec";
import {
  aLinkSymbology,
  aNodeSymbology,
  aRangeColorRule,
} from "src/__helpers__/state";
import { getColors } from "src/map/symbology/range-color-rule";

describe("build optimized source", () => {
  const defaultQuantities = new Quantities(presets.LPS);
  const fakeTranslateUnit = vi.fn();
  it("preserves core properties", () => {
    const symbology = nullSymbologySpec;
    const { assets } = HydraulicModelBuilder.with()
      .aPipe("ID", {
        diameter: 300,
        status: "open",
      })
      .aJunction("J1", { elevation: 15 })
      .build();

    const features = buildOptimizedAssetsSource(
      assets,
      initIDMap(assets),
      symbology,
      defaultQuantities,
      fakeTranslateUnit,
    );

    expect(features).toHaveLength(2);
    const [pipe, junction] = features;
    expect(pipe.properties).toEqual({ type: "pipe", status: "open" });
    expect(pipe.properties).toEqual({ type: "pipe", status: "open" });
    expect(pipe.geometry!.type).toEqual("LineString");

    expect(junction.properties).toEqual({ type: "junction" });
    expect(junction.geometry!.type).toEqual("Point");

    expect(pipe.id).not.toEqual(junction.id);
  });

  it("uses pump status when available", () => {
    const symbology = nullSymbologySpec;
    const { assets } = HydraulicModelBuilder.with()
      .aPump("pu1", { initialStatus: "off", simulation: { status: "on" } })
      .aPump("pu2", { initialStatus: "off" })
      .build();

    const features = buildOptimizedAssetsSource(
      assets,
      initIDMap(assets),
      symbology,
      defaultQuantities,
      fakeTranslateUnit,
    );

    expect(features).toHaveLength(2);
    const [pu1, pu2] = features;
    expect(pu1.properties!.status).toEqual("on");
    expect(pu2.properties!.status).toEqual("off");
  });

  describe("node symbology", () => {
    it("includes props for styling to junctions", () => {
      const symbology: SymbologySpec = {
        ...nullSymbologySpec,
        node: aNodeSymbology({
          colorRule: aRangeColorRule({
            breaks: [10, 20, 30],
            property: "pressure",
            unit: "m",
            colors: getColors("Temps", 4),
          }),
        }),
      };
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { elevation: 15, simulation: { pressure: 10 } })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        fakeTranslateUnit,
      );

      const [junction] = features;
      expect(junction.properties!.type).toEqual("junction");
      expect(junction.properties!.color).not.toBeUndefined();
      expect(junction.properties!.strokeColor).not.toBeUndefined();
    });

    it("includes labels when specified", () => {
      const symbology: SymbologySpec = {
        ...nullSymbologySpec,
        node: aNodeSymbology({
          labelRule: "pressure",
        }),
      };
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { elevation: 15, simulation: { pressure: 10 } })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        () => "m",
      );

      const [junction] = features;
      expect(junction.properties!.label).toEqual("10 m");
    });
  });

  describe("link symbology", () => {
    const symbology: SymbologySpec = {
      ...nullSymbologySpec,
      link: aLinkSymbology({
        colorRule: aRangeColorRule({
          breaks: [10, 20, 30],
          property: "flow",
          colors: getColors("Temps", 4),
          absValues: true,
        }),
      }),
    };

    it("includes props for styling to pipes", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("ID", {
          diameter: 300,
          status: "open",
          length: 14,
          simulation: { flow: 10 },
        })
        .aJunction("J1", { elevation: 15 })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        fakeTranslateUnit,
      );

      const [pipe] = features;
      expect(pipe.properties).toEqual(
        expect.objectContaining({
          type: "pipe",
          status: "open",
          length: 14,
          hasArrow: true,
          rotation: 0,
        }),
      );
    });

    it("includes labels to pipes", () => {
      const symbology: SymbologySpec = {
        ...nullSymbologySpec,
        link: aLinkSymbology({
          labelRule: "flow",
        }),
      };

      const { assets } = HydraulicModelBuilder.with()
        .aPipe("ID", {
          diameter: 300,
          status: "open",
          length: 14,
          simulation: { flow: -10 },
        })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        () => "l/s",
      );

      const [pipe] = features;
      expect(pipe.properties).toMatchObject({
        label: "-10 l/s",
      });
    });

    it("reverses arrow when value is negative", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("ID", {
          simulation: { flow: 10 },
        })
        .aPipe("ID-REVERSE", {
          simulation: { flow: -10 },
        })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        fakeTranslateUnit,
      );

      const [pipe, reversed] = features;
      expect(pipe.properties).toMatchObject({
        rotation: 0,
      });
      expect(reversed.properties).toMatchObject({
        rotation: -180,
      });
      expect(pipe.properties!.color).toEqual(reversed.properties!.color);
    });

    it("applies the direction based on the flow", () => {
      const symbology: SymbologySpec = {
        ...nullSymbologySpec,
        link: aLinkSymbology({
          colorRule: aRangeColorRule({
            breaks: [10, 20, 30],
            property: "velocity",
            colors: getColors("Temps", 4),
            absValues: true,
          }),
        }),
      };
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("ID", {
          simulation: { flow: -10, velocity: 20 },
        })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        fakeTranslateUnit,
      );

      const [pipe] = features;
      expect(pipe.properties).toMatchObject({
        rotation: -180,
      });
    });

    it("assigns same value to 0 and missing results", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1", {
          simulation: { flow: 0 },
        })
        .aPipe("p2", {})
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        fakeTranslateUnit,
      );

      const [p1, p2] = features;
      expect(p1.properties).toMatchObject({
        color: expect.stringMatching("#"),
        hasArrow: true,
      });
      expect(p2.properties).toMatchObject({
        color: expect.stringMatching("#"),
        hasArrow: false,
      });
      expect(p1.properties!.color).toEqual(p2.properties!.color);
    });

    it("assigns lengths in meters", () => {
      const { assets } = HydraulicModelBuilder.with(presets.GPM)
        .aPipe("p1", { length: 10 })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        symbology,
        defaultQuantities,
        fakeTranslateUnit,
      );

      const [p1] = features;
      expect(p1.properties).toMatchObject({ length: 3.048 });
    });
  });
});

const initIDMap = (assets: AssetsMap): IDMap => {
  return UIDMap.loadIdsFromPersistence([...assets.values()]);
};
