import { expect, describe, it } from "vitest";

import { MemPersistence } from "src/lib/persistence/memory";

let persistence: MemPersistence;

describe.skip("MemPersistence", () => {
  // beforeEach(() => {
  //   persistence = new MemPersistence();
  // });

  it("#putPresence", () => {
    expect(persistence.putPresence()).toBeUndefined();
  });
});
