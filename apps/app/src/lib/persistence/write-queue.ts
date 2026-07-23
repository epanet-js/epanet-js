export type WriteOperation = () => Promise<void>;

export class MemoryWriteQueue {
  private queue: WriteOperation[] = [];
  private processing = false;

  enqueue(operation: WriteOperation) {
    this.queue.push(operation);
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
        const operation = this.queue[0];
        try {
          await operation();
          this.queue.shift();
        } catch (error) {
          this.queue = [];
          throw error;
        }
      }
    } finally {
      this.processing = false;
    }
  }
}

export const writeQueue = new MemoryWriteQueue();
