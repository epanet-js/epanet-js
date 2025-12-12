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
};

export type SimulationProgress = {
  currentTime: number;
  totalDuration: number;
};

export type ProgressCallback = (progress: SimulationProgress) => void;

export const runEPSSimulation = async (
  inp: string,
  appId: string,
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

    const pumpIndices: number[] = [];
    for (let i = 1; i <= linkCount; i++) {
      const linkType = model.getLinkType(i);
      if (linkType === LinkType.Pump) {
        pumpIndices.push(i);
      }
    }
    const pumpCount = pumpIndices.length;

    const tankVolumesPerTimestep: number[][] = [];
    const pumpStatusPerTimestep: number[][] = [];

    const totalDuration = model.getTimeParameter(TimeParameter.Duration);

    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    do {
      const currentTime = model.runH();

      onProgress?.({ currentTime, totalDuration });

      if (supplySourcesCount > 0) {
        const volumes: number[] = [];
        for (const nodeIndex of supplySourceIndices) {
          const volume = model.getNodeValue(nodeIndex, NodeProperty.TankVolume);
          volumes.push(volume);
        }
        tankVolumesPerTimestep.push(volumes);
      }

      if (pumpCount > 0) {
        const statuses: number[] = [];
        for (const linkIndex of pumpIndices) {
          const status = model.getLinkValue(linkIndex, LinkProperty.PumpState);
          statuses.push(status);
        }
        pumpStatusPerTimestep.push(statuses);
      }
    } while (model.nextH() > 0);

    model.closeH();
    model.saveH();

    model.close();

    const { resultsBuffer, metadata } = extractResultsData(ws);

    const storage = new OPFSStorage(appId);
    await storage.save(RESULTS_OUT_KEY, resultsBuffer);

    if (supplySourcesCount > 0) {
      const tankVolumesBinary = new Float32Array(tankVolumesPerTimestep.flat());
      await storage.save(
        TANK_VOLUMES_KEY,
        tankVolumesBinary.buffer as ArrayBuffer,
      );
    }

    if (pumpCount > 0) {
      const pumpStatusBinary = new Float32Array(pumpStatusPerTimestep.flat());
      await storage.save(
        PUMP_STATUS_KEY,
        pumpStatusBinary.buffer as ArrayBuffer,
      );
    }

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
      metadata,
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      metadata: new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE),
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
