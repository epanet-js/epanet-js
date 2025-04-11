import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";
import { presets } from "src/model-metadata/quantities-spec";

describe("build inp", () => {
  it("adds reservoirs", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir("r1", {
        head: 10,
      })
      .aReservoir("r2", {
        head: 20,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[RESERVOIRS]");
    expect(inp).toContain("r1\t10");
    expect(inp).toContain("r2\t20");
  });

  it("adds junctions", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", {
        elevation: 10,
        demand: 1,
      })
      .aJunction("j2", {
        elevation: 20,
        demand: 2,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[JUNCTIONS]");
    expect(inp).toContain("j1\t10");
    expect(inp).toContain("j2\t20");
    expect(inp).toContain("[DEMANDS]");
    expect(inp).toContain("j1\t1");
    expect(inp).toContain("j2\t2");
  });

  it("adds pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aPipe("pipe1", {
        startNodeId: "node1",
        endNodeId: "node2",
        length: 10,
        diameter: 100,
        roughness: 1,
        status: "open",
      })
      .aPipe("pipe2", {
        startNodeId: "node2",
        endNodeId: "node3",
        length: 20,
        diameter: 200,
        roughness: 2,
        status: "closed",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PIPES]");
    expect(inp).toContain("pipe1\tnode1\tnode2\t10\t100\t1\t0\tOpen");
    expect(inp).toContain("pipe2\tnode2\tnode3\t20\t200\t2\t0\tClosed");
  });

  it("adds pumps", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aPump("pump1", {
        startNodeId: "node1",
        endNodeId: "node2",
        initialStatus: "on",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("pump1\tnode1\tnode2\tHEAD DEFAULT_CURVE");
    expect(inp).toContain("[STATUS]");
    expect(inp).toContain("pump1\tOpen");
    expect(inp).toContain("[CURVES]");
    expect(inp).toContain("DEFAULT_CURVE\t1\t1");
  });

  it("includes simulation settings", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[TIMES]");
    expect(inp).toContain("Duration\t0");

    expect(inp).toContain("[REPORT]");
    expect(inp).toContain("Status\tFULL");
    expect(inp).toContain("Summary\tNo");
    expect(inp).toContain("Page\t0");

    expect(inp).toContain("[OPTIONS]");
    expect(inp).toContain("Accuracy\t0.001");
    expect(inp).toContain("Units\tLPS");
    expect(inp).toContain("Quality\tNONE");
    expect(inp).toContain("Headloss\tH-W");

    expect(inp.split("\n").at(-1)).toEqual("[END]");
  });

  it("includes visualization settings for epanet", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(hydraulicModel, { geolocation: true });

    expect(inp).toContain("[BACKDROP]");
    expect(inp).toContain("Units\tDEGREES");
  });

  it("includes haadloss formula", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .setHeadlossFormula("D-W")
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("Headloss\tD-W");
  });

  it("detects units based on the flow units of the model", () => {
    const hydraulicModel = HydraulicModelBuilder.with(presets.GPM).build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("Units\tGPM");
  });

  it("includes geographical info when requested", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { coordinates: [10, 1] })
      .aReservoir("reservoir1", { coordinates: [20, 2] })
      .aPipe("pipe1", {
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
    expect(without).not.toContain("[COORDINATES]");
    expect(without).not.toContain("[VERTICES]");

    const inp = buildInp(hydraulicModel, { geolocation: true });

    expect(inp).toContain("[COORDINATES]");
    expect(inp).toContain("junction1\t10\t1");
    expect(inp).toContain("reservoir1\t20\t2");

    expect(inp).toContain("[VERTICES]");
    expect(inp).toContain("pipe1\t30\t3");
    expect(inp).toContain("pipe1\t40\t4");
  });

  it("signals that inp has been built by this app", () => {
    let hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { coordinates: [10, 1] })
      .build();

    let inp = buildInp(hydraulicModel, { madeBy: true });

    expect(inp).toContain(";MADE BY EPANET-JS [514c3c84]");
    expect(inp).toContain("junction1");
    hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { coordinates: [10, 1] })
      .aJunction("junction2", { coordinates: [10, 1] })
      .build();

    inp = buildInp(hydraulicModel, { madeBy: true });

    expect(inp).toContain(";MADE BY EPANET-JS [710b6880]");
  });
});
