import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { AnalysisState, nullAnalysis } from "src/analysis";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import { buildOptimizedAssetsSource } from "./data-source";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetsMap } from "src/hydraulic-model";
import { presets } from "src/model-metadata/quantities-spec";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("build optimized source", () => {
  it("preserves core properties", () => {
    const analysis = nullAnalysis;
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
      analysis,
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

  describe("when nodes analysis enabled", () => {
    const analysis: AnalysisState = {
      ...nullAnalysis,
      nodes: {
        type: "pressures",
        rangeColorMapping: RangeColorMapping.build({
          steps: [0, 10, 20, 30],
          property: "pressure",
          unit: "m",
          paletteName: "epanet-ramp",
        }),
      },
    };

    it("includes props for styling to junctions", () => {
      stubFeatureOn("FLAG_MAPBOX_JUNCTIONS");
      const { assets } = HydraulicModelBuilder.with()
        .aJunction("J1", { elevation: 15, simulation: { pressure: 10 } })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        analysis,
      );

      const [junction] = features;
      expect(junction.properties).toEqual({
        type: "junction",
        color: "#68b982",
      });
    });
  });

  describe("when links analysis enabled", () => {
    const analysis: AnalysisState = {
      ...nullAnalysis,
      links: {
        type: "flows",
        rangeColorMapping: RangeColorMapping.build({
          steps: [0, 10, 20, 30],
          property: "flow",
          unit: "l/s",
          paletteName: "epanet-ramp",
          absoluteValues: true,
        }),
      },
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
        analysis,
      );

      const [pipe] = features;
      expect(pipe.properties).toEqual({
        type: "pipe",
        status: "open",
        length: 14,
        hasArrow: true,
        rotation: 0,
        color: "#68b982",
      });
    });

    it("reverses arrow when value is negative", () => {
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("ID", {
          simulation: { flow: -10 },
        })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        analysis,
      );

      const [pipe] = features;
      expect(pipe.properties).toMatchObject({
        rotation: -180,
        color: "#68b982",
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
        analysis,
      );

      const [p1, p2] = features;
      expect(p1.properties).toMatchObject({
        color: "#004e64",
        hasArrow: true,
      });
      expect(p2.properties).toMatchObject({
        color: "#004e64",
        hasArrow: false,
      });
    });

    it("assigns lengths in meters", () => {
      const { assets } = HydraulicModelBuilder.with(presets.usCustomary)
        .aPipe("p1", { length: 10 })
        .build();

      const features = buildOptimizedAssetsSource(
        assets,
        initIDMap(assets),
        analysis,
      );

      const [p1] = features;
      expect(p1.properties).toMatchObject({ length: 3.048 });
    });
  });

  const initIDMap = (assets: AssetsMap): IDMap => {
    return UIDMap.loadIdsFromPersistence([...assets.values()]);
  };
});
