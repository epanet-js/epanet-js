import { z } from "zod";
import { isIdListLength } from "../id-list";

const idListSchema = z
  .instanceof(Uint8Array)
  .refine((bytes) => isIdListLength(bytes.byteLength), {
    message: "id list must hold whole ids",
  })
  .nullable();

export const selectionSetRowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  assets: idListSchema,
  customer_points: idListSchema,
});

export type SelectionSetRow = z.infer<typeof selectionSetRowSchema>;

export const bookmarkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bbox: z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ]),
});

export const bookmarksSchema = z.array(bookmarkSchema);

export type BookmarkData = z.infer<typeof bookmarkSchema>;
