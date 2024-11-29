import { HydraulicModel, Junction, Pipe, Reservoir } from "src/hydraulic-model";

type SimulationPipeStatus = "Open" | "Closed";

export const buildInp = (hydraulicModel: HydraulicModel): string => {
  const defaultUnits = "LPS";
  const defaultHeadloss = "H-W";
  const defaultMinorloss = 0;
  const oneStep = 0;
  const sections = {
    junctions: ["[JUNCTIONS]", ";id\televation"],
    reservoirs: ["[RESERVOIR]", ";id\thead\tpattern"],
    pipes: [
      "[PIPES]",
      ";id\tstart\tend\tlength\tdiameter\troughness\tminorLoss\tstatus",
    ],
    demands: ["[DEMANDS]", ";id\tdemand\tpattern\tcategory"],
    times: ["[TIMES]", `Duration\t${oneStep}`],
    report: ["[REPORT]", "Status\tFULL"],
    options: [
      "[OPTIONS]",
      `Units\t${defaultUnits}`,
      `Headloss\t${defaultHeadloss}`,
    ],
  };

  for (const asset of hydraulicModel.assets.values()) {
    if (asset.type === "reservoir") {
      const reservoir = asset as Reservoir;
      sections.reservoirs.push([reservoir.id, reservoir.head].join("\t"));
    }
    if (asset.type === "junction") {
      const junction = asset as Junction;
      sections.junctions.push([junction.id, junction.elevation].join("\t"));
      sections.demands.push([junction.id, junction.demand].join("\t"));
    }
    if (asset.type === "pipe") {
      const pipe = asset as Pipe;
      const [nodeStart, nodeEnd] = pipe.connections;
      sections.pipes.push(
        [
          pipe.id,
          nodeStart,
          nodeEnd,
          pipe.length,
          pipe.diameter,
          pipe.roughness,
          defaultMinorloss,
          pipeStatusFor(pipe),
        ].join("\t"),
      );
    }
  }

  return [
    sections.junctions.join("\n"),
    sections.reservoirs.join("\n"),
    sections.pipes.join("\n"),
    sections.demands.join("\n"),
    sections.times.join("\n"),
    sections.report.join("\n"),
    sections.options.join("\n"),
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
