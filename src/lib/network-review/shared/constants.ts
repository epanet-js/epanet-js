export const UINT32_SIZE = 4;
export const UINT8_SIZE = 1;
export const FLOAT64_SIZE = 8;
export const COORDINATES_SIZE = 2 * FLOAT64_SIZE;

export const DataSize = {
  id: UINT32_SIZE,
  count: UINT32_SIZE,
  type: UINT8_SIZE,
  coordinate: FLOAT64_SIZE,
  position: COORDINATES_SIZE,
  bounds: COORDINATES_SIZE * 4,
} as const;

export const BUFFER_HEADER_SIZE = DataSize.count;
