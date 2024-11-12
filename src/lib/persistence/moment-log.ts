import { Moment } from "./moment";

type Action = { forward: Moment; reverse: Moment };

export class MomentLog {
  protected history: Action[];
  protected pointer: number;

  constructor() {
    this.history = [];
    this.pointer = -1;
  }

  append(forward: Moment, reverse: Moment) {
    const newPointer = this.pointer + 1;
    if (this.history.length >= newPointer) {
      this.history.splice(newPointer);
    }

    this.history.push({ forward, reverse });
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

  nextUndo(): Moment | null {
    const action = this.history[this.pointer];
    if (!action) return null;

    return action.reverse;
  }

  nextRedo(): Moment | null {
    const action = this.history[this.pointer + 1];
    if (!action) return null;

    return action.forward;
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
