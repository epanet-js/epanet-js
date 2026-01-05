export const PROLOG_SIZE = 884;
export const EPILOG_SIZE = 12;

export interface ISimulationMetadata {
  nodeCount: number;
  resAndTankCount: number;
  linkCount: number;
  pumpCount: number;
  valveCount: number;
  reportingStartTime: number;
  reportingTimeStep: number;
  simulationDuration: number;
  reportingStepsCount: number;
}

export function getSimulationMetadata(
  metadata: ArrayBuffer | undefined,
): ISimulationMetadata {
  if (!metadata || metadata.byteLength !== PROLOG_SIZE + EPILOG_SIZE) {
    return {
      nodeCount: 0,
      resAndTankCount: 0,
      linkCount: 0,
      pumpCount: 0,
      valveCount: 0,
      reportingStartTime: 0,
      reportingTimeStep: 3600,
      simulationDuration: 0,
      reportingStepsCount: 1,
    };
  }
  return new SimulationMetadata(metadata);
}

export class SimulationMetadata implements ISimulationMetadata {
  private prologView: DataView;
  private epilogView: DataView;

  constructor(prologAndEpilog: ArrayBuffer) {
    this.prologView = new DataView(prologAndEpilog, 0, PROLOG_SIZE);
    this.epilogView = new DataView(prologAndEpilog, PROLOG_SIZE, EPILOG_SIZE);
  }

  get nodeCount(): number {
    return this.prologView.getInt32(8, true);
  }

  get resAndTankCount(): number {
    return this.prologView.getInt32(12, true);
  }

  get linkCount(): number {
    return this.prologView.getInt32(16, true);
  }

  get pumpCount(): number {
    return this.prologView.getInt32(20, true);
  }

  get valveCount(): number {
    return this.prologView.getInt32(24, true);
  }

  get reportingStartTime(): number {
    return this.prologView.getInt32(48, true);
  }

  get reportingTimeStep(): number {
    return this.prologView.getInt32(52, true);
  }

  get simulationDuration(): number {
    return this.prologView.getInt32(56, true);
  }

  get reportingStepsCount(): number {
    return this.epilogView.getInt32(0, true);
  }
}

export interface SimulationIds {
  nodeIds: string[];
  linkIds: string[];
  nodeIdToIndex: Map<string, number>;
  linkIdToIndex: Map<string, number>;
}
