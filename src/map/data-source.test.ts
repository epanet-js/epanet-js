import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { AnalysisState, nullAnalysis } from "src/analysis";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import {
  buildIconPointsSource,
  buildOptimizedAssetsSource,
} from "./data-source";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { presets } from "src/model-metadata/quantities-spec";
import { Point } from "geojson";

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

  it("uses pump status when available", () => {
    const analysis = nullAnalysis;
    const { assets } = HydraulicModelBuilder.with()
      .aPump("pu1", { initialStatus: "off", simulation: { status: "on" } })
      .aPump("pu2", { initialStatus: "off" })
      .build();

    const features = buildOptimizedAssetsSource(
      assets,
      initIDMap(assets),
      analysis,
    );

    expect(features).toHaveLength(2);
    const [pu1, pu2] = features;
    expect(pu1.properties!.status).toEqual("on");
    expect(pu2.properties!.status).toEqual("off");
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
        strokeColor: "#b4eac4",
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

    it("applies the direction based on the flow", () => {
      const analysis: AnalysisState = {
        ...nullAnalysis,
        links: {
          type: "velocities",
          rangeColorMapping: RangeColorMapping.build({
            steps: [0, 10, 20, 30],
            property: "velocity",
            unit: "l/s",
            paletteName: "epanet-ramp",
            absoluteValues: true,
          }),
        },
      };
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("ID", {
          simulation: { flow: -10, velocity: 20 },
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
      const { assets } = HydraulicModelBuilder.with(presets.GPM)
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
});

describe("build icons source", () => {
  describe("for pumps", () => {
    it("computes the feature of the pump icon", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1")
        .aPump("pu2", {
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "on",
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("pump");
      expect(properties?.status).toEqual("on");
      expect(properties?.rotation).toBeCloseTo(84, 0.1);
      expect(properties?.selected).toBeFalsy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toBeCloseTo(15);
      expect(geometry.coordinates[1]).toBeCloseTo(1.5, 0.1);
    });

    it("can handle pumps with 0 length", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPump("pu2", {
          coordinates: [
            [10, 1],
            [10, 1],
          ],
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("pump");
      expect(properties?.status).toEqual("on");
      expect(properties?.rotation).toEqual(0);
      expect(properties?.selected).toBeFalsy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toEqual(10);
      expect(geometry.coordinates[1]).toEqual(1);
    });
  });

  describe("for valves", () => {
    it("computes the feature of the valve icon", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1")
        .aValve("v1", {
          kind: "prv",
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "active",
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.type).toEqual("valve");
      expect(properties?.kind).toEqual("prv");
      expect(properties?.icon).toEqual("valve-prv-active");
      expect(properties?.rotation).toBeCloseTo(84, 0.1);
      expect(properties?.selected).toBeFalsy();
      expect(properties?.isControlValve).toBeTruthy();

      const geometry = features[0].geometry as Point;
      expect(geometry.type).toEqual("Point");
      expect(geometry.coordinates[0]).toBeCloseTo(15);
      expect(geometry.coordinates[1]).toBeCloseTo(1.5, 0.1);
    });

    it("uses simulation status when available", () => {
      const selectedAssets: Set<AssetId> = new Set();
      const { assets } = HydraulicModelBuilder.with()
        .aPipe("p1")
        .aValve("v1", {
          kind: "prv",
          coordinates: [
            [10, 1],
            [20, 2],
            [21, 3],
          ],
          initialStatus: "active",
          simulation: { status: "closed" },
        })
        .build();

      const features = buildIconPointsSource(
        assets,
        initIDMap(assets),
        selectedAssets,
      );

      expect(features.length).toEqual(1);
      const { properties } = features[0];
      expect(properties?.icon).toEqual("valve-prv-closed");
    });
  });
});

const initIDMap = (assets: AssetsMap): IDMap => {
  return UIDMap.loadIdsFromPersistence([...assets.values()]);
};
