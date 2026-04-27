import { nanoid } from "nanoid";
import type { ModelMoment } from "src/hydraulic-model/model-operation";

export const generateStateId = () => nanoid();
export const initId = "0";

type Action = { stateId: string; forward: ModelMoment; reverse: ModelMoment };

const START_POINTER = -1;

export class MomentLog {
  protected deltas: Action[];
  protected pointer: number;
  readonly id: string;
  readonly initialStateId: string;

  constructor(initialStateId: string = initId, id: string = nanoid()) {
    this.id = id;
    this.initialStateId = initialStateId;
    this.deltas = [];
    this.pointer = START_POINTER;
  }

  copy() {
    const newInstance = new MomentLog(this.initialStateId, this.id);
    newInstance.deltas = this.deltas;
    newInstance.pointer = this.pointer;
    return newInstance;
  }

  append(
    forward: ModelMoment,
    reverse: ModelMoment,
    stateId: string = generateStateId(),
  ) {
    const newPointer = this.pointer + 1;
    if (this.deltas.length >= newPointer) {
      this.deltas.splice(newPointer);
    }

    this.deltas.push({ stateId, forward, reverse });
    this.pointer = newPointer;
  }

  undo() {
    if (this.pointer < 0) return;

    this.pointer--;
  }

  redo() {
    if (this.pointer >= this.deltas.length - 1) return;

    this.pointer++;
  }

  nextUndo(): { moment: ModelMoment; stateId: string } | null {
    const action = this.deltas[this.pointer];
    if (!action) return null;

    return {
      moment: action.reverse,
      stateId: this.deltas[this.pointer - 1]?.stateId ?? this.initialStateId,
    };
  }

  nextRedo(): { stateId: string; moment: ModelMoment } | null {
    const action = this.deltas[this.pointer + 1];
    if (!action) return null;

    return {
      moment: action.forward,
      stateId: action.stateId,
    };
  }

  last(): ModelMoment | null {
    const action = this.deltas[this.pointer];
    if (!action) return null;

    return action.forward;
  }

  getPointer(): Readonly<number> {
    return this.pointer;
  }

  getDeltas(since: number = START_POINTER): ModelMoment[] {
    const result = [];

    if (this.pointer >= since) {
      for (let i = since + 1; i <= this.pointer; i++) {
        result.push(this.deltas[i].forward);
      }
    } else {
      for (let i = since; i > this.pointer; i--) {
        result.push(this.deltas[i].reverse);
      }
    }

    return result;
  }

  *[Symbol.iterator]() {
    for (const [position, action] of this.deltas.entries()) {
      const offset = this.pointer - Number(position);
      yield { moment: action.forward, position, offset };
    }
  }
}
