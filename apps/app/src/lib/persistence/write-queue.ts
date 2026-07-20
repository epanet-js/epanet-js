import type { ApplyMomentPayload } from "@epanet-js/ejsdb";
import { applyMomentToDb } from "src/lib/db";

export type WriteItem = {
  payload: ApplyMomentPayload;
  onFailure: (error: unknown) => void;
};

export class MemoryWriteQueue {
  private queue: WriteItem[] = [];
  private processing = false;

  enqueue(item: WriteItem) {
    this.queue.push(item);
    void this.process();
  }

  reset() {
    this.queue = [];
    this.processing = false;
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        try {
          await applyMomentToDb(item.payload);
          this.queue.shift();
        } catch (error) {
          this.queue = [];
          this.processing = false;
          item.onFailure(error);
          return;
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export const writeQueue = new MemoryWriteQueue();
