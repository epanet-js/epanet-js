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

  *[Symbol.iterator]() {
    for (const [position, action] of this.history.entries()) {
      const offset = this.pointer - Number(position);
      yield { moment: action.forward, position, offset };
    }
  }
}
