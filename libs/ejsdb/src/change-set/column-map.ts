export type ColumnWriter<Row> = (value: unknown) => Partial<Row>;

export type ColumnMap<Row> = Record<string, ColumnWriter<Row>>;

export const column =
  <Row>(
    col: Extract<keyof Row, string>,
    transform?: (value: unknown) => unknown,
  ): ColumnWriter<Row> =>
  (value) =>
    ({ [col]: transform ? transform(value) : value }) as Partial<Row>;

export const patchFrom = <Row>(
  id: number,
  fields: Record<string, unknown>,
  map: ColumnMap<Row>,
): Record<string, unknown> => {
  const row: Record<string, unknown> = { id };
  for (const key in fields) {
    const write = map[key];
    if (!write) continue;
    Object.assign(row, write(fields[key]));
  }
  return row;
};

export const rowFrom = <Row>(
  id: number,
  fields: Record<string, unknown>,
  map: ColumnMap<Row>,
): Record<string, unknown> => {
  const row: Record<string, unknown> = { id };
  for (const key in map) {
    Object.assign(row, map[key](fields[key]));
  }
  return row;
};

export const toDbBool = (value: unknown): number => (value ? 1 : 0);

export const toNullable = (value: unknown): unknown =>
  value === undefined ? null : value;
