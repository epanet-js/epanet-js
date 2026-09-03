import { nanoid } from "nanoid";
import type { ChangeSet } from "@epanet-js/change-set";

const generateStateId = () => nanoid();
const initId = "0";

export type HistoryEntry = { stateId: string; changeSet: ChangeSet };

const START_POINTER = -1;

export class SessionHistory {
  protected entries: HistoryEntry[];
  protected pointer: number;
  readonly id: string;
  readonly initialStateId: string;

  constructor(initialStateId: string = initId, id: string = nanoid()) {
    this.id = id;
    this.initialStateId = initialStateId;
    this.entries = [];
    this.pointer = START_POINTER;
  }

  copy() {
    const copied = new SessionHistory(this.initialStateId, this.id);
    copied.entries = this.entries;
    copied.pointer = this.pointer;
    return copied;
  }

  append(changeSet: ChangeSet, stateId: string = generateStateId()) {
    const newPointer = this.pointer + 1;
    if (this.entries.length >= newPointer) this.entries.splice(newPointer);

    this.entries.push({ stateId, changeSet });
    this.pointer = newPointer;
  }

  undo() {
    if (this.pointer < 0) return;

    this.pointer--;
  }

  redo() {
    if (this.pointer >= this.entries.length - 1) return;

    this.pointer++;
  }

  nextUndo(): HistoryEntry | null {
    const entry = this.entries[this.pointer];
    if (!entry) return null;

    return {
      changeSet: entry.changeSet,
      stateId: this.entries[this.pointer - 1]?.stateId ?? this.initialStateId,
    };
  }

  nextRedo(): HistoryEntry | null {
    const entry = this.entries[this.pointer + 1];
    if (!entry) return null;

    return { changeSet: entry.changeSet, stateId: entry.stateId };
  }
}
