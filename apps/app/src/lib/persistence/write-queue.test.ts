import { MemoryWriteQueue } from "./write-queue";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("MemoryWriteQueue", () => {
  it("counts writes that completed", async () => {
    const queue = new MemoryWriteQueue();
    const onFailure = vi.fn();

    queue.enqueue(() => Promise.resolve(), onFailure);
    queue.enqueue(() => Promise.resolve(), onFailure);
    await flush();

    expect(queue.succeededCount()).toBe(2);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("reports how many succeeded before the failing write", async () => {
    const queue = new MemoryWriteQueue();
    let seen = -1;
    const onFailure = vi.fn(() => {
      seen = queue.succeededCount();
    });

    queue.enqueue(() => Promise.resolve(), onFailure);
    queue.enqueue(() => Promise.resolve(), onFailure);
    queue.enqueue(() => Promise.reject(new Error("boom")), onFailure);
    await flush();

    expect(onFailure).toHaveBeenCalledTimes(1);
    // A db that never worked reports 0 here; one that died mid-session reports > 0.
    expect(seen).toBe(2);
  });

  it("does not count the failed write, and drops the rest of the queue", async () => {
    const queue = new MemoryWriteQueue();
    const later = vi.fn(() => Promise.resolve());

    queue.enqueue(() => Promise.reject(new Error("boom")), vi.fn());
    queue.enqueue(later, vi.fn());
    await flush();

    expect(queue.succeededCount()).toBe(0);
    expect(later).not.toHaveBeenCalled();
  });

  it("clears the count on reset", async () => {
    const queue = new MemoryWriteQueue();

    queue.enqueue(() => Promise.resolve(), vi.fn());
    await flush();
    expect(queue.succeededCount()).toBe(1);

    queue.reset();

    expect(queue.succeededCount()).toBe(0);
  });
});
