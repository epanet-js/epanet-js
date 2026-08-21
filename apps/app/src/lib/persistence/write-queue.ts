export type WriteOperation = () => Promise<void>;
export type WriteFailureHandler = (error: unknown) => void;

export type WriteItem = {
  operation: WriteOperation;
  onFailure: WriteFailureHandler;
};

export class MemoryWriteQueue {
  private queue: WriteItem[] = [];
  private processing = false;
  private idle: Promise<void> = Promise.resolve();
  private succeeded = 0;

  enqueue(operation: WriteOperation, onFailure: WriteFailureHandler) {
    this.queue.push({ operation, onFailure });
    if (!this.processing) this.idle = this.process();
  }

  whenIdle(): Promise<void> {
    return this.idle;
  }

  succeededCount(): number {
    return this.succeeded;
  }

  reset() {
    this.queue = [];
    this.processing = false;
    this.idle = Promise.resolve();
    this.succeeded = 0;
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        try {
          await item.operation();
          this.succeeded++;
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
