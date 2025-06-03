import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";
import { presets } from "src/model-metadata/quantities-spec";

describe("build inp export ", () => {
  const exportOptions = { labelIds: true, geolocation: true };

  it("adds reservoirs", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1", {
        label: "RES_1",
        head: 10,
      })
      .aReservoir("r2", {
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
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", {
        label: "J_1",
        elevation: 10,
        demand: 1,
      })
      .aJunction("j2", {
        label: "J_2",
        elevation: 20,
        demand: 2,
      })
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
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { label: "J_1" })
      .aJunction("j2", { label: "J_2" })
      .aReservoir("r1", { label: "RES_1" })
      .aPipe("pipe1", {
        label: "P_1",
        startNodeId: "j1",
        endNodeId: "j2",
        length: 10,
        diameter: 100,
        roughness: 1,
        status: "open",
      })
      .aPipe("pipe2", {
        label: "P_2",
        startNodeId: "j2",
        endNodeId: "r1",
        length: 20,
        diameter: 200,
        roughness: 2,
        status: "closed",
      })
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[PIPES]");
    expect(rowsFrom(inp)).toContain("P_1\tJ_1\tJ_2\t10\t100\t1\t0\tOpen");
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
    const hydraulicModel = HydraulicModelBuilder.with()
      .setHeadlossFormula("D-W")
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("Headloss\tD-W");
  });

  it("detects units based on the flow units of the model", () => {
    const hydraulicModel = HydraulicModelBuilder.with(presets.GPM).build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("Units\tGPM");
  });

  it("includes geographical info when requested", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { label: "J_1", coordinates: [10, 1] })
      .aReservoir("reservoir1", { label: "RES_1", coordinates: [20, 2] })
      .aPipe("pipe1", {
        label: "P_1",
        startNodeId: "junction1",
        endNodeId: "reservoir1",
        coordinates: [
          [10, 1],
          [30, 3],
          [40, 4],
          [20, 2],
        ],
      })
      .build();

    const without = buildInp(hydraulicModel);
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
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", {
        label: "SAME_LABEL",
        elevation: 10,
        coordinates: [10, 10],
      })
      .aJunction("j2", {
        label: "SAME_LABEL",
        elevation: 20,
        coordinates: [20, 20],
      })
      .aPipe("pipe1", {
        label: "SAME_LABEL",
        startNodeId: "j1",
        endNodeId: "j2",
        length: 10,
        diameter: 100,
        roughness: 1,
        status: "open",
      })
      .build();

    const inp = buildInp(
      hydraulicModel,

      exportOptions,
    );

    expect(rowsFrom(inp)).toContain("[PIPES]");
    expect(rowsFrom(inp)).toContain(
      "SAME_LABEL\tSAME_LABEL\tSAME_LABEL.1\t10\t100\t1\t0\tOpen",
    );
    expect(rowsFrom(inp)).toContain("[JUNCTIONS]");
    expect(rowsFrom(inp)).toContain("SAME_LABEL\t10");
    expect(rowsFrom(inp)).toContain("SAME_LABEL.1\t20");
    expect(rowsFrom(inp)).toContain("[COORDINATES]");
    expect(rowsFrom(inp)).toContain("SAME_LABEL\t10\t10");
    expect(rowsFrom(inp)).toContain("SAME_LABEL.1\t20\t20");
  });

  it("avoid collision of same labels between links", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", {
        label: "J_1",
      })
      .aJunction("j2", {
        label: "J_2",
      })
      .aJunction("j3", {
        label: "J_3",
      })
      .aPipe("pipe1", {
        label: "SAME_LABEL",
        startNodeId: "j1",
        endNodeId: "j2",
      })
      .aPipe("pipe2", {
        label: "SAME_LABEL",
        startNodeId: "j2",
        endNodeId: "j3",
      })
      .build();

    const inp = buildInp(hydraulicModel, exportOptions);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("SAME_LABEL\tJ_1\tJ_2");
    expect(inp).toContain("SAME_LABEL.1\tJ_2\tJ_3");
  });

  const rowsFrom = (inp: string) => inp.split("\n");
});
