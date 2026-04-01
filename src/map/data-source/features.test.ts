import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SymbologySpec, nullSymbologySpec } from "src/map/symbology";
import { buildOptimizedAssetsSource } from "./features";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import {
  aLinkSymbology,
  aNodeSymbology,
  aRangeColorRule,
} from "src/__helpers__/state";
import { getColors } from "src/map/symbology/range-color-rule";
import { createMockResultsReader } from "src/__helpers__/state";

describe("build optimized source", () => {
  const defaultUnits = presets.LPS.units;
  const defaultFormatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };
  const fakeTranslateUnit = vi.fn();
  it("preserves core properties", () => {
    const IDS = { ID: 1, J1: 2 } as const;
    const symbology = nullSymbologySpec;
    const { assets } = HydraulicModelBuilder.with()
      .aPipe(IDS.ID, {
        diameter: 300,
        initialStatus: "open",
      })
      .aJunction(IDS.J1, { elevation: 15 })
      .build();

    const features = buildOptimizedAssetsSource(
      assets,
      symbology,
      defaultUnits,
      defaultFormatting,
      fakeTranslateUnit,
    );

    expect(features).toHaveLength(2);
    const [pipe, junction] = features;
    expect(pipe.properties).toEqual({
      type: "pipe",
      status: "open",
      isActive: true,
    });
    expect(pipe.properties).toEqual({
      type: "pipe",
      status: "open",
      isActive: true,
    });
    expect(pipe.geometry!.type).toEqual("LineString");

    expect(junction.properties).toEqual({ type: "junction", isActive: true });
    expect(junction.geometry!.type).toEqual("Point");

    expect(pipe.id).not.toEqual(junction.id);
  });

  it("includes isActive property from assets", () => {
    const IDS = { ID: 1, ID2: 2, J1: 3, J2: 4 } as const;
    const symbology = nullSymbologySpec;
    const { assets } = HydraulicModelBuilder.with()
      .aPipe(IDS.ID, { initialStatus: "open", isActive: true })
      .aPipe(IDS.ID2, { initialStatus: "open", isActive: false })
      .aJunction(IDS.J1, { elevation: 15, isActive: true })
      .aJunction(IDS.J2, { elevation: 15, isActive: false })
      .build();

    const features = buildOptimizedAssetsSource(
      assets,
      symbology,
      defaultUnits,
      defaultFormatting,
      fakeTranslateUnit,
    );

    expect(features).toHaveLength(4);
    const [activePipe, inactivePipe, activeJunction, inactiveJunction] =
      features;
    expect(activePipe.properties!.isActive).toEqual(true);
    expect(inactivePipe.properties!.isActive).toEqual(false);
    expect(activeJunction.properties!.isActive).toEqual(true);
    expect(inactiveJunction.properties!.isActive).toEqual(false);
  });

  it("uses pump status when available", () => {
    const IDS = { pu1: 1, pu2: 2 } as const;
    const symbology = nullSymbologySpec;
    const { assets } = HydraulicModelBuilder.with()
      .aPump(IDS.pu1, { initialStatus: "off" })
      .aPump(IDS.pu2, { initialStatus: "off" })
      .build();
    const simulationResults = createMockResultsReader({
      pumps: { [IDS.pu1]: { status: "on" } },
    });

    const features = buildOptimizedAssetsSource(
      assets,
      symbology,
      defaultUnits,
      defaultFormatting,
      fakeTranslateUnit,
      simulationResults,
    );

    expect(features).toHaveLength(2);
    const [pu1, pu2] = features;
    expect(pu1.properties!.status).toEqual("on");
    expect(pu2.properties!.status).toEqual("off");
  });

  describe("node symbology", () => {
    it("includes props for styling to junctions", () => {
      const IDS = { J1: 1 } as const;
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
        .aJunction(IDS.J1, { elevation: 15 })
        .build();
      const simulationResults = createMockResultsReader({
        junctions: { [IDS.J1]: { pressure: 10 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        fakeTranslateUnit,
        simulationResults,
      );

      const [junction] = features;
      expect(junction.properties!.type).toEqual("junction");
      expect(junction.properties!.color).not.toBeUndefined();
      expect(junction.properties!.strokeColor).not.toBeUndefined();
    });

    it("includes labels when specified", () => {
      const IDS = { J1: 1 } as const;
      const symbology: SymbologySpec = {
        ...nullSymbologySpec,
        node: aNodeSymbology({
          labelRule: "pressure",
        }),
      };
      const { assets } = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 15 })
        .build();
      const simulationResults = createMockResultsReader({
        junctions: { [IDS.J1]: { pressure: 10 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        () => "m",
        simulationResults,
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
      const IDS = { ID: 1, J1: 2 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.ID, {
          diameter: 300,
          initialStatus: "open",
          length: 14,
        })
        .aJunction(IDS.J1, { elevation: 15 })
        .build();
      const simulationResults = createMockResultsReader({
        pipes: { [IDS.ID]: { flow: 10 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        fakeTranslateUnit,
        simulationResults,
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
      const IDS = { ID: 1 } as const;
      const symbology: SymbologySpec = {
        ...nullSymbologySpec,
        link: aLinkSymbology({
          labelRule: "flow",
        }),
      };

      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.ID, {
          diameter: 300,
          initialStatus: "open",
          length: 14,
        })
        .build();
      const simulationResults = createMockResultsReader({
        pipes: { [IDS.ID]: { flow: -10 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        () => "l/s",
        simulationResults,
      );

      const [pipe] = features;
      expect(pipe.properties).toMatchObject({
        label: "-10 l/s",
      });
    });

    it("reverses arrow when value is negative", () => {
      const IDS = { ID: 1, ID_REVERSE: 2 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.ID)
        .aPipe(IDS.ID_REVERSE)
        .build();
      const simulationResults = createMockResultsReader({
        pipes: {
          [IDS.ID]: { flow: 10 },
          [IDS.ID_REVERSE]: { flow: -10 },
        },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        fakeTranslateUnit,
        simulationResults,
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
      const IDS = { ID: 1 } as const;
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
      const { assets } = HydraulicModelBuilder.with().aPipe(IDS.ID).build();
      const simulationResults = createMockResultsReader({
        pipes: { [IDS.ID]: { flow: -10, velocity: 20 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        fakeTranslateUnit,
        simulationResults,
      );

      const [pipe] = features;
      expect(pipe.properties).toMatchObject({
        rotation: -180,
      });
    });

    it("assigns same value to 0 and missing results", () => {
      const IDS = { p1: 1, p2: 2 } as const;
      const { assets } = HydraulicModelBuilder.with()
        .aPipe(IDS.p1)
        .aPipe(IDS.p2)
        .build();
      const simulationResults = createMockResultsReader({
        pipes: { [IDS.p1]: { flow: 0 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        defaultUnits,
        defaultFormatting,
        fakeTranslateUnit,
        simulationResults,
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
      const IDS = { p1: 1 } as const;
      const gpmUnits = presets.GPM.units;
      const gpmFormatting: FormattingSpec = {
        decimals: presets.GPM.decimals,
        defaultDecimals: 3,
      };
      const { assets } = HydraulicModelBuilder.with({
        quantitiesSpec: presets.GPM,
      })
        .aPipe(IDS.p1, { length: 10 })
        .build();
      const simulationResults = createMockResultsReader({
        pipes: { [IDS.p1]: { flow: 5 } },
      });

      const features = buildOptimizedAssetsSource(
        assets,
        symbology,
        gpmUnits,
        gpmFormatting,
        fakeTranslateUnit,
        simulationResults,
      );

      const [p1] = features;
      expect(p1.properties).toMatchObject({ length: 3.048 });
    });
  });
});
