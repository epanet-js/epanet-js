export type SessionCapi = {
  capi: {
    sqlite3session_create: (
      db: number,
      dbName: string,
      ppSession: number,
    ) => number;
    sqlite3session_attach: (
      pSession: number,
      tableName: string | null,
    ) => number;
    sqlite3session_changeset: (
      pSession: number,
      pnChangeset: number,
      ppChangeset: number,
    ) => number;
    sqlite3session_delete: (pSession: number) => void;
    sqlite3_free: (ptr: number) => void;
  };
  wasm: {
    pstack: {
      pointer: number;
      alloc: (bytes: number) => number;
      allocPtr: () => number;
      restore: (pointer: number) => void;
    };
    peek32: (addr: number) => number;
    peekPtr: (addr: number) => number;
    heap8u: () => Uint8Array;
  };
};

export type CaptureSession = number;

export const startCapture = (
  sqlite3: SessionCapi,
  dbPointer: number,
): CaptureSession => {
  const { capi, wasm } = sqlite3;
  const stack = wasm.pstack.pointer;
  try {
    const ppSession = wasm.pstack.allocPtr();
    const created = capi.sqlite3session_create(dbPointer, "main", ppSession);
    if (created !== 0) {
      throw new Error(`sqlite3session_create failed with ${created}`);
    }
    const pSession = wasm.peekPtr(ppSession);
    const attached = capi.sqlite3session_attach(pSession, null);
    if (attached !== 0) {
      capi.sqlite3session_delete(pSession);
      throw new Error(`sqlite3session_attach failed with ${attached}`);
    }
    return pSession;
  } finally {
    wasm.pstack.restore(stack);
  }
};

export const readChangeset = (
  sqlite3: SessionCapi,
  session: CaptureSession,
): Uint8Array => {
  const { capi, wasm } = sqlite3;
  const stack = wasm.pstack.pointer;
  let pChangeset = 0;
  try {
    const pnChangeset = wasm.pstack.alloc(4);
    const ppChangeset = wasm.pstack.allocPtr();
    const rc = capi.sqlite3session_changeset(session, pnChangeset, ppChangeset);
    if (rc !== 0) {
      throw new Error(`sqlite3session_changeset failed with ${rc}`);
    }
    const size = wasm.peek32(pnChangeset);
    pChangeset = wasm.peekPtr(ppChangeset);
    if (size <= 0 || pChangeset === 0) return new Uint8Array(0);
    return wasm.heap8u().slice(pChangeset, pChangeset + size);
  } finally {
    if (pChangeset !== 0) capi.sqlite3_free(pChangeset);
    wasm.pstack.restore(stack);
  }
};

export const endCapture = (
  sqlite3: SessionCapi,
  session: CaptureSession,
): void => {
  sqlite3.capi.sqlite3session_delete(session);
};
