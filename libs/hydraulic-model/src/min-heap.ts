import { AssetId } from "./asset-types/base-asset";

export class MinHeap {
  private heap: { id: AssetId; priority: number }[] = [];

  push(id: AssetId, priority: number) {
    this.heap.push({ id, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: AssetId; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (element.priority >= parent.priority) break;

      this.heap[index] = parent;
      this.heap[parentIndex] = element;
      index = parentIndex;
    }
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (leftChild.priority < element.priority) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null &&
            leftChild &&
            rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      index = swap;
    }
  }
}
