import {
  CountType,
  InitHydOption,
  NodeProperty,
  NodeType,
  Project,
  TimeParameter,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";

export type EPSSimulationResult = {
  status: SimulationStatus;
  report: string;
  metadata: EPSMetadata;
};

export type EPSMetadata = {
  timestepCount: number;
  nodeCount: number;
  linkCount: number;
  supplySourcesCount: number; // tanks + reservoirs
};

export type SimulationProgress = {
  currentTime: number;
  totalDuration: number;
};

export type ProgressCallback = (progress: SimulationProgress) => void;

export const runEPSSimulation = async (
  inp: string,
  flags: Record<string, boolean> = {},
  onProgress?: ProgressCallback,
): Promise<EPSSimulationResult> => {
  // eslint-disable-next-line no-console
  if (Object.keys(flags).length) console.log("Running with flags", flags);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    model.open("net.inp", "report.rpt", "results.out");

    const nodeCount = model.getCount(CountType.NodeCount);
    const linkCount = model.getCount(CountType.LinkCount);

    const supplySourceIndices: number[] = [];
    for (let i = 1; i <= nodeCount; i++) {
      const nodeType = model.getNodeType(i);
      if (nodeType === NodeType.Tank || nodeType === NodeType.Reservoir) {
        supplySourceIndices.push(i);
      }
    }
    const supplySourcesCount = supplySourceIndices.length;

    const tankVolumesPerTimestep: number[][] = [];

    const totalDuration = model.getTimeParameter(TimeParameter.Duration);

    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    let timestepCount = 0;
    do {
      const currentTime = model.runH();
      timestepCount++;

      onProgress?.({ currentTime, totalDuration });

      if (supplySourcesCount > 0) {
        const volumes: number[] = [];
        for (const nodeIndex of supplySourceIndices) {
          const volume = model.getNodeValue(nodeIndex, NodeProperty.TankVolume);
          volumes.push(volume);
        }
        tankVolumesPerTimestep.push(volumes);
      }
    } while (model.nextH() > 0);

    model.closeH();
    model.saveH();

    model.close();

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
      metadata: {
        timestepCount,
        nodeCount,
        linkCount,
        supplySourcesCount,
      },
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      metadata: {
        timestepCount: 0,
        nodeCount: 0,
        linkCount: 0,
        supplySourcesCount: 0,
      },
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
