import { z } from "zod";

export const parseRows = <S extends z.ZodTypeAny>(
  schema: S,
  rows: unknown[],
  kind: string,
): z.infer<S>[] => {
  const result = z.array(schema).safeParse(rows);
  if (!result.success) {
    throw new Error(
      `${kind}: row data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
