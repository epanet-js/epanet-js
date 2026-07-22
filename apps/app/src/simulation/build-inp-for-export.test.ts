import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";
import { presets } from "src/lib/project-settings/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";

describe("build inp export ", () => {
  const exportOptions = {
    labelIds: true,
    geolocation: true,
    simulationSettings: defaultSimulationSettings,
    units: presets.LPS.units,
  };

  it("adds reservoirs", () => {
    const IDS = { R1: 1, R2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, {
        label: "RES_1",
        head: 10,
      })
      .aReservoir(IDS.R2, {
        label: "RES_2",
        head: 20,
      })
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[RESERVOIRS]");
    expect(rowsFrom(inp)).toContain("RES_1\t10");
    expect(rowsFrom(inp)).toContain("RES_2\t20");
  });

  it("adds junctions", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        label: "J_1",
        elevation: 10,
      })
      .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
      .aJunction(IDS.J2, {
        label: "J_2",
        elevation: 20,
      })
      .aJunctionDemand(IDS.J2, [{ baseDemand: 2 }])
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[JUNCTIONS]");
    expect(rowsFrom(inp)).toContain("J_1\t10");
    expect(rowsFrom(inp)).toContain("J_2\t20");
    expect(rowsFrom(inp)).toContain("[DEMANDS]");
    expect(rowsFrom(inp)).toContain("J_1\t1");
    expect(rowsFrom(inp)).toContain("J_2\t2");
  });

  it("adds pipes", () => {
    const IDS = { J1: 1, J2: 2, R1: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J_1" })
      .aJunction(IDS.J2, { label: "J_2" })
      .aReservoir(IDS.R1, { label: "RES_1" })
      .aPipe(IDS.P1, {
        label: "P_1",
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        length: 10,
        diameter: 100,
        roughness: 1,
        initialStatus: "open",
      })
      .aPipe(IDS.P2, {
        label: "P_2",
        startNodeId: IDS.J2,
        endNodeId: IDS.R1,
        length: 20,
        diameter: 200,
        roughness: 2,
        initialStatus: "closed",
      })
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[PIPES]");
    expect(rowsFrom(inp)).toContain("P_1\tJ_1\tJ_2\t10\t100\t1");
    expect(rowsFrom(inp)).toContain("P_2\tJ_2\tRES_1\t20\t200\t2\t0\tClosed");
  });

  it("includes simulation settings", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[TIMES]");
    expect(rowsFrom(inp)).toContain("Duration\t0");

    expect(rowsFrom(inp)).toContain("[REPORT]");
    expect(rowsFrom(inp)).toContain("Status\tFULL");
    expect(rowsFrom(inp)).toContain("Summary\tNo");
    expect(rowsFrom(inp)).toContain("Page\t0");

    expect(rowsFrom(inp)).toContain("[OPTIONS]");
    expect(rowsFrom(inp)).toContain("Accuracy\t0.001");
    expect(rowsFrom(inp)).toContain("Units\tLPS");
    expect(rowsFrom(inp)).toContain("Quality\tNONE");
    expect(rowsFrom(inp)).toContain("Headloss\tH-W");

    expect(rowsFrom(inp).at(-1)).toEqual("[END]");
  });

  it("includes visualization settings for epanet", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[BACKDROP]");
    expect(rowsFrom(inp)).toContain("Units\tDEGREES");
  });

  it("includes haadloss formula", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(hydraulicModel, {
      ...exportOptions,
      headlossFormula: "D-W",
    });

    expect(rowsFrom(inp)).toContain("Headloss\tD-W");
  });

  it("detects units based on the flow units of the model", () => {
    const hydraulicModel = HydraulicModelBuilder.with({}).build();

    const inp = buildInp(hydraulicModel, {
      ...exportOptions,
      units: presets.GPM.units,
    });

    expect(rowsFrom(inp)).toContain("Units\tGPM");
  });

  it("includes geographical info when requested", () => {
    const IDS = { J1: 1, R1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J_1", coordinates: [10, 1] })
      .aReservoir(IDS.R1, { label: "RES_1", coordinates: [20, 2] })
      .aPipe(IDS.P1, {
        label: "P_1",
        startNodeId: IDS.J1,
        endNodeId: IDS.R1,
        coordinates: [
          [10, 1],
          [30, 3],
          [40, 4],
          [20, 2],
        ],
      })
      .build();

    const without = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings: defaultSimulationSettings,
    });
    expect(rowsFrom(without)).not.toContain("[COORDINATES]");
    expect(rowsFrom(without)).not.toContain("[VERTICES]");

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[COORDINATES]");
    expect(rowsFrom(inp)).toContain("J_1\t10\t1");
    expect(rowsFrom(inp)).toContain("RES_1\t20\t2");

    expect(rowsFrom(inp)).toContain("[VERTICES]");
    expect(rowsFrom(inp)).toContain("P_1\t30\t3");
    expect(rowsFrom(inp)).toContain("P_1\t40\t4");
  });

  it("avoids collision of same labels between nodes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        label: "SAME_LABEL",
        elevation: 10,
        coordinates: [10, 10],
      })
      .aJunction(IDS.J2, {
        label: "SAME_LABEL",
        elevation: 20,
        coordinates: [20, 20],
      })
      .aPipe(IDS.P1, {
        label: "SAME_LABEL",
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        length: 10,
        diameter: 100,
        roughness: 1,
        initialStatus: "open",
      })
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[PIPES]");
    expect(rowsFrom(inp)).toContain(
      "SAME_LABEL\tSAME_LABEL\tSAME_LABEL.1\t10\t100\t1",
    );
    expect(rowsFrom(inp)).toContain("[JUNCTIONS]");
    expect(rowsFrom(inp)).toContain("SAME_LABEL\t10");
    expect(rowsFrom(inp)).toContain("SAME_LABEL.1\t20");
    expect(rowsFrom(inp)).toContain("[COORDINATES]");
    expect(rowsFrom(inp)).toContain("SAME_LABEL\t10\t10");
    expect(rowsFrom(inp)).toContain("SAME_LABEL.1\t20\t20");
  });

  it("avoid collision of same labels between links", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        label: "J_1",
      })
      .aJunction(IDS.J2, {
        label: "J_2",
      })
      .aJunction(IDS.J3, {
        label: "J_3",
      })
      .aPipe(IDS.P1, {
        label: "SAME_LABEL",
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        label: "SAME_LABEL",
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
      })
      .build();

    const inp = buildInp(hydraulicModel, exportOptions);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("SAME_LABEL\tJ_1\tJ_2");
    expect(inp).toContain("SAME_LABEL.1\tJ_2\tJ_3");
  });

  describe("enforceLabelLimit", () => {
    const exportOptionsWithLimit = {
      ...exportOptions,
      enforceLabelLimit: true,
    };

    it("truncates labels longer than the EPANET limit", () => {
      const IDS = { J1: 1 } as const;
      const longLabel = "JUNCTION_WITH_A_REALLY_LONG_DESCRIPTIVE_NAME";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: longLabel, elevation: 10 })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithLimit);

      const truncated = longLabel.slice(0, 31);
      expect(truncated).toHaveLength(31);
      expect(rowsFrom(inp)).toContain(`${truncated}\t10`);
    });

    it("keeps references consistent after truncating node labels", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const start = "START_NODE_WITH_A_VERY_LONG_DESCRIPTIVE_LABEL";
      const end = "END_NODE_WITH_A_VERY_LONG_DESCRIPTIVE_LABEL";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          label: start,
          elevation: 10,
          coordinates: [10, 10],
        })
        .aJunction(IDS.J2, {
          label: end,
          elevation: 20,
          coordinates: [20, 20],
        })
        .aPipe(IDS.P1, {
          label: "PIPE",
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          length: 10,
          diameter: 100,
          roughness: 1,
          initialStatus: "open",
        })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithLimit);

      const startId = start.slice(0, 31);
      const endId = end.slice(0, 31);
      expect(rowsFrom(inp)).toContain(`${startId}\t10`);
      expect(rowsFrom(inp)).toContain(`${startId}\t10\t10`);
      expect(rowsFrom(inp)).toContain(`PIPE\t${startId}\t${endId}\t10\t100\t1`);
    });

    it("dedupes labels that collide only after truncation and stays within the limit", () => {
      const IDS = { J1: 1, J2: 2 } as const;
      const base = "COLLIDING_LABEL_PREFIX_EXCEEDS_LIMIT";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: `${base}_A`, elevation: 10 })
        .aJunction(IDS.J2, { label: `${base}_B`, elevation: 20 })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithLimit);

      const firstId = `${base}_A`.slice(0, 31);
      const secondId = `${base.slice(0, 28)}.1`;
      expect(firstId).toHaveLength(31);
      expect(secondId.length).toBeLessThanOrEqual(31);
      expect(rowsFrom(inp)).toContain(`${firstId}\t10`);
      expect(rowsFrom(inp)).toContain(`${secondId}\t20`);
    });

    it("truncates pattern labels and updates demand references", () => {
      const IDS = { J1: 1, PAT1: 100 } as const;
      const longPattern = "RESIDENTIAL_DEMAND_PATTERN_WITH_LONG_LABEL";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1", elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10, patternId: IDS.PAT1 }])
        .aDemandPattern(IDS.PAT1, longPattern, [0.8, 1.2, 1.0])
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithLimit);

      const patternId = longPattern.slice(0, 31);
      expect(patternId).toHaveLength(31);
      expect(rowsFrom(inp)).toContain(`J1\t10\t${patternId}`);
      expect(rowsFrom(inp)).toContain(`${patternId}\t0.8\t1.2\t1`);
    });

    it("truncates curve labels and updates pump references", () => {
      const IDS = { N1: 1, N2: 2, PU1: 3 } as const;
      const longPump = "PUMP_STATION_WITH_A_VERY_LONG_LABEL";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.N1, { label: "J1" })
        .aJunction(IDS.N2, { label: "J2" })
        .aPump(IDS.PU1, {
          startNodeId: IDS.N1,
          endNodeId: IDS.N2,
          label: longPump,
          initialStatus: "on",
          definitionType: "standardCurve",
          curve: [
            { x: 0, y: 60 },
            { x: 20, y: 40 },
            { x: 40, y: 0 },
          ],
          speed: 0.8,
        })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithLimit);

      const pumpId = longPump.slice(0, 31);
      expect(pumpId).toHaveLength(31);
      expect(inp).toContain(`${pumpId}\tJ1\tJ2\tHEAD ${pumpId}\tSPEED 0.8`);
      expect(inp).toContain(`${pumpId}\t0\t60`);
    });

    it("truncates node and link labels referenced from controls", () => {
      const IDS = { T1: 1, J1: 2, P1: 3 } as const;
      const longTank = "STORAGE_TANK_WITH_A_VERY_LONG_LABEL";
      const longPipe = "TRANSMISSION_PIPE_WITH_A_VERY_LONG_LABEL";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank(IDS.T1, { label: longTank, coordinates: [0, 0] })
        .aJunction(IDS.J1, { label: "J1", coordinates: [1, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.T1,
          endNodeId: IDS.J1,
          label: longPipe,
        })
        .aSimpleControl({
          template: "LINK {{0}} OPEN IF NODE {{1}} ABOVE 100",
          assetReferences: [
            { assetId: IDS.P1, isActionTarget: true },
            { assetId: IDS.T1 },
          ],
        })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithLimit);

      const tankId = longTank.slice(0, 31);
      const pipeId = longPipe.slice(0, 31);
      expect(inp).toContain(`LINK ${pipeId} OPEN IF NODE ${tankId} ABOVE 100`);
    });

    it("leaves long labels untouched when the limit is not enforced", () => {
      const IDS = { J1: 1 } as const;
      const longLabel = "JUNCTION_WITH_A_REALLY_LONG_DESCRIPTIVE_NAME";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: longLabel, elevation: 10 })
        .build();

      const inp = buildInp(hydraulicModel, exportOptions);

      expect(rowsFrom(inp)).toContain(`${longLabel}\t10`);
    });
  });

  describe("safe labels on export", () => {
    const exportOptionsWithSafeLabels = {
      ...exportOptions,
      enforceLabelLimit: true,
    };

    it("strips commas from labels and dedupes any resulting collision", () => {
      const IDS = { J1: 1, J2: 2 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "A,B", elevation: 10 })
        .aJunction(IDS.J2, { label: "AB", elevation: 20 })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithSafeLabels);

      expect(inp).not.toContain("A,B");
      const rows = rowsFrom(inp);
      expect(rows).toContain("AB\t10");
      expect(rows).toContain("AB.1\t20");
    });

    it("keeps link references consistent after stripping a node label comma", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          label: "N,1",
          elevation: 10,
          coordinates: [10, 10],
        })
        .aJunction(IDS.J2, {
          label: "N2",
          elevation: 20,
          coordinates: [20, 20],
        })
        .aPipe(IDS.P1, {
          label: "P,1",
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          length: 10,
          diameter: 100,
          roughness: 1,
          initialStatus: "open",
        })
        .build();

      const inp = buildInp(hydraulicModel, exportOptionsWithSafeLabels);

      expect(inp).not.toMatch(/[NP],\d/);
      expect(rowsFrom(inp)).toContain("P1\tN1\tN2\t10\t100\t1");
    });

    it("leaves commas untouched when the flag/limit is not enforced", () => {
      const IDS = { J1: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "A,B", elevation: 10 })
        .build();

      const inp = buildInp(hydraulicModel, exportOptions);

      expect(rowsFrom(inp)).toContain("A,B\t10");
    });
  });

  const rowsFrom = (inp: string) => inp.split("\n");
});
