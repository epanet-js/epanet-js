import { nanoid } from "nanoid";
import { Moment } from "./moment";

export const generateStateId = () => nanoid();
export const initId = "0";

type Action = { stateId: string; forward: Moment; reverse: Moment };

type Snapshot = { stateId: string; moment: Moment };

export class MomentLog {
  protected deltas: Action[];
  protected pointer: number;
  readonly id: string;
  protected snapshot: Snapshot | null;

  constructor(id: string = nanoid()) {
    this.id = id;
    this.deltas = [];
    this.pointer = -1;
    this.snapshot = null;
  }

  setSnapshot(moment: Moment, stateId: string) {
    this.snapshot = { moment, stateId };
  }

  getSnapshot(): Snapshot | null {
    return this.snapshot;
  }

  copy() {
    const newInstance = new MomentLog(this.id);
    newInstance.deltas = this.deltas;
    newInstance.pointer = this.pointer;
    newInstance.snapshot = this.snapshot;
    return newInstance;
  }

  append(
    forward: Moment,
    reverse: Moment,
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

  nextUndo(): { moment: Moment; stateId: string } | null {
    const action = this.deltas[this.pointer];
    if (!action) return null;

    return {
      moment: action.reverse,
      stateId: this.deltas[this.pointer - 1]
        ? this.deltas[this.pointer - 1].stateId
        : this.snapshot
          ? this.snapshot.stateId
          : initId,
    };
  }

  nextRedo(): { stateId: string; moment: Moment } | null {
    const action = this.deltas[this.pointer + 1];
    if (!action) return null;

    return {
      moment: action.forward,
      stateId: action.stateId,
    };
  }

  last(): Moment | null {
    const action = this.deltas[this.pointer];
    if (!action) return null;

    return action.forward;
  }

  getPointer(): Readonly<number> {
    return this.pointer;
  }

  getDeltas(): Moment[] {
    const result = [];
    for (let i = 0; i <= this.pointer; i++) {
      result.push(this.deltas[i].forward);
    }
    return result;
  }

  getDeltasFrom(fromPointer: number): Moment[] {
    const result = [];

    if (this.pointer >= fromPointer) {
      for (let i = fromPointer + 1; i <= this.pointer; i++) {
        result.push(this.deltas[i].forward);
      }
    } else {
      for (let i = fromPointer; i > this.pointer; i--) {
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
