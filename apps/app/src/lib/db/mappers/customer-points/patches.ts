import type { CustomerPointPatch } from "src/hydraulic-model/model-operation";
import {
  customerPointPatchRowSchema,
  customerPointMap,
  patchFrom,
  type CustomerPointPatchRow,
} from "@epanet-js/ejsdb";

export const customerPointPatchesToRows = (
  patches: readonly CustomerPointPatch[],
): CustomerPointPatchRow[] => {
  const rows: CustomerPointPatchRow[] = [];
  for (const patch of patches) {
    const candidate = patchFrom(patch.id, patch.properties, customerPointMap);
    if (Object.keys(candidate).length <= 1) continue;
    const result = customerPointPatchRowSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error(
        `Customer point ${patch.id} patch: row does not match schema — ${result.error.message}`,
      );
    }
    rows.push(result.data);
  }
  return rows;
};
