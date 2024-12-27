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

    expect(rowsFrom(inp)).toContain("[RESERVOIRS]");
    expect(rowsFrom(inp)).toContain("r1\t10");
    expect(rowsFrom(inp)).toContain("r2\t20");
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

    expect(rowsFrom(inp)).toContain("[JUNCTIONS]");
    expect(rowsFrom(inp)).toContain("j1\t10");
    expect(rowsFrom(inp)).toContain("j2\t20");
    expect(rowsFrom(inp)).toContain("[DEMANDS]");
    expect(rowsFrom(inp)).toContain("j1\t1");
    expect(rowsFrom(inp)).toContain("j2\t2");
  });

  it("adds pipes", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("node1")
      .aNode("node2")
      .aNode("node3")
      .aPipe("pipe1", "node1", "node2", {
        length: 10,
        diameter: 100,
        roughness: 1,
        status: "open",
      })
      .aPipe("pipe2", "node2", "node3", {
        length: 20,
        diameter: 200,
        roughness: 2,
        status: "closed",
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(rowsFrom(inp)).toContain("[PIPES]");
    expect(rowsFrom(inp)).toContain("pipe1\tnode1\tnode2\t10\t100\t1\t0\tOpen");
    expect(rowsFrom(inp)).toContain(
      "pipe2\tnode2\tnode3\t20\t200\t2\t0\tClosed",
    );
  });

  it("includes simulation settings", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const inp = buildInp(hydraulicModel);

    expect(rowsFrom(inp)).toContain("[TIMES]");
    expect(rowsFrom(inp)).toContain("Duration\t0");

    expect(rowsFrom(inp)).toContain("[REPORT]");
    expect(rowsFrom(inp)).toContain("Status\tFULL");
    expect(rowsFrom(inp)).toContain("Summary\tNo");
    expect(rowsFrom(inp)).toContain("Page\t0");

    expect(rowsFrom(inp)).toContain("[OPTIONS]");
    expect(rowsFrom(inp)).toContain("Accuracy\t0.01");
    expect(rowsFrom(inp)).toContain("Units\tLPS");
    expect(rowsFrom(inp)).toContain("Quality\tNONE");
    expect(rowsFrom(inp)).toContain("Headloss\tH-W");

    expect(rowsFrom(inp).at(-1)).toEqual("[END]");
  });

  it("detects units based on the flow units of the model", () => {
    const hydraulicModel = HydraulicModelBuilder.with(
      presets.usCustomary,
    ).build();

    const inp = buildInp(hydraulicModel);

    expect(rowsFrom(inp)).toContain("Units\tGPM");
  });

  it("includes geographical info when requested", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { coordinates: [10, 1] })
      .aReservoir("reservoir1", { coordinates: [20, 2] })
      .aPipe("pipe1", "junction1", "reservoir1", {
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

    const inp = buildInp(hydraulicModel, { geolocation: true });

    expect(rowsFrom(inp)).toContain("[COORDINATES]");
    expect(rowsFrom(inp)).toContain("junction1\t10\t1");
    expect(rowsFrom(inp)).toContain("reservoir1\t20\t2");

    expect(rowsFrom(inp)).toContain("[VERTICES]");
    expect(rowsFrom(inp)).toContain("pipe1\t30\t3");
    expect(rowsFrom(inp)).toContain("pipe1\t40\t4");
  });

  const rowsFrom = (inp: string) => inp.split("\n");
});
