import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { HydraulicModel, Junction, Pipe, Reservoir } from "src/hydraulic-model";

type SimulationPipeStatus = "Open" | "Closed";

const buildInp = (hydraulicModel: HydraulicModel): string => {
  const sections = {
    reservoirs: `[RESERVOIR]\n;id\thead\tpattern\n`,
    junctions: `[JUNCTIONS]\n;id\televation\n`,
    demands: `[DEMANDS]\n;id\tdemand\tpattern\tcategory\n`,
    pipes: `[PIPES]\n;id\tstart\tend\tlength\tdiameter\troughness\tminorLoss\tstatus\n`,
    report: `[REPORT]\nStatus\tFULL\n`,
    times: `[TIMES]\nDuration\t0\n`,
    options: `[OPTIONS]\nUnits\tLPS\nHeadloss\tH-W\n`,
  };

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "reservoir") {
      const reservoir = asset as Reservoir;
      sections.reservoirs += `${reservoir.id}\t${reservoir.head}\n`;
    }
    if (asset.type === "junction") {
      const junction = asset as Junction;
      sections.junctions += `${junction.id}\t${junction.elevation}\n`;
      sections.demands += `${junction.id}\t${junction.demand}\n`;
    }
    if (asset.type === "pipe") {
      const pipe = asset as Pipe;
      const [nodeStart, nodeEnd] = pipe.connections;
      const minorLoss = 0;
      const status = pipeStatusFor(pipe);
      sections.pipes += `${pipe.id}\t${nodeStart}\t${nodeEnd}\t${pipe.length}\t${pipe.diameter}\t${pipe.roughness}\t${minorLoss}\t${status}\n`;
    }
  }

  return [
    sections.junctions,
    sections.reservoirs,
    sections.pipes,
    sections.demands,
    sections.times,
    sections.report,
    sections.options,
    "[END]",
  ].join("\n");
};

const pipeStatusFor = (pipe: Pipe): SimulationPipeStatus => {
  switch (pipe.status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
  }
};

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

    expect(rowsFrom(inp)).toContain("[RESERVOIR]");
    expect(rowsFrom(inp)).toContain(";id\thead\tpattern");
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
    expect(rowsFrom(inp)).toContain(";id\televation");
    expect(rowsFrom(inp)).toContain("j1\t10");
    expect(rowsFrom(inp)).toContain("j2\t20");
    expect(rowsFrom(inp)).toContain("[DEMANDS]");
    expect(rowsFrom(inp)).toContain(";id\tdemand\tpattern\tcategory");
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
    expect(rowsFrom(inp)).toContain(
      ";id\tstart\tend\tlength\tdiameter\troughness\tminorLoss\tstatus",
    );
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

    expect(rowsFrom(inp)).toContain("[OPTIONS]");
    expect(rowsFrom(inp)).toContain("Units\tLPS");
    expect(rowsFrom(inp)).toContain("Headloss\tH-W");

    expect(rowsFrom(inp).at(-1)).toEqual("[END]");
  });

  const rowsFrom = (inp: string) => inp.split("\n");
});
