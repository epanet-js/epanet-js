import { nanoid } from "nanoid";
import { Moment } from "./moment";

export const generateStateId = () => nanoid();
export const initId = nanoid();

type Action = { stateId: string; forward: Moment; reverse: Moment };

export class MomentLog {
  protected history: Action[];
  protected pointer: number;
  readonly id: string;

  constructor(id: string = nanoid()) {
    this.id = id;
    this.history = [];
    this.pointer = -1;
  }

  copy() {
    const newInstance = new MomentLog(this.id);
    newInstance.history = this.history;
    newInstance.pointer = this.pointer;
    return newInstance;
  }

  append(
    forward: Moment,
    reverse: Moment,
    stateId: string = generateStateId(),
  ) {
    const newPointer = this.pointer + 1;
    if (this.history.length >= newPointer) {
      this.history.splice(newPointer);
    }

    this.history.push({ stateId, forward, reverse });
    this.pointer = newPointer;
  }

  undo() {
    if (this.pointer < 0) return;

    this.pointer--;
  }

  redo() {
    if (this.pointer >= this.history.length - 1) return;

    this.pointer++;
  }

  nextUndo(): { moment: Moment; stateId: string } | null {
    const action = this.history[this.pointer];
    if (!action) return null;

    return {
      moment: action.reverse,
      stateId: this.history[this.pointer - 1]
        ? this.history[this.pointer - 1].stateId
        : initId,
    };
  }

  nextRedo(): { stateId: string; moment: Moment } | null {
    const action = this.history[this.pointer + 1];
    if (!action) return null;

    return {
      moment: action.forward,
      stateId: action.stateId,
    };
  }

  last(): Moment | null {
    const action = this.history[this.pointer];
    if (!action) return null;

    return action.forward;
  }

  getPointer(): Readonly<number> {
    return this.pointer;
  }

  fetchUpToAndIncluding(pointer: number): Moment[] {
    const result = [];
    let i = 0;
    while (i <= pointer && i <= this.pointer) {
      result.push(this.history[i].forward);
      i++;
    }
    return result;
  }

  fetchAfter(pointer: number): Moment[] {
    const result = [];
    let i = pointer + 1;
    while (i <= this.pointer) {
      result.push(this.history[i].forward);
      i++;
    }
    return result;
  }

  fetchAll(): Moment[] {
    const result = [];
    for (let i = 0; i <= this.pointer; i++) {
      result.push(this.history[i].forward);
    }
    return result;
  }

  searchLast(conditionFn: (moment: Moment) => boolean): number | null {
    for (let i = this.pointer; i >= 0; i--) {
      if (conditionFn(this.history[i].forward) === true) {
        return i;
      }
    }
    return null;
  }

  *[Symbol.iterator]() {
    for (const [position, action] of this.history.entries()) {
      const offset = this.pointer - Number(position);
      yield { moment: action.forward, position, offset };
    }
  }
}
