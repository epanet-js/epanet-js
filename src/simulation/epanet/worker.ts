import {
  CountType,
  InitHydOption,
  LinkProperty,
  LinkType,
  NodeProperty,
  NodeType,
  Project,
  TimeParameter,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";
import { OPFSStorage } from "src/infra/storage";
import { PROLOG_SIZE, EPILOG_SIZE } from "./simulation-metadata";

export const RESULTS_OUT_KEY = "results.out";
export const TANK_VOLUMES_KEY = "tank-volumes.bin";
export const PUMP_STATUS_KEY = "pump-status.bin";

export type EPSSimulationResult = {
  status: SimulationStatus;
  report: string;
  metadata: ArrayBuffer;
  jsError?: string;
};

export type SimulationProgress = {
  currentTime: number;
  totalDuration: number;
};

export type ProgressCallback = (progress: SimulationProgress) => void;

export const runSimulation = async (
  inp: string,
  appId: string,
  onProgress?: ProgressCallback,
  flags: Record<string, boolean> = {},
  scenarioKey?: string,
): Promise<EPSSimulationResult> => {
  // eslint-disable-next-line no-console
  if (Object.keys(flags).length) console.log("Running with flags", flags);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    model.open("net.inp", "report.rpt", "results.out");

    const missingDataAccumulator = new MissingSimulationDataAccumulator(model);
    const totalDuration = model.getTimeParameter(TimeParameter.Duration);

    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    do {
      const currentTime = model.runH();
      missingDataAccumulator.appendTimestepData(model);
      onProgress?.({ currentTime, totalDuration });
    } while (model.nextH() > 0);

    model.closeH();
    model.saveH();

    model.close();

    const { resultsBuffer, metadata } = extractResultsData(ws);

    const storage = new OPFSStorage(appId, scenarioKey);
    await storage.save(RESULTS_OUT_KEY, resultsBuffer);
    await storage.save(TANK_VOLUMES_KEY, missingDataAccumulator.tankVolumes());
    await storage.save(PUMP_STATUS_KEY, missingDataAccumulator.pumpStatus());

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
      metadata,
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");
    const errorMessage = (error as Error).message;
    const isEpanetError = /EPANET Error|^Error \d+/.test(errorMessage);

    return {
      status: "failure",
      report: report.length > 0 ? curateReport(report) : errorMessage,
      metadata: new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE),
      jsError: isEpanetError ? undefined : errorMessage,
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};

const extractResultsData = (ws: Workspace) => {
  const resultsOutBinary = ws.readFile("results.out", "binary");
  const fileSize = resultsOutBinary.byteLength;
  const metadata = new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE);
  const metadataView = new Uint8Array(metadata);
  metadataView.set(new Uint8Array(resultsOutBinary.buffer, 0, PROLOG_SIZE), 0);
  metadataView.set(
    new Uint8Array(
      resultsOutBinary.buffer,
      fileSize - EPILOG_SIZE,
      EPILOG_SIZE,
    ),
    PROLOG_SIZE,
  );

  return {
    resultsBuffer: resultsOutBinary.buffer as ArrayBuffer,
    metadata,
  };
};

class MissingSimulationDataAccumulator {
  private nodeCount: number;
  private linkCount: number;
  private supplySourcesCount: number;
  private pumpCount: number;
  private supplySourceIndices: number[] = [];
  private pumpIndices: number[] = [];
  private tankVolumesPerTimestep: number[][] = [];
  private pumpStatusPerTimestep: number[][] = [];

  constructor(model: Project) {
    this.nodeCount = model.getCount(CountType.NodeCount);
    this.linkCount = model.getCount(CountType.LinkCount);

    for (let i = 1; i <= this.nodeCount; i++) {
      const nodeType = model.getNodeType(i);
      if (nodeType === NodeType.Tank || nodeType === NodeType.Reservoir) {
        this.supplySourceIndices.push(i);
      }
    }
    this.supplySourcesCount = this.supplySourceIndices.length;

    for (let i = 1; i <= this.linkCount; i++) {
      const linkType = model.getLinkType(i);
      if (linkType === LinkType.Pump) {
        this.pumpIndices.push(i);
      }
    }
    this.pumpCount = this.pumpIndices.length;
  }

  appendTimestepData(model: Project) {
    if (this.supplySourcesCount > 0) {
      const volumes: number[] = [];
      for (const nodeIndex of this.supplySourceIndices) {
        const volume = model.getNodeValue(nodeIndex, NodeProperty.TankVolume);
        volumes.push(volume);
      }
      this.tankVolumesPerTimestep.push(volumes);
    }

    if (this.pumpCount > 0) {
      const statuses: number[] = [];
      for (const linkIndex of this.pumpIndices) {
        const status = model.getLinkValue(linkIndex, LinkProperty.PumpState);
        statuses.push(status);
      }
      this.pumpStatusPerTimestep.push(statuses);
    }
  }

  tankVolumes(): ArrayBuffer {
    if (this.supplySourcesCount === 0) return new ArrayBuffer(0);

    const tankVolumesBinary = new Float32Array(
      this.tankVolumesPerTimestep.flat(),
    );
    return tankVolumesBinary.buffer as ArrayBuffer;
  }

  pumpStatus(): ArrayBuffer {
    if (this.pumpCount === 0) return new ArrayBuffer(0);

    const pumpStatusBinary = new Float32Array(
      this.pumpStatusPerTimestep.flat(),
    );
    return pumpStatusBinary.buffer as ArrayBuffer;
  }
}
