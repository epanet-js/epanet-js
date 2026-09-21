const BYTES_PER_ID = 4;
const MIN_ID = -(2 ** 31);
const MAX_ID = 2 ** 31 - 1;

export const encodeIdList = (ids: readonly number[]): Uint8Array | null => {
  if (ids.length === 0) return null;

  const bytes = new Uint8Array(ids.length * BYTES_PER_ID);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!Number.isInteger(id) || id < MIN_ID || id > MAX_ID) {
      throw new Error(`Id list: ${String(id)} is not a 32-bit integer`);
    }
    view.setInt32(i * BYTES_PER_ID, id, true);
  }
  return bytes;
};

export const decodeIdList = (bytes: Uint8Array | null): number[] => {
  if (bytes === null || bytes.byteLength === 0) return [];
  if (bytes.byteLength % BYTES_PER_ID !== 0) {
    throw new Error(
      `Id list: ${bytes.byteLength} bytes is not a whole number of ids`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ids = new Array<number>(bytes.byteLength / BYTES_PER_ID);
  for (let i = 0; i < ids.length; i++) {
    ids[i] = view.getInt32(i * BYTES_PER_ID, true);
  }
  return ids;
};

export const isIdListLength = (byteLength: number): boolean =>
  byteLength % BYTES_PER_ID === 0;
