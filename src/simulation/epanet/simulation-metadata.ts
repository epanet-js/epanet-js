export const PROLOG_SIZE = 884;
export const EPILOG_SIZE = 12;

export class SimulationMetadata {
  private prologView: DataView;
  private epilogView: DataView;

  constructor(prologAndEpilog: ArrayBuffer) {
    if (prologAndEpilog.byteLength !== PROLOG_SIZE + EPILOG_SIZE) {
      throw new Error(
        `Invalid prolog+epilog size: expected ${PROLOG_SIZE + EPILOG_SIZE}, got ${prologAndEpilog.byteLength}`,
      );
    }
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

  get reportingPeriods(): number {
    return this.epilogView.getInt32(0, true);
  }
}

export interface SimulationIds {
  nodeIds: string[];
  linkIds: string[];
  nodeIdToIndex: Map<string, number>;
  linkIdToIndex: Map<string, number>;
}
